import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { API_URL } from '../../core/config';
import { estPedagogie } from '../../core/menu';
import { Alerte, Semestre, TableauDeBordDto } from '../../core/modeles';
import { Icon } from '../../shared/icon/icon';
import { libelleFacteur } from '../ia/libelles';

type Etat = 'chargement' | 'pret' | 'sans-semestre' | 'sans-analyse' | 'erreur';

const LIBELLE_NIVEAU: Record<string, string> = { ELEVE: 'ÉLEVÉ', MOYEN: 'MOYEN', FAIBLE: 'FAIBLE' };
const LIBELLE_STATUT: Record<string, string> = { OUVERTE: 'Ouverte', EN_COURS: 'En cours', TRAITEE: 'Traitée', CLASSEE: 'Classée' };

/** Tableau de bord du responsable pédagogique, alimenté par /api/ia/tableau-de-bord. */
@Component({
  selector: 'app-tableau-de-bord',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './tableau-de-bord.html',
  styleUrl: './tableau-de-bord.scss',
})
export class TableauDeBord {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(Auth);

  protected readonly pedagogie = estPedagogie(this.auth.session()?.roles ?? []);
  protected readonly etat = signal<Etat>('chargement');
  protected readonly erreur = signal('');
  protected readonly semestres = signal<Semestre[]>([]);
  protected readonly semestreId = signal<number | null>(null);
  protected readonly donnees = signal<TableauDeBordDto | null>(null);
  protected readonly alertes = signal<Alerte[]>([]);
  protected readonly analyse = signal(false);

  protected readonly semestre = computed(() => this.semestres().find((s) => s.id === this.semestreId()) ?? null);

  protected readonly indicateurs = computed(() => {
    const d = this.donnees();
    if (!d) { return []; }
    return [
      { titre: 'Étudiants analysés', valeur: String(d.nbEtudiantsAnalyses), note: `${d.parClasse.length} classe${d.parClasse.length > 1 ? 's' : ''}`, couleur: '#3d5bd6', icone: 'people' },
      { titre: 'Alertes ouvertes', valeur: String(d.alertes.ouvertes), note: `${d.repartition.eleve} étudiant${d.repartition.eleve > 1 ? 's' : ''} à risque élevé`, couleur: '#d98a00', icone: 'warning' },
      { titre: 'Probabilité moyenne', valeur: this.pourcent(d.probabiliteMoyenne), note: 'de risque d\'échec, sur la promotion', couleur: '#1f9d78', icone: 'stats-chart' },
      { titre: 'Actions en cours', valeur: String(d.actions.enCours), note: `${d.actions.planifiees} planifiée${d.actions.planifiees > 1 ? 's' : ''}`, couleur: '#d6453a', icone: 'checkmark-done' },
    ];
  });

  protected readonly niveaux = computed(() => {
    const r = this.donnees()?.repartition;
    if (!r) { return []; }
    const total = Math.max(1, r.faible + r.moyen + r.eleve);
    return [
      { nom: 'Faible', effectif: r.faible, part: (r.faible / total) * 100, couleur: '#2fb98d' },
      { nom: 'Moyen', effectif: r.moyen, part: (r.moyen / total) * 100, couleur: '#f0a01c' },
      { nom: 'Élevé', effectif: r.eleve, part: (r.eleve / total) * 100, couleur: '#e5483b' },
    ];
  });

  protected readonly facteurs = computed(() => {
    const f = this.donnees()?.facteursPrincipaux ?? [];
    const max = Math.max(1, ...f.map((x) => x.occurrences));
    return f.slice(0, 6).map((x) => ({ ...x, nom: libelleFacteur(x.nom), part: (x.occurrences / max) * 100 }));
  });

  constructor() {
    if (this.pedagogie) { this.chargerSemestres(); }
  }

  protected choisir(valeur: string): void {
    this.semestreId.set(Number(valeur));
    this.chargerDonnees();
  }

  protected lancerAnalyse(): void {
    const id = this.semestreId();
    if (id === null || this.analyse()) { return; }
    this.analyse.set(true);
    this.erreur.set('');
    this.http.post(`${API_URL}/ia/analyses`, null, { params: { semestreId: id } }).subscribe({
      next: () => { this.analyse.set(false); this.chargerDonnees(); },
      error: (e: unknown) => { this.analyse.set(false); this.erreur.set(Auth.message(e)); },
    });
  }

  private chargerSemestres(): void {
    this.http.get<Semestre[]>(`${API_URL}/semestres`).subscribe({
      next: (liste) => {
        if (!liste.length) { this.etat.set('sans-semestre'); return; }
        const tri = [...liste].sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''));
        this.semestres.set(tri);
        // Semestre en cours (aujourd'hui entre début et fin), sinon le dernier commencé, sinon le plus récent.
        const auj = new Date().toISOString().slice(0, 10);
        const courant = tri.find((s) => (s.dateDebut ?? '') <= auj && (!s.dateFin || s.dateFin >= auj))
          ?? tri.find((s) => (s.dateDebut ?? '') <= auj) ?? tri[0];
        this.semestreId.set(courant.id);
        this.chargerDonnees();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.etat.set('erreur'); },
    });
  }

  private chargerDonnees(): void {
    const id = this.semestreId();
    if (id === null) { return; }
    this.etat.set('chargement');
    this.http.get<TableauDeBordDto>(`${API_URL}/ia/tableau-de-bord`, { params: { semestreId: id } }).subscribe({
      next: (d) => {
        this.donnees.set(d);
        this.etat.set(d.nbEtudiantsAnalyses > 0 ? 'pret' : 'sans-analyse');
        this.http.get<Alerte[]>(`${API_URL}/ia/alertes`, { params: { semestreId: id } }).subscribe({
          next: (l) => this.alertes.set([...l].filter((a) => /^(OUVERT|EN_COURS)/i.test(a.statut)).sort((a, b) => b.score - a.score).slice(0, 8)),
          error: () => this.alertes.set([]),
        });
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.etat.set('erreur'); },
    });
  }

  protected libelleNiveau(n: string): string { return LIBELLE_NIVEAU[n] ?? n; }
  protected libelleStatut(s: string): string { return LIBELLE_STATUT[s] ?? s; }
  protected pourcent(p: number): string { return Math.round((p ?? 0) * 100) + ' %'; }
  protected delai(i: number, base = 0.15): string { return (base + i * 0.09).toFixed(2) + 's'; }
  protected date(iso?: string): string { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
}
