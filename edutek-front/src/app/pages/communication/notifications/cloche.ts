import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { Icon } from '../../../shared/icon/icon';
import { Compteurs } from '../compteurs';
import { Notification, dateCourte, estNotificationMessage } from '../modeles';

const NB_APERCU = 8;

/** Cloche de l'en-tête : pastille des notifications non lues et menu des dernières notifications. */
@Component({
  selector: 'app-cloche-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  host: { '(document:click)': 'clicExterieur($event)', '(document:keydown.escape)': 'ouvert.set(false)' },
  template: `
    <button class="bouton-icone" type="button" (click)="basculer()" [attr.aria-expanded]="ouvert()" aria-haspopup="true"
            [attr.aria-label]="libelle()" [title]="libelle()">
      <app-icon nom="notifications" [taille]="22" />
      @if (compteurs.notifications() > 0) { <span class="pastille" aria-hidden="true">{{ pastille() }}</span> }
    </button>
    @if (ouvert()) {
      <div class="panneau" role="region" aria-label="Dernières notifications">
        <div class="tete">
          <strong>Notifications</strong>
          <button class="lien-btn" type="button" [disabled]="!compteurs.notifications() || enCours()" (click)="toutLire()">Tout marquer comme lu</button>
        </div>
        @if (erreur()) { <p class="erreur" role="alert">{{ erreur() }}</p> }
        @if (chargement() && !liste().length) {
          <p class="etat">Chargement…</p>
        } @else if (!liste().length) {
          <p class="etat">Aucune notification pour le moment.</p>
        } @else {
          <ul>
            @for (n of liste(); track n.id) {
              <li>
                <button type="button" class="element" [class.non-lue]="!n.lue" (click)="ouvrir(n)">
                  <span class="point" aria-hidden="true"></span>
                  <span class="texte">
                    <span class="titre">{{ n.titre }}</span>
                    <span class="contenu">{{ n.contenu }}</span>
                    <span class="date">{{ date(n.dateEnvoi) }}@if (!n.lue) { <span class="visuel-cache"> · non lue</span> }</span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
        <a class="tout" routerLink="/notifications" (click)="ouvert.set(false)">Voir toutes les notifications <app-icon nom="arrow-forward" [taille]="16" /></a>
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .bouton-icone { position: relative; width: 40px; height: 40px; border-radius: 10px; border: 0; cursor: pointer; color: #fff;
      background: rgb(255 255 255 / 7%); display: flex; align-items: center; justify-content: center; transition: background .2s;
      &:hover, &[aria-expanded='true'] { background: rgb(255 255 255 / 14%); } }
    .pastille { position: absolute; top: 3px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; box-sizing: border-box;
      background: #ff6b5e; color: #fff; font-size: 10.5px; font-weight: 800; line-height: 18px; text-align: center; box-shadow: 0 0 0 2px var(--navy-800); }
    .panneau { position: absolute; right: 0; top: calc(100% + 8px); width: 380px; max-width: calc(100vw - 24px); z-index: 50;
      background: #fff; color: var(--ink); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 18px 40px rgb(7 21 51 / 22%);
      animation: fade .16s ease both; overflow: hidden; }
    .tete { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px 12px; border-bottom: 1px solid var(--line);
      strong { font-size: 15px; } }
    .lien-btn { all: unset; cursor: pointer; color: var(--indigo); font-size: 12.5px; font-weight: 700;
      &:hover:not(:disabled) { text-decoration: underline; } &:disabled { color: var(--faint); cursor: default; } &:focus-visible { outline: 2px solid var(--indigo); } }
    ul { list-style: none; margin: 0; padding: 6px; max-height: 380px; overflow: auto; }
    .element { all: unset; box-sizing: border-box; width: 100%; display: flex; gap: 10px; padding: 10px; border-radius: 10px; cursor: pointer;
      &:hover, &:focus-visible { background: #f2f5fb; } }
    .point { flex-shrink: 0; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: transparent; }
    .non-lue .point { background: var(--indigo); }
    .texte { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .titre { font-size: 13.5px; font-weight: 600; color: var(--muted); }
    .non-lue .titre { font-weight: 800; color: var(--ink); }
    .contenu { font-size: 13px; color: var(--muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .date { font-size: 11.5px; color: var(--faint); }
    .etat { margin: 0; padding: 22px 16px; font-size: 13.5px; color: var(--muted); }
    .erreur { margin: 10px 12px 0; padding: 10px 12px; border-radius: 10px; background: #fce8e6; color: #b3261e; font-size: 13px; }
    .tout { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; border-top: 1px solid var(--line);
      font-size: 13.5px; font-weight: 700; color: var(--indigo); &:hover { background: #f5f8ff; } }
    .visuel-cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class ClocheNotifications {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly hote = inject(ElementRef<HTMLElement>);
  protected readonly compteurs = inject(Compteurs);

  protected readonly ouvert = signal(false);
  protected readonly liste = signal<Notification[]>([]);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  protected readonly enCours = signal(false);
  protected readonly date = dateCourte;

  protected readonly pastille = computed(() => (this.compteurs.notifications() > 99 ? '99+' : String(this.compteurs.notifications())));
  protected readonly libelle = computed(() => {
    const n = this.compteurs.notifications();
    return n ? `Notifications : ${n} non lue${n > 1 ? 's' : ''}` : 'Notifications';
  });

  constructor() {
    if (inject(Auth).connecte()) {
      const arreter = this.compteurs.suivre();
      inject(DestroyRef).onDestroy(arreter);
    }
    // Recharge la liste si une autre partie de l'application modifie les notifications pendant que le menu est ouvert.
    effect(() => {
      this.compteurs.versionNotifications();
      if (untracked(this.ouvert)) { untracked(() => this.charger()); }
    });
  }

  protected basculer(): void {
    const ouvrir = !this.ouvert();
    this.ouvert.set(ouvrir);
    if (ouvrir) { this.charger(); this.compteurs.rafraichirNotifications(); }
  }

  protected clicExterieur(e: MouseEvent): void {
    if (this.ouvert() && !this.hote.nativeElement.contains(e.target as Node)) { this.ouvert.set(false); }
  }

  private charger(): void {
    this.chargement.set(true);
    this.http.get<Notification[]>(`${API_URL}/notifications`).subscribe({
      next: (l) => {
        const tri = [...(l ?? [])].sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? ''));
        this.liste.set(tri.slice(0, NB_APERCU));
        this.erreur.set('');
        this.chargement.set(false);
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected ouvrir(n: Notification): void {
    if (!n.lue) {
      this.liste.update((l) => l.map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
      this.compteurs.notifications.update((c) => Math.max(0, c - 1));
      this.http.patch<Notification>(`${API_URL}/notifications/${n.id}/lue`, null).subscribe({
        next: () => this.compteurs.notificationsModifiees(),
        error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.compteurs.notificationsModifiees(); },
      });
    }
    if (estNotificationMessage(n)) { this.ouvert.set(false); this.router.navigateByUrl('/messagerie'); }
  }

  protected toutLire(): void {
    this.enCours.set(true);
    this.http.post(`${API_URL}/notifications/tout-lire`, null).subscribe({
      next: () => {
        this.enCours.set(false);
        this.liste.update((l) => l.map((x) => ({ ...x, lue: true })));
        this.compteurs.notifications.set(0);
        this.compteurs.notificationsModifiees();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreur.set(Auth.message(e)); },
    });
  }
}
