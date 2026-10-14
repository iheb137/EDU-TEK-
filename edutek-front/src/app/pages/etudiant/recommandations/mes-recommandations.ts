import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { EspaceEtudiant } from '../espace-etudiant';
import { CATEGORIES_RECOMMANDATION, Recommandation, SemestreDto, libelle } from '../modeles';
import { confirmerPendant } from '../outils';

const ICONES: Record<string, string> = { ASSIDUITE: 'time', MATIERES_A_RATTRAPER: 'book', RESULTATS: 'stats-chart', PROGRESSION: 'trending-up', SUIVI: 'people' };
const COULEURS: Record<string, string> = { ASSIDUITE: '#d98a00', MATIERES_A_RATTRAPER: '#d6453a', RESULTATS: '#3d5bd6', PROGRESSION: '#1f9d78', SUIVI: '#6a4fc9' };

/** Recommandations personnalisées produites par le suivi pédagogique. */
@Component({
  selector: 'app-mes-recommandations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './mes-recommandations.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss', './mes-recommandations.scss'],
})
export class MesRecommandations {
  private readonly http = inject(HttpClient);
  private readonly espace = inject(EspaceEtudiant);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly semestres = signal<SemestreDto[]>([]);
  protected readonly liste = signal<Recommandation[]>([]);
  protected readonly semestreId = signal<number | null>(null);
  protected readonly nonLuesSeules = signal(false);
  protected readonly traitement = signal<number | 'toutes' | null>(null);

  protected readonly affichees = computed(() => this.liste()
    .filter((r) => this.semestreId() === null || r.semestreId === this.semestreId())
    .filter((r) => !this.nonLuesSeules() || !r.lue));
  protected readonly nonLues = computed(() => this.liste().filter((r) => !r.lue).length);
  protected readonly nonLuesAffichees = computed(() => this.affichees().filter((r) => !r.lue));

  constructor() {
    forkJoin({ semestres: this.espace.semestres(), liste: this.http.get<Recommandation[]>(`${API_URL}/recommandations/mes-recommandations`) }).subscribe({
      next: ({ semestres, liste }) => { this.semestres.set(semestres); this.liste.set(liste); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected filtrerSemestre(v: string): void { this.semestreId.set(v ? Number(v) : null); }

  protected marquer(r: Recommandation): void {
    this.traitement.set(r.id);
    this.erreur.set('');
    this.http.patch<Recommandation>(`${API_URL}/recommandations/${r.id}/lue`, null).subscribe({
      next: (maj) => { this.traitement.set(null); this.remplacer(maj ?? { ...r, lue: true }); },
      error: (e: unknown) => { this.traitement.set(null); this.erreur.set(Auth.message(e)); },
    });
  }

  protected toutMarquer(): void {
    const cibles = this.nonLuesAffichees();
    if (!cibles.length) { return; }
    this.traitement.set('toutes');
    this.erreur.set('');
    forkJoin(cibles.map((r) => this.http.patch<Recommandation>(`${API_URL}/recommandations/${r.id}/lue`, null))).subscribe({
      next: (majs) => {
        this.traitement.set(null);
        majs.forEach((m, i) => this.remplacer(m ?? { ...cibles[i], lue: true }));
        confirmerPendant((m) => this.info.set(m), `${cibles.length} recommandation${cibles.length > 1 ? 's' : ''} marquée${cibles.length > 1 ? 's' : ''} comme lue${cibles.length > 1 ? 's' : ''}.`);
      },
      error: (e: unknown) => { this.traitement.set(null); this.erreur.set(Auth.message(e)); this.recharger(); },
    });
  }

  private recharger(): void {
    this.http.get<Recommandation[]>(`${API_URL}/recommandations/mes-recommandations`).subscribe({ next: (l) => this.liste.set(l), error: () => undefined });
  }

  private remplacer(r: Recommandation): void { this.liste.update((l) => l.map((x) => (x.id === r.id ? r : x))); }

  protected categorie(c: string): string { return libelle(CATEGORIES_RECOMMANDATION, c); }
  protected icone(c: string): string { return ICONES[c] ?? 'bulb'; }
  protected couleur(c: string): string { return COULEURS[c] ?? '#3d5bd6'; }
  protected nomSemestre(id: number): string { return this.semestres().find((s) => s.id === id)?.nom ?? ''; }
  protected readonly date = dateFr;
}
