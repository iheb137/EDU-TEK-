import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr, nombreFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import {
  AlerteTechnique, Execution, LIBELLE_NIVEAU, LIBELLE_STATUT_ALERTE, LIBELLE_STATUT_EXECUTION, TRANSITIONS_ALERTE, Workflow,
} from '../modeles';

type Onglet = 'workflows' | 'executions' | 'alertes';
type Confirmation =
  | { genre: 'workflow'; workflow: Workflow }
  | { genre: 'alerte'; alerte: AlerteTechnique; statut: string };

const LIMITE_EXECUTIONS = 50;

/** Supervision technique : workflows n8n, exécutions récentes et alertes techniques (SuperAdmin). */
@Component({
  selector: 'app-supervision',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Modal],
  templateUrl: './supervision.html',
  styleUrls: ['../../../shared/ui.scss', './supervision.scss'],
})
export class Supervision {
  private readonly http = inject(HttpClient);
  protected readonly dateHeure = dateHeureFr;
  protected readonly limite = LIMITE_EXECUTIONS;
  protected readonly libelleExec = (s?: string | null) => (s ? LIBELLE_STATUT_EXECUTION[s] ?? s : 'Jamais exécuté');
  protected readonly libelleAlerte = (s: string) => LIBELLE_STATUT_ALERTE[s] ?? s;
  protected readonly libelleNiveau = (s: string) => LIBELLE_NIVEAU[s] ?? s;
  protected readonly statutsAlerte = Object.keys(LIBELLE_STATUT_ALERTE);
  protected readonly niveaux = Object.keys(LIBELLE_NIVEAU);
  protected readonly statutsExecution = Object.keys(LIBELLE_STATUT_EXECUTION);

  protected readonly onglet = signal<Onglet>('workflows');
  protected readonly info = signal('');
  protected readonly erreur = signal('');

  protected readonly workflows = signal<Workflow[] | null>(null);
  protected readonly executions = signal<Execution[] | null>(null);
  protected readonly alertes = signal<AlerteTechnique[] | null>(null);
  protected readonly chargeWf = signal(false);
  protected readonly chargeEx = signal(false);
  protected readonly chargeAl = signal(false);
  protected readonly erreurEx = signal('');
  protected readonly erreurAl = signal('');

  protected readonly filtreWorkflow = signal('');
  protected readonly filtreStatutEx = signal('');
  protected readonly filtreStatutAl = signal('');
  protected readonly filtreNiveau = signal('');
  protected readonly detail = signal<number | null>(null);

  protected readonly confirmation = signal<Confirmation | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  protected readonly nbActifs = computed(() => (this.workflows() ?? []).filter((w) => w.actif).length);
  protected readonly nbEchecs = computed(() => (this.executions() ?? []).filter((e) => e.statut === 'ECHEC').length);
  protected readonly nbOuvertes = signal(0);

  constructor() {
    this.chargerWorkflows();
    this.chargerExecutions();
    this.chargerAlertes();
    this.compterOuvertes();
  }

  // ── Chargements ─────────────────────────────────────────────────────────
  protected chargerWorkflows(): void {
    this.chargeWf.set(true);
    this.http.get<Workflow[]>(`${API_URL}/supervision/workflows`).subscribe({
      next: (l) => { this.workflows.set(l); this.erreur.set(''); this.chargeWf.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargeWf.set(false); },
    });
  }

  protected chargerExecutions(): void {
    this.chargeEx.set(true);
    let p = new HttpParams().set('limite', LIMITE_EXECUTIONS);
    if (this.filtreWorkflow()) { p = p.set('workflowId', this.filtreWorkflow()); }
    if (this.filtreStatutEx()) { p = p.set('statut', this.filtreStatutEx()); }
    this.http.get<Execution[]>(`${API_URL}/supervision/executions`, { params: p }).subscribe({
      next: (l) => { this.executions.set(l); this.erreurEx.set(''); this.chargeEx.set(false); },
      error: (e: unknown) => { this.erreurEx.set(Auth.message(e)); this.chargeEx.set(false); },
    });
  }

  protected chargerAlertes(): void {
    this.chargeAl.set(true);
    let p = new HttpParams();
    if (this.filtreStatutAl()) { p = p.set('statut', this.filtreStatutAl()); }
    if (this.filtreNiveau()) { p = p.set('niveau', this.filtreNiveau()); }
    this.http.get<AlerteTechnique[]>(`${API_URL}/supervision/alertes-techniques`, { params: p }).subscribe({
      next: (l) => { this.alertes.set(l); this.erreurAl.set(''); this.chargeAl.set(false); },
      error: (e: unknown) => { this.erreurAl.set(Auth.message(e)); this.chargeAl.set(false); },
    });
  }

  private compterOuvertes(): void {
    this.http.get<AlerteTechnique[]>(`${API_URL}/supervision/alertes-techniques`, { params: { statut: 'OUVERTE' } }).subscribe({
      next: (l) => this.nbOuvertes.set(l.length),
      error: () => { /* l'erreur est déjà signalée par la liste */ },
    });
  }

  protected actualiser(): void { this.chargerWorkflows(); this.chargerExecutions(); this.chargerAlertes(); this.compterOuvertes(); }

  protected filtrerExecutions(champ: 'workflow' | 'statut', valeur: string): void {
    (champ === 'workflow' ? this.filtreWorkflow : this.filtreStatutEx).set(valeur);
    this.chargerExecutions();
  }
  protected filtrerAlertes(champ: 'statut' | 'niveau', valeur: string): void {
    (champ === 'statut' ? this.filtreStatutAl : this.filtreNiveau).set(valeur);
    this.chargerAlertes();
  }
  protected voirExecutions(w: Workflow): void { this.filtreWorkflow.set(String(w.id)); this.filtreStatutEx.set(''); this.onglet.set('executions'); this.chargerExecutions(); }
  protected basculerDetail(id: number): void { this.detail.update((d) => (d === id ? null : id)); }

  // ── Actions ─────────────────────────────────────────────────────────────
  /** Activer un workflow est immédiat ; le désactiver demande une confirmation (les automatisations s'arrêtent). */
  protected basculerWorkflow(w: Workflow): void {
    if (w.actif) { this.erreurFenetre.set(''); this.confirmation.set({ genre: 'workflow', workflow: w }); return; }
    this.changerWorkflow(w, true);
  }

  private changerWorkflow(w: Workflow, actif: boolean): void {
    this.enCours.set(true);
    this.erreur.set('');
    this.http.patch<Workflow>(`${API_URL}/supervision/workflows/${w.id}/actif`, { actif }).subscribe({
      next: (maj) => {
        this.enCours.set(false);
        this.workflows.update((l) => l?.map((x) => (x.id === w.id ? { ...x, ...maj, actif: maj?.actif ?? actif } : x)) ?? l);
        this.confirmation.set(null);
        this.confirmer(`Workflow ${actif ? 'activé' : 'désactivé'} : ${w.nom}`);
      },
      error: (e: unknown) => {
        this.enCours.set(false);
        if (this.confirmation()) { this.erreurFenetre.set(Auth.message(e)); } else { this.erreur.set(Auth.message(e)); }
      },
    });
  }

  protected transitions(a: AlerteTechnique): string[] { return TRANSITIONS_ALERTE[a.statut] ?? []; }
  protected demanderStatut(a: AlerteTechnique, statut: string): void { this.erreurFenetre.set(''); this.confirmation.set({ genre: 'alerte', alerte: a, statut }); }

  protected valider(): void {
    const c = this.confirmation();
    if (!c) { return; }
    if (c.genre === 'workflow') { this.changerWorkflow(c.workflow, false); return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.patch<AlerteTechnique>(`${API_URL}/supervision/alertes-techniques/${c.alerte.id}/statut`, { statut: c.statut }).subscribe({
      next: () => {
        this.enCours.set(false);
        this.confirmation.set(null);
        this.confirmer(`Alerte n° ${c.alerte.id} : ${this.libelleAlerte(c.statut).toLowerCase()}.`);
        this.chargerAlertes();
        this.compterOuvertes();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Formats ─────────────────────────────────────────────────────────────
  protected duree(ms?: number | null): string {
    if (ms === null || ms === undefined) { return '—'; }
    if (ms < 1000) { return `${ms} ms`; }
    const s = ms / 1000;
    if (s < 60) { return `${nombreFr(s, 1)} s`; }
    const min = Math.floor(s / 60);
    return `${min} min ${String(Math.round(s % 60)).padStart(2, '0')} s`;
  }
  protected tauxEchec(w: Workflow): string { return w.nbExecutions ? `${Math.round((w.nbEchecs / w.nbExecutions) * 100)} %` : '—'; }
  protected classeExec(s?: string | null): string { return s === 'SUCCES' ? 'vert' : s === 'ECHEC' ? 'rouge' : s === 'EN_COURS' ? 'orange' : 'gris'; }
  protected classeNiveau(n: string): string { return n === 'CRITIQUE' ? 'rouge' : n === 'ELEVE' ? 'orange' : n === 'MOYEN' ? '' : 'gris'; }
  protected classeAlerte(s: string): string { return s === 'OUVERTE' ? 'rouge' : s === 'ACQUITTEE' ? 'orange' : 'vert'; }
  protected libelleTransition(s: string): string { return s === 'ACQUITTEE' ? 'Acquitter' : s === 'RESOLUE' ? 'Marquer résolue' : s; }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
