import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { Auth } from '../../core/auth';
import { API_URL } from '../../core/config';
import { EntreeMenu, estPedagogie, menuPour } from '../../core/menu';
import { Alerte, LIBELLE_ROLE } from '../../core/modeles';
import { Icon } from '../../shared/icon/icon';
import { ClocheNotifications } from '../../pages/communication/notifications/cloche';
import { CompteurMessages } from '../../pages/communication/messagerie/compteur-messages';

/** En-tête : marque, menu horizontal (avec menus déroulants), raccourcis et menu du compte. */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, ClocheNotifications, CompteurMessages],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  host: { '(document:click)': 'clicDocument($event)', '(document:keydown.escape)': 'toutFermer()' },
})
export class Header {
  protected readonly auth = inject(Auth);
  private readonly http = inject(HttpClient);
  private readonly hote = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);

  protected readonly menu = computed(() => menuPour(this.auth.session()?.roles ?? []));
  protected readonly roleAffiche = computed(() => (this.auth.session()?.roles ?? []).map((r) => LIBELLE_ROLE[r] ?? r).join(' · '));
  protected readonly alertesOuvertes = signal(0);
  protected readonly ouvert = signal(false);          // menu du compte
  protected readonly groupeOuvert = signal<string | null>(null);
  protected readonly mobile = signal(false);           // panneau de navigation (petits écrans)

  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => (e as NavigationEnd).urlAfterRedirects)), { initialValue: this.router.url });

  constructor() {
    if (estPedagogie(this.auth.session()?.roles ?? [])) {
      // Badge : alertes ouvertes du semestre en cours (celui qui contient la date du jour).
      this.http.get<{ id: number; dateDebut?: string; dateFin?: string }[]>(`${API_URL}/semestres`).subscribe({
        next: (sems) => {
          const auj = new Date().toISOString().slice(0, 10);
          const tri = [...sems].sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''));
          const courant = tri.find((x) => (x.dateDebut ?? '') <= auj && (!x.dateFin || x.dateFin >= auj)) ?? tri.find((x) => (x.dateDebut ?? '') <= auj);
          if (!courant) { return; }
          this.http.get<Alerte[]>(`${API_URL}/ia/alertes`, { params: { semestreId: courant.id, statut: 'OUVERTE' } }).subscribe({
            next: (l) => this.alertesOuvertes.set(l.filter((a) => /^OUVERT/i.test(a.statut)).length),
            error: () => this.alertesOuvertes.set(0),
          });
        },
        error: () => this.alertesOuvertes.set(0),
      });
    }
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.toutFermer());
  }

  /** Un groupe est actif si l'une de ses pages est affichée. */
  protected groupeActif(e: EntreeMenu): boolean {
    const u = this.url().split('?')[0];
    return !!e.enfants?.some((x) => x.route && (u === x.route || u.startsWith(x.route + '/')));
  }

  protected basculerGroupe(libelle: string): void { this.groupeOuvert.update((g) => (g === libelle ? null : libelle)); this.ouvert.set(false); }
  protected basculer(): void { this.ouvert.update((v) => !v); this.groupeOuvert.set(null); }
  protected basculerMobile(): void { this.mobile.update((v) => !v); }
  protected toutFermer(): void { this.ouvert.set(false); this.groupeOuvert.set(null); this.mobile.set(false); }
  protected clicDocument(ev: MouseEvent): void {
    if (!this.hote.nativeElement.contains(ev.target as Node)) { this.ouvert.set(false); this.groupeOuvert.set(null); }
  }
  protected quitter(): void { this.toutFermer(); this.auth.deconnecter(); }
}
