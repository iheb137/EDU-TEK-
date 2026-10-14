import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_URL } from '../../core/config';

const PERIODE_MS = 60_000;

/**
 * Compteurs de non-lus partagés (cloche, compteur de messages, pages).
 * Un seul rafraîchissement périodique (60 s) tant qu'au moins un composant l'utilise.
 */
@Injectable({ providedIn: 'root' })
export class Compteurs {
  private readonly http = inject(HttpClient);

  readonly messages = signal(0);
  readonly notifications = signal(0);
  /** Incrémenté à chaque changement de notifications (pour que la cloche recharge sa liste si elle est ouverte). */
  readonly versionNotifications = signal(0);

  private abonnes = 0;
  private minuteur: ReturnType<typeof setInterval> | undefined;

  /** Démarre le rafraîchissement périodique ; renvoie la fonction d'arrêt. */
  suivre(): () => void {
    this.abonnes++;
    if (this.abonnes === 1) {
      this.rafraichir();
      this.minuteur = setInterval(() => this.rafraichir(), PERIODE_MS);
    }
    return () => {
      this.abonnes = Math.max(0, this.abonnes - 1);
      if (!this.abonnes) { clearInterval(this.minuteur); this.minuteur = undefined; }
    };
  }

  rafraichir(): void { this.rafraichirMessages(); this.rafraichirNotifications(); }

  rafraichirMessages(): void {
    this.http.get<{ nonLus?: number }>(`${API_URL}/messages/non-lus/count`).subscribe({
      next: (r) => this.messages.set(Number(r?.nonLus ?? 0)),
      error: () => { /* compteur indisponible : on garde la dernière valeur */ },
    });
  }

  rafraichirNotifications(): void {
    this.http.get<{ nonLues?: number }>(`${API_URL}/notifications/non-lues/count`).subscribe({
      next: (r) => this.notifications.set(Number(r?.nonLues ?? 0)),
      error: () => { /* idem */ },
    });
  }

  /** À appeler après une action qui change l'état des notifications. */
  notificationsModifiees(): void {
    this.versionNotifications.update((v) => v + 1);
    this.rafraichirNotifications();
  }
}
