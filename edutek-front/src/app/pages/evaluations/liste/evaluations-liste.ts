import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, nombreFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { DonneesPedagogiques } from '../donnees';
import { AvancementEnseignement, Evaluation, EvaluationAvancement, TYPES_EVALUATION, heureCourte, libelleType } from '../modeles';

type Fenetre = null | 'formulaire' | 'supprimer';

/** Liste filtrable des évaluations, création, modification et suppression. */
@Component({
  selector: 'app-evaluations-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal],
  templateUrl: './evaluations-liste.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/module.scss', './evaluations-liste.scss'],
})
export class EvaluationsListe {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly ref = inject(DonneesPedagogiques);
  protected readonly admin = this.ref.estAdmin;

  protected readonly types = TYPES_EVALUATION;
  protected readonly libelleType = libelleType;
  protected readonly heure = heureCourte;
  protected readonly date = dateFr;
  protected readonly nombre = nombreFr;

  protected readonly evaluations = signal<Evaluation[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly semestre = signal<number | null>(null);
  protected readonly classe = signal<number | null>(null);
  protected readonly enseignement = signal<number | null>(null);
  protected readonly numero = signal(0);
  protected readonly taille = 15;

  /** Avancement de la saisie par évaluation et état de clôture par enseignement. */
  protected readonly avancement = signal<Map<number, EvaluationAvancement>>(new Map());
  protected readonly clotures = signal<Map<number, boolean>>(new Map());

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly cible = signal<Evaluation | null>(null);

  protected readonly formulaire = this.fb.nonNullable.group({
    enseignementId: [0, [Validators.required, Validators.min(1)]],
    type: ['DS', Validators.required],
    date: ['', Validators.required],
    heureDebut: ['09:00'],
    dureeMinutes: [90 as number | null, [Validators.min(1), Validators.max(600)]],
    salle: [''],
    coefficient: [1 as number | null, [Validators.required, Validators.min(0.01), Validators.max(100)]],
    anonyme: [false],
  });

  /** Enseignements proposés dans le filtre (selon semestre et classe choisis). */
  protected readonly enseignementsFiltre = computed(() => this.ref.enseignements()
    .filter((e) => (!this.semestre() || e.semestreId === this.semestre()) && (!this.classe() || e.classeId === this.classe()))
    .sort((a, b) => this.ref.libelleEnseignement(a.id).localeCompare(this.ref.libelleEnseignement(b.id))));

  /** Enseignements proposés dans le formulaire, groupés par semestre. */
  protected readonly groupesFormulaire = computed(() => this.ref.semestres().map((s) => ({
    semestre: s, enseignements: this.ref.enseignements().filter((e) => e.semestreId === s.id)
      .sort((a, b) => this.ref.libelleEnseignement(a.id).localeCompare(this.ref.libelleEnseignement(b.id))),
  })).filter((g) => g.enseignements.length));

  protected readonly filtrees = computed(() => {
    const l = this.evaluations() ?? [];
    const parId = this.ref.enseignementsParId();
    return l.filter((ev) => {
      const e = parId.get(ev.enseignementId);
      if (!e) { return false; }
      return (!this.semestre() || e.semestreId === this.semestre()) && (!this.classe() || e.classeId === this.classe())
        && (!this.enseignement() || e.id === this.enseignement());
    }).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id);
  });
  protected readonly pageCourante = computed(() => this.filtrees().slice(this.numero() * this.taille, (this.numero() + 1) * this.taille));
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.filtrees().length / this.taille)));

  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    const num = (k: string) => (q.get(k) ? Number(q.get(k)) : null);
    this.ref.assurer().subscribe({
      next: () => {
        this.semestre.set(q.has('semestre') ? num('semestre') : this.ref.semestreCourant());
        this.classe.set(num('classe'));
        this.enseignement.set(num('enseignement'));
        this.charger();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  // ── Liste ───────────────────────────────────────────────────────────────
  protected charger(): void {
    this.chargement.set(true);
    this.http.get<Evaluation[]>(`${API_URL}/evaluations`).subscribe({
      next: (l) => { this.evaluations.set(l); this.erreur.set(''); this.chargement.set(false); this.chargerAvancements(); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  /** Avancement de la saisie pour les enseignements affichés (limité pour éviter une rafale de requêtes). */
  private chargerAvancements(): void {
    const ids = [...new Set(this.filtrees().map((e) => e.enseignementId))].filter((id) => !this.clotures().has(id));
    if (!ids.length || ids.length > 24) { return; }
    forkJoin(ids.map((id) => this.http.get<AvancementEnseignement>(`${API_URL}/enseignements/${id}/avancement`).pipe(catchError(() => of(null))))).subscribe((r) => {
      const av = new Map(this.avancement());
      const cl = new Map(this.clotures());
      for (const a of r) {
        if (!a) { continue; }
        cl.set(a.id, a.cloture);
        for (const e of a.evaluations) { av.set(e.id, e); }
      }
      this.avancement.set(av);
      this.clotures.set(cl);
    });
  }

  protected filtrer(champ: 'semestre' | 'classe' | 'enseignement', valeur: string): void {
    const v = valeur ? Number(valeur) : null;
    if (champ === 'semestre') { this.semestre.set(v); this.enseignement.set(null); }
    if (champ === 'classe') { this.classe.set(v); this.enseignement.set(null); }
    if (champ === 'enseignement') { this.enseignement.set(v); }
    this.numero.set(0);
    this.router.navigate([], { queryParams: { semestre: this.semestre() ?? '', classe: this.classe() ?? undefined, enseignement: this.enseignement() ?? undefined }, replaceUrl: true });
    this.chargerAvancements();
  }
  protected aller(delta: number): void { this.numero.update((n) => n + delta); }

  protected horaire(ev: Evaluation): string {
    if (!ev.heureDebut) { return 'Horaire non précisé'; }
    return heureCourte(ev.heureDebut) + (ev.dureeMinutes ? ` · ${ev.dureeMinutes} min` : '');
  }

  protected verrouillee(ev: Evaluation): boolean { return this.clotures().get(ev.enseignementId) === true; }
  protected soumises(ev: Evaluation): number { return this.avancement().get(ev.id)?.soumises ?? 0; }
  /** Un enseignant ne supprime plus une évaluation dont des notes sont soumises ou dont l'enseignement est clôturé. */
  protected suppressionInterdite(ev: Evaluation): string {
    if (this.verrouillee(ev)) { return 'Enseignement clôturé : suppression impossible'; }
    if (!this.admin() && this.soumises(ev) > 0) { return 'Des notes sont soumises : seule l\'administration pédagogique peut supprimer cette évaluation'; }
    return '';
  }

  // ── Formulaire ──────────────────────────────────────────────────────────
  protected ouvrirCreation(): void {
    this.cible.set(null);
    const ens = this.enseignement() ?? this.enseignementsFiltre()[0]?.id ?? 0;
    this.formulaire.reset({ enseignementId: ens, type: 'DS', date: new Date().toISOString().slice(0, 10), heureDebut: '09:00', dureeMinutes: 90, salle: '', coefficient: 1, anonyme: false });
    this.formulaire.controls.enseignementId.enable();
    this.erreurFenetre.set('');
    this.fenetre.set('formulaire');
  }

  protected ouvrirModification(ev: Evaluation): void {
    this.cible.set(ev);
    this.formulaire.reset({
      enseignementId: ev.enseignementId, type: ev.type, date: ev.date ?? '', heureDebut: heureCourte(ev.heureDebut),
      dureeMinutes: ev.dureeMinutes ?? null, salle: ev.salle ?? '', coefficient: ev.coefficient ?? null, anonyme: !!ev.anonyme,
    });
    // L'enseignement d'une évaluation existante ne change pas (les notes y sont rattachées).
    this.formulaire.controls.enseignementId.disable();
    this.erreurFenetre.set('');
    this.fenetre.set('formulaire');
  }

  /** Types proposés, en conservant un type existant hors liste. */
  protected typesProposes(): { code: string; libelle: string }[] {
    const t = this.cible()?.type;
    return t && !this.types.some((x) => x.code === t) ? [...this.types, { code: t, libelle: t }] : this.types;
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps: Evaluation = {
      id: this.cible()?.id as number, enseignementId: Number(v.enseignementId), type: v.type, date: v.date || null,
      heureDebut: v.heureDebut ? (v.heureDebut.length === 5 ? v.heureDebut + ':00' : v.heureDebut) : null,
      dureeMinutes: v.dureeMinutes ?? null, salle: v.salle.trim() || null, coefficient: v.coefficient, anonyme: v.anonyme,
    };
    const c = this.cible();
    const requete = c ? this.http.put<Evaluation>(`${API_URL}/evaluations/${c.id}`, corps) : this.http.post<Evaluation>(`${API_URL}/evaluations`, corps);
    this.enCours.set(true);
    this.erreurFenetre.set('');
    requete.subscribe({
      next: (ev) => {
        this.enCours.set(false);
        this.fermer();
        this.confirmer(c ? 'Évaluation modifiée.' : `Évaluation créée : ${libelleType(ev.type)} · ${this.ref.libelleEnseignement(ev.enseignementId)}.`);
        this.clotures.update((m) => { const n = new Map(m); n.delete(ev.enseignementId); return n; });
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Suppression ─────────────────────────────────────────────────────────
  protected demanderSuppression(ev: Evaluation): void { this.cible.set(ev); this.erreurFenetre.set(''); this.fenetre.set('supprimer'); }

  protected supprimer(): void {
    const ev = this.cible();
    if (!ev) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/evaluations/${ev.id}`).subscribe({
      next: () => {
        this.enCours.set(false);
        this.fermer();
        this.evaluations.update((l) => (l ?? []).filter((x) => x.id !== ev.id));
        this.confirmer('Évaluation supprimée.');
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected notesSaisies(ev: Evaluation): number {
    const a = this.avancement().get(ev.id);
    return a ? a.brouillons + a.soumises : 0;
  }

  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void {
    this.info.set(m);
    clearTimeout(this.minuteurInfo);
    this.minuteurInfo = setTimeout(() => this.info.set(''), 4000);
  }
}
