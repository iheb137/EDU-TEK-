import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, indexer, messageErreur, parNom } from '../commun/base';
import { Confirmation } from '../commun/confirmation';
import {
  AvancementEnseignement, Classe, Enseignant, Enseignement, Formation, LigneAvancement, Matiere, Semestre,
} from '../commun/modeles';

type Fenetre = 'editer' | 'supprimer' | 'avancement' | 'cloturer' | 'rouvrir';

interface Ligne extends Enseignement {
  matiere?: Matiere; classe?: Classe; enseignant?: Enseignant; semestre?: Semestre; cloture: boolean | null;
}

/**
 * Enseignements (enseignant × matière × classe × semestre) : liste filtrable, création, modification,
 * suppression, clôture et réouverture de la saisie des notes, avancement de la saisie.
 */
@Component({
  selector: 'app-enseignements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal, Confirmation],
  templateUrl: './enseignements.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss', './enseignements.scss'],
})
export class Enseignements extends PageReferentiel<Fenetre> {
  protected readonly enseignements = signal<Enseignement[]>([]);
  protected readonly enseignants = signal<Enseignant[]>([]);
  protected readonly matieres = signal<Matiere[]>([]);
  protected readonly classes = signal<Classe[]>([]);
  protected readonly semestres = signal<Semestre[]>([]);
  private readonly formations = signal<Formation[]>([]);
  /** État de clôture par enseignement (null : inconnu). */
  private readonly clotures = signal<Map<number, boolean>>(new Map());

  protected readonly filtreSemestre = signal<number | null>(null);
  protected readonly filtreClasse = signal<number | null>(null);
  protected readonly filtreEnseignant = signal<number | null>(null);
  protected readonly cible = signal<Ligne | null>(null);
  protected readonly avancement = signal<AvancementEnseignement | null>(null);
  protected readonly chargementAvancement = signal(false);
  protected readonly dateHeure = dateHeureFr;

  // Listes déroulantes
  protected readonly groupesSemestres = computed(() => parNom(this.formations(), (f) => f.code).map((f) => ({
    formation: f,
    semestres: this.semestres().filter((s) => s.formationId === f.id).sort((a, b) => (a.dateDebut ?? '').localeCompare(b.dateDebut ?? '')),
  })).filter((g) => g.semestres.length));
  protected readonly classesTriees = computed(() => parNom(this.classes(), (c) => c.nom));
  protected readonly enseignantsTries = computed(() => parNom(this.enseignants(), (e) => `${e.nom} ${e.prenom}`));

  protected readonly lignes = computed<Ligne[]>(() => {
    const m = indexer(this.matieres()); const c = indexer(this.classes()); const p = indexer(this.enseignants()); const s = indexer(this.semestres());
    const fs = this.filtreSemestre(); const fc = this.filtreClasse(); const fe = this.filtreEnseignant();
    const cl = this.clotures();
    return this.enseignements()
      .filter((e) => (!fs || e.semestreId === fs) && (!fc || e.classeId === fc) && (!fe || e.enseignantId === fe))
      .map((e) => ({ ...e, matiere: m.get(e.matiereId), classe: c.get(e.classeId), enseignant: p.get(e.enseignantId), semestre: s.get(e.semestreId), cloture: cl.get(e.id) ?? null }))
      .sort((a, b) => (a.semestre?.dateDebut ?? '').localeCompare(b.semestre?.dateDebut ?? '')
        || (a.classe?.nom ?? '').localeCompare(b.classe?.nom ?? '', 'fr') || (a.matiere?.code ?? '').localeCompare(b.matiere?.code ?? ''));
  });
  protected readonly resume = computed(() => {
    const l = this.lignes();
    return { total: l.length, clotures: l.filter((x) => x.cloture).length, volume: l.reduce((n, x) => n + (x.volumeHoraire ?? 0), 0) };
  });

  protected readonly formulaire = this.fb.group({
    semestreId: this.fb.control<number | null>(null, Validators.required),
    matiereId: this.fb.control<number | null>(null, Validators.required),
    classeId: this.fb.control<number | null>(null, Validators.required),
    enseignantId: this.fb.control<number | null>(null, Validators.required),
    groupe: this.fb.nonNullable.control('G1', Validators.maxLength(20)),
    volumeHoraire: this.fb.control<number | null>(42, [Validators.min(0), Validators.max(1000)]),
  });

  /** Semestre choisi dans le formulaire : restreint matières et classes aux choix acceptés par l'API. */
  private readonly semestreChoisi = signal<number | null>(null);
  protected readonly matieresDuSemestre = computed(() => parNom(this.matieres().filter((m) => m.semestreId === this.semestreChoisi()), (m) => m.code));
  protected readonly classesDuSemestre = computed(() => {
    const s = this.semestres().find((x) => x.id === this.semestreChoisi());
    return s ? this.classesTriees().filter((c) => c.formationId === s.formationId) : [];
  });

  constructor() {
    super();
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    this.filtreSemestre.set(Number(q.get('semestre')) || null);
    this.filtreClasse.set(Number(q.get('classe')) || null);
    this.filtreEnseignant.set(Number(q.get('enseignant')) || null);

    this.formulaire.controls.semestreId.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.semestreChoisi.set(id);
      const v = this.formulaire.getRawValue();
      if (v.matiereId && !this.matieresDuSemestre().some((m) => m.id === v.matiereId)) { this.formulaire.controls.matiereId.setValue(null); }
      if (v.classeId && !this.classesDuSemestre().some((c) => c.id === v.classeId)) { this.formulaire.controls.classeId.setValue(null); }
    });

    this.charger(() => { if (q.get('creer') && this.peutEcrire) { this.nouveau(); } });
  }

  protected charger(ensuite?: () => void): void {
    this.chargement.set(true);
    forkJoin({
      n: this.http.get<Enseignement[]>(`${API_URL}/enseignements`),
      p: this.http.get<Enseignant[]>(`${API_URL}/enseignants`),
      m: this.http.get<Matiere[]>(`${API_URL}/matieres`),
      c: this.http.get<Classe[]>(`${API_URL}/classes`),
      s: this.http.get<Semestre[]>(`${API_URL}/semestres`),
      f: this.http.get<Formation[]>(`${API_URL}/formations`),
    }).pipe(
      // État de clôture : une requête d'avancement par semestre (au lieu d'une par enseignement).
      switchMap((r) => (r.s.length
        ? forkJoin(r.s.map((s) => this.http.get<LigneAvancement[]>(`${API_URL}/resultats/semestres/${s.id}/avancement`).pipe(catchError(() => of([] as LigneAvancement[])))))
        : of([] as LigneAvancement[][])).pipe(map((av) => ({ ...r, av: av.flat() })))),
    ).subscribe({
      next: (r) => {
        this.enseignements.set(r.n); this.enseignants.set(r.p); this.matieres.set(r.m); this.classes.set(r.c);
        this.semestres.set(r.s); this.formations.set(r.f);
        this.clotures.set(new Map(r.av.map((a) => [a.enseignementId, a.cloture])));
        this.erreur.set(''); this.chargement.set(false);
        ensuite?.();
      },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected filtrer(quoi: 'semestre' | 'classe' | 'enseignant', v: string): void {
    const n = Number(v) || null;
    ({ semestre: this.filtreSemestre, classe: this.filtreClasse, enseignant: this.filtreEnseignant })[quoi].set(n);
  }

  protected reinitialiserFiltres(): void { this.filtreSemestre.set(null); this.filtreClasse.set(null); this.filtreEnseignant.set(null); }

  // ── Création / modification ─────────────────────────────────────────────
  protected nouveau(): void {
    this.cible.set(null);
    const classe = this.classes().find((c) => c.id === this.filtreClasse());
    let semestre = this.filtreSemestre();
    if (!semestre && classe) {
      // Semestre en cours (ou le plus récent) de la formation de la classe.
      const aujourdhui = new Date().toISOString().slice(0, 10);
      const ss = this.semestres().filter((s) => s.formationId === classe.formationId).sort((a, b) => (a.dateDebut ?? '').localeCompare(b.dateDebut ?? ''));
      semestre = (ss.find((s) => (s.dateDebut ?? '') <= aujourdhui && aujourdhui <= (s.dateFin ?? '')) ?? ss[ss.length - 1])?.id ?? null;
    }
    this.semestreChoisi.set(semestre);
    this.formulaire.reset({ semestreId: semestre, matiereId: null, classeId: classe?.id ?? null, enseignantId: this.filtreEnseignant(), groupe: 'G1', volumeHoraire: 42 });
    this.ouvrir('editer');
  }

  protected modifier(e: Ligne): void {
    this.cible.set(e);
    this.semestreChoisi.set(e.semestreId);
    this.formulaire.reset({ semestreId: e.semestreId, matiereId: e.matiereId, classeId: e.classeId, enseignantId: e.enseignantId, groupe: e.groupe ?? '', volumeHoraire: e.volumeHoraire ?? null });
    this.ouvrir('editer');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps = { ...v, groupe: v.groupe.trim() || null };
    const c = this.cible();
    const req = c
      ? this.http.put<Enseignement>(`${API_URL}/enseignements/${c.id}`, { id: c.id, ...corps })
      : this.http.post<Enseignement>(`${API_URL}/enseignements`, corps);
    this.envoyer(req, () => {
      const m = this.matieres().find((x) => x.id === v.matiereId);
      const cl = this.classes().find((x) => x.id === v.classeId);
      this.fermer();
      this.confirmer(`${c ? 'Enseignement modifié' : 'Enseignement créé'} : ${m?.nom ?? ''} · ${cl?.nom ?? ''}`);
      this.charger();
    });
  }

  protected demander(f: 'supprimer' | 'cloturer' | 'rouvrir', e: Ligne): void { this.cible.set(e); this.ouvrir(f); }

  protected supprimer(): void {
    const e = this.cible();
    if (!e) { return; }
    this.envoyer(this.http.delete(`${API_URL}/enseignements/${e.id}`), () => {
      this.fermer();
      this.confirmer(`Enseignement supprimé : ${e.matiere?.nom ?? ''} · ${e.classe?.nom ?? ''}`);
      this.charger();
    });
  }

  // ── Clôture / réouverture / avancement ──────────────────────────────────
  protected basculerSaisie(action: 'cloturer' | 'rouvrir'): void {
    const e = this.cible();
    if (!e) { return; }
    this.envoyer(this.http.post(`${API_URL}/enseignements/${e.id}/${action}`, null), () => {
      this.fermer();
      this.confirmer(`${action === 'cloturer' ? 'Saisie clôturée' : 'Saisie rouverte'} : ${e.matiere?.nom ?? ''} · ${e.classe?.nom ?? ''}`);
      this.charger();
    });
  }

  protected voirAvancement(e: Ligne): void {
    this.cible.set(e);
    this.avancement.set(null);
    this.ouvrir('avancement');
    this.chargementAvancement.set(true);
    this.http.get<AvancementEnseignement>(`${API_URL}/enseignements/${e.id}/avancement`).subscribe({
      next: (a) => { this.avancement.set(a); this.chargementAvancement.set(false); },
      error: (err: unknown) => { this.erreurFenetre.set(messageErreur(err)); this.chargementAvancement.set(false); },
    });
  }

  protected manquantes(a: { attendues: number; brouillons: number; soumises: number }): number { return Math.max(0, a.attendues - a.brouillons - a.soumises); }
  protected part(n: number, total: number): number { return total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0; }
  protected libelleType(t: string): string {
    return ({ DS: 'Devoir surveillé', EXAMEN: 'Examen', TP: 'Travaux pratiques', PROJET: 'Projet', ORAL: 'Oral', CC: 'Contrôle continu' } as Record<string, string>)[t] ?? t;
  }
}
