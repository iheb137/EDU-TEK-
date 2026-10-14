import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { ClasseVirtuelle, PLATEFORMES, SupportCours, TYPES_SUPPORT, libelle } from '../modeles';

const ICONES_SUPPORT: Record<string, string> = { PDF: 'document-text', VIDEO: 'videocam', DOCUMENT: 'document', LIEN: 'link', AUTRE: 'folder-open' };

/** Classes virtuelles de l'étudiant (liens de connexion) et supports de cours associés. */
@Component({
  selector: 'app-mes-classes-virtuelles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Modal],
  templateUrl: './mes-classes-virtuelles.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss', './mes-classes-virtuelles.scss'],
})
export class MesClassesVirtuelles {
  private readonly http = inject(HttpClient);

  protected readonly avenir = signal(true);
  protected readonly liste = signal<ClasseVirtuelle[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly cible = signal<ClasseVirtuelle | null>(null);
  protected readonly supports = signal<SupportCours[] | null>(null);
  protected readonly erreurSupports = signal('');
  protected readonly maintenant = signal(Date.now());

  /** À venir : la plus proche d'abord ; toutes : la plus récente d'abord. */
  protected readonly triees = computed(() => {
    const l = [...this.liste()];
    const sens = this.avenir() ? 1 : -1;
    return l.sort((a, b) => sens * (a.dateHeure ?? '').localeCompare(b.dateHeure ?? ''));
  });

  constructor() { this.charger(); }

  protected basculer(avenir: boolean): void { this.avenir.set(avenir); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<ClasseVirtuelle[]>(`${API_URL}/classes-virtuelles/mes-classes`, { params: { avenir: this.avenir() } }).subscribe({
      next: (l) => { this.liste.set(l); this.maintenant.set(Date.now()); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected ouvrirSupports(c: ClasseVirtuelle): void {
    this.cible.set(c);
    this.supports.set(null);
    this.erreurSupports.set('');
    this.http.get<SupportCours[]>(`${API_URL}/classes-virtuelles/${c.id}/supports`).subscribe({
      next: (s) => this.supports.set([...s].sort((a, b) => (b.dateDepot ?? '').localeCompare(a.dateDepot ?? ''))),
      error: (e: unknown) => { this.supports.set([]); this.erreurSupports.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.cible.set(null); }
  protected passee(c: ClasseVirtuelle): boolean { return !!c.dateHeure && new Date(c.dateHeure).getTime() < this.maintenant(); }
  protected plateforme(p: string): string { return libelle(PLATEFORMES, p); }
  protected typeSupport(t: string): string { return libelle(TYPES_SUPPORT, t); }
  protected iconeSupport(t: string): string { return ICONES_SUPPORT[t] ?? 'document'; }
  protected jour(iso?: string): string { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit' }) : ''; }
  protected mois(iso?: string): string { return iso ? new Date(iso).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : ''; }
  protected quand(iso?: string): string {
    return iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ') : 'Date à préciser';
  }
  protected readonly dateHeure = dateHeureFr;
}
