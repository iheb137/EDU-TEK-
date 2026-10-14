import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Compteurs } from '../compteurs';
import { Notification, estNotificationMessage } from '../modeles';

type Filtre = 'toutes' | 'non-lues';
const TAILLE = 15;

/** Liste complète des notifications du compte connecté. */
@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  templateUrl: './notifications.html',
  styleUrls: ['../../../shared/ui.scss', './notifications.scss'],
})
export class Notifications {
  private readonly http = inject(HttpClient);
  private readonly compteurs = inject(Compteurs);

  protected readonly toutes = signal<Notification[] | null>(null);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly filtre = signal<Filtre>('toutes');
  protected readonly numero = signal(0);
  protected readonly traitement = signal<number | null>(null);
  protected readonly enCours = signal(false);

  protected readonly date = dateHeureFr;
  protected readonly versMessagerie = estNotificationMessage;

  protected readonly nonLues = computed(() => (this.toutes() ?? []).filter((n) => !n.lue).length);
  protected readonly filtrees = computed(() => (this.toutes() ?? []).filter((n) => this.filtre() === 'toutes' || !n.lue));
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.filtrees().length / TAILLE)));
  protected readonly visibles = computed(() => this.filtrees().slice(this.numero() * TAILLE, (this.numero() + 1) * TAILLE));

  private premiere = true;

  constructor() {
    // Recharge quand la cloche (ou une autre page) modifie les notifications.
    effect(() => {
      this.compteurs.versionNotifications();
      if (this.premiere) { this.premiere = false; untracked(() => this.charger()); return; }
      if (!untracked(this.enCours) && untracked(this.traitement) === null) { untracked(() => this.charger()); }
    });
  }

  protected charger(): void {
    this.http.get<Notification[]>(`${API_URL}/notifications`).subscribe({
      next: (l) => {
        this.toutes.set([...(l ?? [])].sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? '')));
        this.erreur.set('');
        if (this.numero() >= this.pages()) { this.numero.set(this.pages() - 1); }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); if (!this.toutes()) { this.toutes.set([]); } },
    });
  }

  protected filtrer(f: Filtre): void { this.filtre.set(f); this.numero.set(0); }
  protected aller(d: number): void { this.numero.update((n) => n + d); }

  protected marquer(n: Notification): void {
    if (n.lue) { return; }
    this.traitement.set(n.id);
    this.http.patch<Notification>(`${API_URL}/notifications/${n.id}/lue`, null).subscribe({
      next: () => {
        this.toutes.update((l) => (l ?? []).map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
        this.traitement.set(null);
        if (this.numero() >= this.pages()) { this.numero.set(this.pages() - 1); }
        this.compteurs.rafraichirNotifications();
      },
      error: (e: unknown) => { this.traitement.set(null); this.erreur.set(Auth.message(e)); },
    });
  }

  protected toutLire(): void {
    this.enCours.set(true);
    this.http.post(`${API_URL}/notifications/tout-lire`, null).subscribe({
      next: () => {
        const n = this.nonLues();
        this.toutes.update((l) => (l ?? []).map((x) => ({ ...x, lue: true })));
        this.numero.set(0);
        this.enCours.set(false);
        this.compteurs.notifications.set(0);
        this.compteurs.rafraichirNotifications();
        this.confirmer(`${n} notification${n > 1 ? 's' : ''} marquée${n > 1 ? 's' : ''} comme lue${n > 1 ? 's' : ''}.`);
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreur.set(Auth.message(e)); },
    });
  }

  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
