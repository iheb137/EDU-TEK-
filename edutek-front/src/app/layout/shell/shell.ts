import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';

/** Mise en page des écrans connectés : menu horizontal, contenu, pied de page. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly router = inject(Router);

  /** Vrai pendant le chargement d'une page (barre de progression en haut de l'écran). */
  protected readonly navigation = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationStart || e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError),
      map((e) => e instanceof NavigationStart),
    ),
    { initialValue: false },
  );
}
