import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

/** Page provisoire des écrans pas encore construits. Le titre vient de `data.titre` dans les routes. */
@Component({
  selector: 'app-bientot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <section class="vide rise">
      <span class="rond"><app-icon nom="construct" [taille]="30" /></span>
      <h1>{{ titre }}</h1>
      <p>Cet écran sera construit dans une prochaine étape.</p>
      <a routerLink="/tableau-de-bord">Retour au tableau de bord</a>
    </section>
  `,
  styles: `
    .vide { margin-top: 40px; padding: 72px 24px; text-align: center; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; }
    .rond { width: 64px; height: 64px; margin: 0 auto 18px; border-radius: 18px; display: flex; align-items: center; justify-content: center; background: var(--navy-800); color: #fff; }
    h1 { margin: 0; font-size: 26px; font-weight: 800; }
    p { margin: 10px 0 22px; color: var(--muted); }
    a { color: var(--indigo); font-weight: 700; }
  `,
})
export class Bientot {
  protected readonly titre: string = inject(ActivatedRoute).snapshot.data['titre'] ?? 'Page';
}
