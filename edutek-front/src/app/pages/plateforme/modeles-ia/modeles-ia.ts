import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { nombreFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import {
  ClasseCourte, EvaluationModele, EvaluationResultat, LIBELLE_SOURCE, LIBELLE_STATUT_MODELE, LIBELLE_TYPE_MODELE, ModeleIa,
  SemestreCourt, SourceDonnees, TRANSITIONS_MODELE, sourceDonnees,
} from '../modeles';

type Fenetre = null | 'statut' | 'reentrainer' | 'enregistrer';
type CleMetrique = 'auc' | 'f1' | 'precision' | 'rappel' | 'exactitude' | 'brier';

interface SemestreDate extends SemestreCourt { dateFin?: string; }

/** Lignes du tableau comparatif : `inverse` = plus la valeur est basse, meilleur est le modèle. */
const METRIQUES: { cle: CleMetrique; libelle: string; aide: string; inverse?: boolean }[] = [
  { cle: 'auc', libelle: 'AUC', aide: 'Capacité à classer les étudiants à risque avant les autres (1 = parfait, 0,5 = hasard).' },
  { cle: 'f1', libelle: 'Score F1', aide: 'Équilibre entre précision et rappel au seuil choisi.' },
  { cle: 'precision', libelle: 'Précision', aide: 'Part des alertes émises qui concernent un étudiant réellement en échec.' },
  { cle: 'rappel', libelle: 'Rappel', aide: 'Part des étudiants réellement en échec qui ont été signalés.' },
  { cle: 'exactitude', libelle: 'Exactitude', aide: 'Part des étudiants correctement classés (trompeuse si les échecs sont rares).' },
  { cle: 'brier', libelle: 'Score de Brier', aide: 'Erreur moyenne des probabilités annoncées (0 = parfait).', inverse: true },
];

/** Cycle de vie des modèles d'IA : registre, évaluation comparée sur données réelles, statut, ré-entraînement (SuperAdmin). */
@Component({
  selector: 'app-modeles-ia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './modeles-ia.html',
  styleUrls: ['../../../shared/ui.scss', './modeles-ia.scss'],
})
export class ModelesIa {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  protected readonly metriques = METRIQUES;
  protected readonly typesEnregistrables = ['DEEP_LEARNING', 'BASELINE', 'AUTRE'];
  protected readonly libelleStatut = (s: string) => LIBELLE_STATUT_MODELE[s] ?? s;
  protected readonly libelleType = (t: string) => LIBELLE_TYPE_MODELE[t] ?? t;
  protected readonly source = sourceDonnees;
  protected readonly libelleSource = (s: SourceDonnees) => LIBELLE_SOURCE[s];

  // Registre
  protected readonly modeles = signal<ModeleIa[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly synthetiques = computed(() => (this.modeles() ?? []).filter((m) => sourceDonnees(m) === 'SYNTHETIQUE'));
  protected readonly enProduction = computed(() => (this.modeles() ?? []).find((m) => m.statut === 'EN_PRODUCTION') ?? null);

  // Évaluation
  protected readonly semestres = signal<SemestreDate[]>([]);
  protected readonly semestresCharges = signal(false);
  protected readonly classes = signal<ClasseCourte[]>([]);
  protected readonly semestreId = signal<number | null>(null);
  protected readonly classeId = signal<string>('');
  protected readonly seuil = signal<string>('');
  protected readonly evaluation = signal<EvaluationResultat | null>(null);
  protected readonly chargeEval = signal(false);
  protected readonly erreurEval = signal('');
  protected readonly parModele = computed(() => new Map((this.evaluation()?.modeles ?? []).map((e) => [e.modele.id, e])));
  protected readonly nomSemestre = computed(() => this.semestres().find((s) => s.id === this.evaluation()?.semestreId)?.nom ?? '');

  // Fenêtres
  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly cible = signal<{ modele: ModeleIa; statut: string; libelle: string } | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly indisponible = signal(false);
  /** 501 : le service d'IA en place ne sait pas entraîner ; réessayer ne servirait à rien. */
  protected readonly nonPrisEnCharge = signal(false);
  protected readonly resultatEntrainement = signal<ModeleIa | null>(null);

  protected readonly formulaire = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    version: ['', [Validators.required, Validators.maxLength(50)]],
    type: ['DEEP_LEARNING', Validators.required],
  });

  constructor() {
    this.charger();
    this.http.get<SemestreDate[]>(`${API_URL}/semestres`).subscribe({
      next: (l) => {
        this.semestres.set(l);
        this.semestresCharges.set(true);
        // Par défaut : le dernier semestre terminé (l'évaluation n'est fiable que sur un semestre clos).
        const aujourdhui = new Date().toISOString().slice(0, 10);
        const termines = l.filter((s) => s.dateFin && s.dateFin <= aujourdhui);
        const choix = termines.at(-1) ?? l[0];
        if (choix) { this.semestreId.set(choix.id); this.evaluer(); }
      },
      error: (e: unknown) => this.erreurEval.set(Auth.message(e)),
    });
    this.http.get<ClasseCourte[]>(`${API_URL}/classes`).subscribe({ next: (l) => this.classes.set(l), error: () => { /* filtre facultatif */ } });
  }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<ModeleIa[]>(`${API_URL}/ia/modeles`).subscribe({
      next: (l) => { this.modeles.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  // ── Évaluation comparée ─────────────────────────────────────────────────
  protected evaluer(): void {
    const s = this.semestreId();
    if (!s) { return; }
    const brut = this.seuil().trim().replace(',', '.');
    const seuil = brut ? Number(brut) : null;
    if (seuil !== null && (Number.isNaN(seuil) || seuil <= 0 || seuil >= 1)) { this.erreurEval.set('Le seuil doit être compris entre 0 et 1 (par exemple 0,4).'); return; }
    let p = new HttpParams().set('semestreId', s);
    if (this.classeId()) { p = p.set('classeId', this.classeId()); }
    if (seuil !== null) { p = p.set('seuil', seuil); }
    this.chargeEval.set(true);
    this.erreurEval.set('');
    this.http.get<EvaluationResultat>(`${API_URL}/ia/modeles/evaluation`, { params: p }).subscribe({
      next: (r) => { this.evaluation.set(r); this.chargeEval.set(false); },
      error: (e: unknown) => { this.erreurEval.set(Auth.message(e)); this.chargeEval.set(false); },
    });
  }

  protected valeur(e: EvaluationModele, cle: CleMetrique): number | null { return e[cle] ?? null; }
  /** Meilleure valeur de la ligne (mise en évidence quand plusieurs modèles sont comparés). */
  protected meilleur(cle: CleMetrique, inverse = false): number | null {
    const v = (this.evaluation()?.modeles ?? []).map((e) => e[cle]).filter((x): x is number => x !== null && x !== undefined);
    if (v.length < 2) { return null; }
    return inverse ? Math.min(...v) : Math.max(...v);
  }
  protected fmt(v: number | null | undefined): string { return v === null || v === undefined ? '—' : nombreFr(v, 3); }
  protected largeur(v: number | null | undefined): number { return v === null || v === undefined ? 0 : Math.max(0, Math.min(1, v)) * 100; }

  // ── Statut ──────────────────────────────────────────────────────────────
  protected transitions(m: ModeleIa) { return TRANSITIONS_MODELE[m.statut] ?? []; }

  protected demanderStatut(m: ModeleIa, statut: string, libelle: string): void {
    this.cible.set({ modele: m, statut, libelle });
    this.erreurFenetre.set('');
    this.fenetre.set('statut');
  }

  protected confirmerStatut(): void {
    const c = this.cible();
    if (!c) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.put<ModeleIa>(`${API_URL}/ia/modeles/${c.modele.id}/statut`, { statut: c.statut }).subscribe({
      next: (maj) => {
        this.enCours.set(false);
        // Mise à jour immédiate (une seule version en production à la fois), puis rechargement.
        const statut = maj?.statut ?? c.statut;
        this.modeles.update((l) => l?.map((m) => m.id === c.modele.id ? { ...m, statut }
          : statut === 'EN_PRODUCTION' && m.statut === 'EN_PRODUCTION' ? { ...m, statut: 'ENTRAINE' } : m) ?? l);
        this.fermer();
        this.confirmer(`${c.modele.nom} ${c.modele.version} : ${this.libelleStatut(c.statut).toLowerCase()}.`);
        this.charger();
        this.evaluer();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(this.messageIa(e)); },
    });
  }

  // ── Ré-entraînement ─────────────────────────────────────────────────────
  protected ouvrirReentrainement(): void {
    this.erreurFenetre.set('');
    this.indisponible.set(false);
    this.nonPrisEnCharge.set(false);
    this.resultatEntrainement.set(null);
    this.fenetre.set('reentrainer');
  }

  protected reentrainer(): void {
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.indisponible.set(false);
    this.http.post<ModeleIa>(`${API_URL}/ia/modeles/reentrainer`, null).subscribe({
      next: (m) => { this.enCours.set(false); this.resultatEntrainement.set(m); this.charger(); },
      error: (e: unknown) => {
        this.enCours.set(false);
        const statut = e instanceof HttpErrorResponse ? e.status : 0;
        this.indisponible.set([0, 501, 502, 503, 504].includes(statut));
        this.nonPrisEnCharge.set(statut === 501);
        this.erreurFenetre.set(this.messageIa(e));
      },
    });
  }

  // ── Enregistrement ──────────────────────────────────────────────────────
  protected ouvrirEnregistrement(): void {
    this.formulaire.reset({ nom: '', version: '', type: 'DEEP_LEARNING' });
    this.erreurFenetre.set('');
    this.fenetre.set('enregistrer');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<ModeleIa>(`${API_URL}/ia/modeles`, { nom: v.nom.trim(), version: v.version.trim(), type: v.type }).subscribe({
      next: (m) => { this.enCours.set(false); this.fermer(); this.confirmer(`Modèle enregistré : ${m?.nom ?? v.nom} ${m?.version ?? v.version} (statut « entraîné »).`); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Divers ──────────────────────────────────────────────────────────────
  /** Messages d'erreur du service IA rendus explicites (indisponible, délai dépassé, non pris en charge). */
  private messageIa(e: unknown): string {
    const base = Auth.message(e);
    if (!(e instanceof HttpErrorResponse)) { return base; }
    if (e.status === 501) { return `Le service d'IA actuel ne sait pas ré-entraîner de modèle : ${base}`; }
    if (e.status === 503) { return `Le service d'IA est indisponible pour le moment : ${base}`; }
    if (e.status === 504) { return 'Le service d\'IA n\'a pas répondu à temps. L\'entraînement continue peut-être : actualisez le registre dans quelques minutes.'; }
    if (e.status === 502) { return `Le service d'IA a renvoyé une réponse invalide : ${base}`; }
    return base;
  }
  protected fermer(): void { if (!this.enCours()) { this.fenetre.set(null); } }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
