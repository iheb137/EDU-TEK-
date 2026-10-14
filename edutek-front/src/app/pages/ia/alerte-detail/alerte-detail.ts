import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Echelle } from '../commun/echelle';
import { Facteurs } from '../commun/facteurs';
import { IaApi } from '../ia-api';
import {
  ACTION_STATUT_ALERTE, ICONE_TYPE_ACTION, TRANSITIONS_ACTION, TRANSITIONS_ALERTE, TYPES_ACTION,
  libelleNiveau, libelleStatutAction, libelleStatutAlerte, libelleTypeAction, pourcentScore,
} from '../libelles';
import {
  ActionAccompagnement, AlerteIa, AvisPrediction, ParametresRisque, Prediction, SemestreRef, StatutAction, StatutAlerte, TypeAction,
} from '../modeles';

type Fenetre = null | 'statut' | 'action' | 'statut-action';

/** Détail d'une alerte : synthèse, explication du score, plan d'accompagnement et avis de l'équipe. */
@Component({
  selector: 'app-alerte-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Icon, Modal, Echelle, Facteurs],
  templateUrl: './alerte-detail.html',
  styleUrls: ['../../../shared/ui.scss', '../ia.scss', './alerte-detail.scss'],
})
export class AlerteDetail {
  private readonly api = inject(IaApi);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly peutGerer = inject(Auth).a('ADMIN_PEDAGOGIQUE');

  protected readonly libelleNiveau = libelleNiveau;
  protected readonly libelleStatut = libelleStatutAlerte;
  protected readonly libelleStatutAction = libelleStatutAction;
  protected readonly libelleType = libelleTypeAction;
  protected readonly iconeType = (t: string) => ICONE_TYPE_ACTION[t] ?? 'clipboard';
  protected readonly pourcent = pourcentScore;
  protected readonly date = dateFr;
  protected readonly dateHeure = dateHeureFr;
  protected readonly typesAction = TYPES_ACTION;
  protected readonly actionStatut = ACTION_STATUT_ALERTE;

  protected readonly id = signal(0);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly alerte = signal<AlerteIa | null>(null);
  protected readonly prediction = signal<Prediction | null>(null);
  protected readonly erreurPrediction = signal('');
  protected readonly actions = signal<ActionAccompagnement[] | null>(null);
  protected readonly erreurActions = signal('');
  protected readonly avis = signal<AvisPrediction[] | null>(null);
  protected readonly erreurAvis = signal('');
  protected readonly parametres = signal<ParametresRisque | null>(null);
  protected readonly semestres = signal<SemestreRef[]>([]);

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly statutCible = signal<StatutAlerte | null>(null);
  protected readonly actionCible = signal<ActionAccompagnement | null>(null);
  protected readonly envoiAvis = signal(false);
  protected readonly erreurFormAvis = signal('');
  protected readonly choixAvis = signal<boolean | null>(null);

  protected readonly formAction = this.fb.nonNullable.group({
    type: ['ENTRETIEN' as TypeAction, Validators.required],
    description: ['', [Validators.required, Validators.maxLength(1000), Validators.pattern(/\S/)]],
  });
  protected readonly formStatutAction = this.fb.nonNullable.group({
    statut: ['' as StatutAction | '', Validators.required],
    description: ['', Validators.maxLength(1000)],
  });
  protected readonly formAvis = this.fb.nonNullable.group({ commentaire: ['', Validators.maxLength(500)] });

  protected readonly nomSemestre = computed(() => {
    const a = this.alerte();
    return a ? this.semestres().find((s) => s.id === a.semestreId)?.nom ?? `Semestre ${a.semestreId}` : '';
  });
  protected readonly transitions = computed(() => TRANSITIONS_ALERTE[this.alerte()?.statut ?? ''] ?? []);
  protected readonly close = computed(() => {
    const s = this.alerte()?.statut;
    return s === 'TRAITEE' || s === 'CLASSEE';
  });
  protected readonly bilanAvis = computed(() => {
    const l = this.avis() ?? [];
    return { total: l.length, pertinents: l.filter((a) => a.pertinent).length };
  });
  protected readonly actionsOuvertes = computed(() => (this.actions() ?? []).filter((a) => a.statut === 'PLANIFIEE' || a.statut === 'EN_COURS').length);

  constructor() {
    this.api.semestres().subscribe({ next: (l) => this.semestres.set(l), error: () => this.semestres.set([]) });
    this.api.parametres().subscribe({ next: (p) => this.parametres.set(p), error: () => this.parametres.set(null) });
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.id.set(Number(p.get('id')));
      this.charger();
    });
  }

  // ── Chargement ─────────────────────────────────────────────────────────
  private charger(): void {
    const id = this.id();
    this.chargement.set(true);
    this.erreur.set('');
    this.alerte.set(null);
    this.prediction.set(null);
    this.actions.set(null);
    this.avis.set(null);
    if (!Number.isFinite(id) || id <= 0) { this.erreur.set('Identifiant d\'alerte invalide.'); this.chargement.set(false); return; }
    this.api.alerte(id).subscribe({
      next: (a) => {
        this.alerte.set(a);
        this.chargement.set(false);
        this.chargerPrediction(a.predictionId);
        this.chargerActions();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  private chargerPrediction(predictionId: number): void {
    this.erreurPrediction.set('');
    this.api.prediction(predictionId).subscribe({
      next: (p) => this.prediction.set(p),
      error: (e: unknown) => this.erreurPrediction.set(Auth.message(e)),
    });
    this.erreurAvis.set('');
    this.api.avis(predictionId).subscribe({
      next: (l) => this.avis.set(l),
      error: (e: unknown) => { this.avis.set([]); this.erreurAvis.set(Auth.message(e)); },
    });
  }

  private chargerActions(): void {
    this.erreurActions.set('');
    this.api.actions(this.id()).subscribe({
      next: (l) => this.actions.set(l),
      error: (e: unknown) => { this.actions.set([]); this.erreurActions.set(Auth.message(e)); },
    });
  }

  private rechargerAlerte(): void {
    this.api.alerte(this.id()).subscribe({ next: (a) => this.alerte.set(a), error: () => undefined });
  }

  // ── Statut de l'alerte ────────────────────────────────────────────────
  protected demanderStatut(s: StatutAlerte): void {
    this.statutCible.set(s);
    this.erreurFenetre.set('');
    this.fenetre.set('statut');
  }

  protected confirmerStatut(): void {
    const s = this.statutCible();
    if (!s || this.enCours()) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.api.changerStatutAlerte(this.id(), s).subscribe({
      next: (a) => {
        this.enCours.set(false);
        this.alerte.set(a);
        this.fermer();
        this.confirmer(`Statut de l'alerte mis à jour : ${libelleStatutAlerte(a.statut)}.`);
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Actions d'accompagnement ──────────────────────────────────────────
  protected ouvrirCreationAction(): void {
    this.formAction.reset({ type: 'ENTRETIEN', description: '' });
    this.erreurFenetre.set('');
    this.fenetre.set('action');
  }

  protected creerAction(): void {
    this.formAction.markAllAsTouched();
    if (this.formAction.invalid || this.enCours()) { return; }
    const v = this.formAction.getRawValue();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.api.creerAction(this.id(), v.type, v.description.trim()).subscribe({
      next: (a) => {
        this.enCours.set(false);
        this.fermer();
        this.actions.update((l) => [a, ...(l ?? [])]);
        this.confirmer(`Action ajoutée au plan d'accompagnement : ${libelleTypeAction(a.type)}.`);
        this.rechargerAlerte();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected transitionsAction(a: ActionAccompagnement): StatutAction[] { return TRANSITIONS_ACTION[a.statut] ?? []; }

  protected ouvrirStatutAction(a: ActionAccompagnement): void {
    this.actionCible.set(a);
    this.formStatutAction.reset({ statut: this.transitionsAction(a)[0] ?? '', description: a.description ?? '' });
    this.erreurFenetre.set('');
    this.fenetre.set('statut-action');
  }

  protected enregistrerStatutAction(): void {
    const a = this.actionCible();
    this.formStatutAction.markAllAsTouched();
    if (!a || this.formStatutAction.invalid || this.enCours()) { return; }
    const v = this.formStatutAction.getRawValue();
    const description = v.description.trim();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.api.changerStatutAction(a.id, v.statut as StatutAction, description && description !== a.description ? description : undefined).subscribe({
      next: (maj) => {
        this.enCours.set(false);
        this.fermer();
        this.actions.update((l) => (l ?? []).map((x) => (x.id === maj.id ? maj : x)));
        this.confirmer(`Action « ${libelleTypeAction(maj.type)} » : ${libelleStatutAction(maj.statut).toLowerCase()}.`);
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Avis sur la prédiction ────────────────────────────────────────────
  protected envoyerAvis(): void {
    const a = this.alerte();
    const pertinent = this.choixAvis();
    if (!a || this.envoiAvis()) { return; }
    if (pertinent === null) { this.erreurFormAvis.set('Indiquez si le signalement vous paraît pertinent.'); return; }
    if (this.formAvis.invalid) { return; }
    this.envoiAvis.set(true);
    this.erreurFormAvis.set('');
    this.api.donnerAvis(a.predictionId, pertinent, this.formAvis.getRawValue().commentaire).subscribe({
      next: (f) => {
        this.envoiAvis.set(false);
        this.avis.update((l) => [f, ...(l ?? [])]);
        this.choixAvis.set(null);
        this.formAvis.reset({ commentaire: '' });
        this.confirmer('Votre avis a été enregistré.');
      },
      error: (e: unknown) => { this.envoiAvis.set(false); this.erreurFormAvis.set(Auth.message(e)); },
    });
  }

  protected choisirAvis(v: boolean): void { this.choixAvis.set(v); this.erreurFormAvis.set(''); }

  // ── Divers ────────────────────────────────────────────────────────────
  protected fermer(): void { this.fenetre.set(null); this.actionCible.set(null); this.statutCible.set(null); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
