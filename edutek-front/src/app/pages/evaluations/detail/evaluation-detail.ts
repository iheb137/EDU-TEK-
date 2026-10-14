import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr, nombreFr, telechargerTexte } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { BlocStats } from '../commun/bloc-stats';
import { DonneesPedagogiques } from '../donnees';
import {
  AvancementEnseignement, Etudiant, Evaluation, EvaluationStatistiques, ImportNotesResultat, Note, heureCourte, libelleType, lireNote,
} from '../modeles';

type Fenetre = null | 'import' | 'soumettre' | 'motif' | 'cloturer' | 'rouvrir';
interface Saisie { valeur: string; commentaire: string; }
interface Ligne {
  etudiant: Etudiant; note?: Note; valeur: string; commentaire: string;
  modifiee: boolean; invalide: boolean; verrouillee: boolean; erreur?: string;
}

/** Détail d'une évaluation : grille de saisie des notes, import CSV, statistiques, soumission et clôture. */
@Component({
  selector: 'app-evaluation-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Modal, BlocStats],
  templateUrl: './evaluation-detail.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/module.scss', './evaluation-detail.scss'],
  host: { '(window:beforeunload)': 'avantDeQuitter($event)' },
})
export class EvaluationDetail {
  private readonly http = inject(HttpClient);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly ref = inject(DonneesPedagogiques);
  protected readonly admin = this.ref.estAdmin;
  protected readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly date = dateFr;
  protected readonly dateHeure = dateHeureFr;
  protected readonly nombre = nombreFr;
  protected readonly libelleType = libelleType;
  protected readonly heure = heureCourte;

  protected readonly evaluation = signal<Evaluation | null>(null);
  protected readonly notes = signal<Note[]>([]);
  protected readonly avancement = signal<AvancementEnseignement | null>(null);
  protected readonly stats = signal<EvaluationStatistiques | null>(null);
  protected readonly inclureBrouillons = signal(true);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly erreursEnregistrement = signal<string[]>([]);

  /** Saisies en cours, par identifiant d'étudiant (seules les cellules touchées y figurent). */
  protected readonly saisies = signal<Record<number, Saisie>>({});
  protected readonly erreursLigne = signal<Record<number, string>>({});
  protected readonly recherche = signal('');
  protected readonly enregistrement = signal(false);

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected motif = '';

  // Import CSV
  protected fichier: File | null = null;
  protected simulation = true;
  protected ignorerErreurs = false;
  protected readonly resultatImport = signal<ImportNotesResultat | null>(null);

  // ── Contexte ──────────────────────────────────────────────────────────────
  protected readonly enseignement = computed(() => { const e = this.evaluation(); return e ? this.ref.enseignementsParId().get(e.enseignementId) : undefined; });
  protected readonly matiere = computed(() => { const e = this.evaluation(); return e ? this.ref.matiereDe(e.enseignementId) : undefined; });
  protected readonly classe = computed(() => { const e = this.evaluation(); return e ? this.ref.classeDe(e.enseignementId) : undefined; });
  protected readonly semestre = computed(() => { const e = this.enseignement(); return e ? this.ref.semestresParId().get(e.semestreId) : undefined; });
  protected readonly cloture = computed(() => this.avancement()?.cloture === true);
  protected readonly noteMax = computed(() => this.stats()?.noteMax ?? 20);

  /** Droit de saisie sur cette évaluation (enseignement ouvert ; évaluation anonyme réservée à l'administration). */
  protected readonly peutSaisir = computed(() => !!this.evaluation() && !this.cloture() && (this.admin() || !this.evaluation()?.anonyme));
  protected readonly raisonLectureSeule = computed(() => {
    if (!this.evaluation()) { return ''; }
    if (this.cloture()) { return this.admin() ? 'Enseignement clôturé : rouvrez-le pour modifier les notes.' : 'Enseignement clôturé : la saisie est verrouillée. Adressez-vous à l\'administration pédagogique pour une correction.'; }
    if (this.evaluation()?.anonyme && !this.admin()) { return 'Évaluation anonyme : la saisie des notes est réservée à l\'administration pédagogique.'; }
    return '';
  });

  protected readonly lignes = computed<Ligne[]>(() => {
    const ens = this.enseignement();
    if (!ens) { return []; }
    const parEtudiant = new Map(this.notes().map((n) => [n.etudiantId, n] as const));
    const s = this.saisies();
    const errs = this.erreursLigne();
    const peut = this.peutSaisir();
    const max = this.noteMax();
    const etudiants = this.ref.etudiantsDeClasse(ens.classeId);
    // Notes d'étudiants qui ne sont plus dans la classe : affichées quand même.
    const horsClasse = this.notes().filter((n) => !etudiants.some((e) => e.id === n.etudiantId))
      .map((n) => this.ref.etudiantsParId().get(n.etudiantId) ?? { id: n.etudiantId, nom: `n° ${n.etudiantId}`, prenom: 'Étudiant', email: '', matricule: '' });
    return [...etudiants, ...horsClasse].map((et) => {
      const note = parEtudiant.get(et.id);
      const origine: Saisie = { valeur: note ? this.formater(note.valeur) : '', commentaire: note?.commentaire ?? '' };
      const cour = s[et.id] ?? origine;
      const lue = lireNote(cour.valeur);
      return {
        etudiant: et, note, valeur: cour.valeur, commentaire: cour.commentaire,
        modifiee: !!s[et.id] && (this.normaliser(cour.valeur) !== this.normaliser(origine.valeur) || cour.commentaire.trim() !== origine.commentaire.trim()),
        invalide: lue !== null && (isNaN(lue) || lue < 0 || lue > max),
        verrouillee: !peut || (note?.statut === 'SOUMISE' && !this.admin()),
        erreur: errs[et.id],
      };
    });
  });
  protected readonly lignesAffichees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return q ? this.lignes().filter((l) => `${l.etudiant.prenom} ${l.etudiant.nom} ${l.etudiant.nom} ${l.etudiant.prenom} ${l.etudiant.matricule}`.toLowerCase().includes(q)) : this.lignes();
  });
  protected readonly nbModifiees = computed(() => this.lignes().filter((l) => l.modifiee).length);
  protected readonly nbInvalides = computed(() => this.lignes().filter((l) => l.invalide).length);
  protected readonly compteurs = computed(() => {
    const n = this.notes();
    return { attendues: this.lignes().length, brouillons: n.filter((x) => x.statut === 'BROUILLON').length, soumises: n.filter((x) => x.statut === 'SOUMISE').length };
  });

  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.ref.assurer().subscribe({ next: () => this.charger(), error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); } });
  }

  // ── Chargement ────────────────────────────────────────────────────────────
  protected charger(): void {
    this.chargement.set(true);
    this.http.get<Evaluation>(`${API_URL}/evaluations/${this.id}`).subscribe({
      next: (ev) => {
        this.evaluation.set(ev);
        forkJoin({
          notes: this.http.get<Note[]>(`${API_URL}/evaluations/${this.id}/notes`),
          avancement: this.http.get<AvancementEnseignement>(`${API_URL}/enseignements/${ev.enseignementId}/avancement`).pipe(catchError(() => of(null))),
        }).subscribe({
          next: (r) => { this.notes.set(r.notes); this.avancement.set(r.avancement); this.chargement.set(false); this.erreur.set(''); },
          error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
        });
        this.chargerStats();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected chargerStats(): void {
    const p = new HttpParams().set('inclureBrouillons', this.inclureBrouillons());
    this.http.get<EvaluationStatistiques>(`${API_URL}/evaluations/${this.id}/statistiques`, { params: p }).subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.stats.set(null),
    });
  }

  private rechargerNotes(): void {
    const ev = this.evaluation();
    if (!ev) { return; }
    forkJoin({
      notes: this.http.get<Note[]>(`${API_URL}/evaluations/${this.id}/notes`),
      avancement: this.http.get<AvancementEnseignement>(`${API_URL}/enseignements/${ev.enseignementId}/avancement`).pipe(catchError(() => of(this.avancement()))),
    }).subscribe({
      next: (r) => { this.notes.set(r.notes); this.avancement.set(r.avancement); },
      error: (e: unknown) => this.erreur.set(Auth.message(e)),
    });
    this.chargerStats();
  }

  protected basculerBrouillons(v: boolean): void { this.inclureBrouillons.set(v); this.chargerStats(); }

  // ── Saisie au clavier ─────────────────────────────────────────────────────
  protected saisir(l: Ligne, champ: keyof Saisie, valeur: string): void {
    this.saisies.update((s) => ({ ...s, [l.etudiant.id]: { valeur: l.valeur, commentaire: l.commentaire, [champ]: valeur } }));
    if (l.erreur) { this.erreursLigne.update((e) => { const n = { ...e }; delete n[l.etudiant.id]; return n; }); }
  }

  protected touche(ev: KeyboardEvent, index: number, colonne: 'note' | 'com', l: Ligne): void {
    const aller = (delta: number) => { ev.preventDefault(); this.focaliser(index + delta, colonne); };
    if (ev.key === 'Enter') { aller(ev.shiftKey ? -1 : 1); }
    else if (ev.key === 'ArrowDown') { aller(1); }
    else if (ev.key === 'ArrowUp') { aller(-1); }
    else if (ev.key === 'Escape' && this.saisies()[l.etudiant.id]) {
      ev.preventDefault(); ev.stopPropagation();
      this.saisies.update((s) => { const n = { ...s }; delete n[l.etudiant.id]; return n; });
    }
  }

  protected raccourci(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); this.enregistrer(); }
  }

  private focaliser(index: number, colonne: 'note' | 'com'): void {
    const champ = this.hote.nativeElement.querySelector<HTMLInputElement>(`#${colonne}-${index}`);
    if (champ) { champ.focus(); champ.select(); }
  }

  protected annulerModifications(): void { this.saisies.set({}); this.erreursLigne.set({}); this.erreursEnregistrement.set([]); }

  // ── Enregistrement ────────────────────────────────────────────────────────
  protected enregistrer(): void {
    if (this.enregistrement() || !this.nbModifiees()) { return; }
    if (this.nbInvalides()) { this.erreur.set(`Corrigez les ${this.nbInvalides()} note(s) invalide(s) : valeur entre 0 et ${this.formater(this.noteMax())}, deux décimales au plus.`); return; }
    this.erreur.set('');
    const corrections = this.lignes().filter((l) => l.modifiee && l.note?.statut === 'SOUMISE');
    if (corrections.length) { this.motif = ''; this.erreurFenetre.set(''); this.fenetre.set('motif'); return; }
    this.executer('');
  }

  protected confirmerMotif(): void {
    if (this.motif.trim().length < 3) { this.erreurFenetre.set('Indiquez le motif de la correction (il est journalisé).'); return; }
    this.fermer();
    this.executer(this.motif.trim());
  }

  private executer(motif: string): void {
    const ev = this.evaluation();
    if (!ev) { return; }
    const aTraiter = this.lignes().filter((l) => l.modifiee);
    const requetes = aTraiter.filter((l) => l.note || lireNote(l.valeur) !== null).map((l) => {
      const valeur = lireNote(l.valeur);
      const soumise = l.note?.statut === 'SOUMISE';
      let params = new HttpParams();
      if (soumise && motif) { params = params.set('motif', motif); }
      let req: Observable<unknown>;
      if (!l.note) {
        req = this.http.post<Note>(`${API_URL}/notes`, { valeur, commentaire: l.commentaire.trim() || null, evaluationId: ev.id, etudiantId: l.etudiant.id });
      } else if (valeur === null) {
        req = this.http.delete(`${API_URL}/notes/${l.note.id}`, { params });
      } else {
        req = this.http.put<Note>(`${API_URL}/notes/${l.note.id}`, { ...l.note, valeur, commentaire: l.commentaire.trim() || null }, { params });
      }
      return req.pipe(map(() => ({ ligne: l, ok: true, message: '' })), catchError((e: unknown) => of({ ligne: l, ok: false, message: Auth.message(e) })));
    });

    // Cellules vidées sans note existante : simplement oubliées.
    this.saisies.update((s) => { const n = { ...s }; for (const l of aTraiter) { if (!l.note && lireNote(l.valeur) === null) { delete n[l.etudiant.id]; } } return n; });
    if (!requetes.length) { return; }

    this.enregistrement.set(true);
    this.erreursEnregistrement.set([]);
    forkJoin(requetes).subscribe((res) => {
      this.enregistrement.set(false);
      const ok = res.filter((r) => r.ok);
      const ko = res.filter((r) => !r.ok);
      this.saisies.update((s) => { const n = { ...s }; for (const r of ok) { delete n[r.ligne.etudiant.id]; } return n; });
      const errs: Record<number, string> = {};
      for (const r of ko) { errs[r.ligne.etudiant.id] = r.message; }
      this.erreursLigne.set(errs);
      this.erreursEnregistrement.set(ko.map((r) => `${r.ligne.etudiant.prenom} ${r.ligne.etudiant.nom} : ${r.message}`));
      if (ok.length) { this.confirmer(`${ok.length} note${ok.length > 1 ? 's' : ''} enregistrée${ok.length > 1 ? 's' : ''}${this.admin() ? '.' : ' en brouillon.'}`); }
      this.rechargerNotes();
    });
  }

  // ── Soumission, clôture ───────────────────────────────────────────────────
  protected ouvrir(f: Exclude<Fenetre, null>): void { this.erreurFenetre.set(''); this.fenetre.set(f); }

  protected soumettre(): void {
    this.action(`${API_URL}/evaluations/${this.id}/soumettre`, (r) => {
      const n = Number((r as { soumises?: number } | null)?.soumises ?? 0);
      return `${n} note${n > 1 ? 's' : ''} soumise${n > 1 ? 's' : ''}. Les étudiants concernés sont notifiés.`;
    });
  }
  protected cloturer(): void { this.action(`${API_URL}/enseignements/${this.evaluation()?.enseignementId}/cloturer`, () => 'Enseignement clôturé : la saisie est verrouillée.'); }
  protected rouvrir(): void { this.action(`${API_URL}/enseignements/${this.evaluation()?.enseignementId}/rouvrir`, () => 'Enseignement rouvert : la saisie est de nouveau possible. Les résultats déjà calculés sont à recalculer.'); }

  private action(url: string, message: (r: unknown) => string): void {
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post(url, null).subscribe({
      next: (r) => { this.enCours.set(false); this.fermer(); this.confirmer(message(r)); this.rechargerNotes(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Import CSV ────────────────────────────────────────────────────────────
  protected ouvrirImport(): void {
    this.fichier = null; this.simulation = true; this.ignorerErreurs = false;
    this.resultatImport.set(null); this.erreurFenetre.set(''); this.fenetre.set('import');
  }
  protected choisirFichier(e: Event): void { this.fichier = (e.target as HTMLInputElement).files?.[0] ?? null; this.resultatImport.set(null); }

  protected importer(): void {
    if (!this.fichier) { this.erreurFenetre.set('Choisissez un fichier CSV.'); return; }
    const donnees = new FormData();
    donnees.append('fichier', this.fichier);
    const params = new HttpParams().set('simulation', this.simulation).set('ignorerErreurs', this.ignorerErreurs);
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.resultatImport.set(null);
    this.http.post<ImportNotesResultat>(`${API_URL}/evaluations/${this.id}/notes/import`, donnees, { params }).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.resultatImport.set(r);
        // Import réel terminé : le fichier est consommé, un second clic le réimporterait.
        if (!r.simulation && r.notesCreees) { this.fichier = null; this.rechargerNotes(); }
      },
      error: (e: unknown) => {
        this.enCours.set(false);
        const corps = (e as HttpErrorResponse)?.error as ImportNotesResultat | null;
        if (corps && Array.isArray(corps.erreurs)) {
          // Import refusé (tout ou rien) : on affiche le détail ligne par ligne plutôt que le JSON brut.
          this.resultatImport.set({ ...corps, notesCreees: 0 });
          const n = corps.erreurs.length;
          this.erreurFenetre.set(`Import refusé : aucune note n'a été enregistrée (${n} erreur${n > 1 ? 's' : ''}). `
            + 'Corrigez le fichier, ou cochez « Ignorer les lignes en erreur » pour importer les lignes valides.');
        } else {
          this.erreurFenetre.set(Auth.message(e));
        }
      },
    });
  }

  /** Modèle pré-rempli avec les étudiants de la classe qui n'ont pas encore de note. */
  protected telechargerModele(): void {
    const sans = this.lignes().filter((l) => !l.note && l.etudiant.matricule);
    const corps = sans.map((l) => `${l.etudiant.matricule};;`).join('\n');
    const nom = `notes-${(this.matiere()?.code ?? 'evaluation').toLowerCase()}-${this.evaluation()?.type?.toLowerCase() ?? ''}-${this.id}.csv`;
    telechargerTexte(nom, 'matricule;valeur;commentaire\n' + corps + (corps ? '\n' : ''));
  }

  /** Export des notes affichées (lecture). */
  protected exporter(): void {
    const lignes = this.lignes().map((l) => `${l.etudiant.matricule};${l.etudiant.nom};${l.etudiant.prenom};${l.note ? String(l.note.valeur).replace('.', ',') : ''};${l.note?.statut ?? ''};${(l.note?.commentaire ?? '').replace(/[;\n]/g, ' ')}`);
    telechargerTexte(`notes-evaluation-${this.id}.csv`, 'matricule;nom;prenom;valeur;statut;commentaire\n' + lignes.join('\n') + '\n');
  }

  // ── Divers ────────────────────────────────────────────────────────────────
  protected statutLibelle(l: Ligne): string {
    if (l.modifiee) { return 'Modifiée'; }
    if (!l.note) { return 'Non saisie'; }
    return l.note.statut === 'SOUMISE' ? 'Soumise' : l.note.statut === 'BROUILLON' ? 'Brouillon' : (l.note.statut ?? '');
  }
  protected avantDeQuitter(e: BeforeUnloadEvent): void { if (this.nbModifiees()) { e.preventDefault(); } }
  protected fermer(): void { this.fenetre.set(null); }
  private formater(v: number): string { return String(v).replace('.', ','); }
  private normaliser(v: string): string { const n = lireNote(v); return n === null ? '' : isNaN(n) ? v.trim() : String(n); }
  private confirmer(m: string): void {
    this.info.set(m);
    clearTimeout(this.minuteurInfo);
    this.minuteurInfo = setTimeout(() => this.info.set(''), 4000);
  }
}
