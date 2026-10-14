import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

/** Boîte de dialogue : se ferme avec Échap, un clic à l'extérieur ou la croix. */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(document:keydown.escape)': 'fermer.emit()' },
  template: `
    <div class="voile" (click)="fermer.emit()"></div>
    <div class="boite" role="dialog" aria-modal="true" [attr.aria-label]="titre()" [style.max-width.px]="largeur()">
      <header>
        <h2>{{ titre() }}</h2>
        <button type="button" class="croix" (click)="fermer.emit()" aria-label="Fermer"><app-icon nom="close" [taille]="20" /></button>
      </header>
      <div class="corps"><ng-content /></div>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .voile { position: absolute; inset: 0; background: rgb(5 14 38 / 55%); backdrop-filter: blur(3px); animation: fade .2s ease both; }
    .boite { position: relative; width: 100%; max-height: calc(100vh - 40px); overflow: auto; background: #fff; border-radius: 18px;
      box-shadow: 0 30px 80px rgb(5 14 38 / 45%); animation: rise .35s cubic-bezier(.2, .8, .2, 1) both; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--line); }
    h2 { margin: 0; font-size: 18px; font-weight: 800; }
    .croix { all: unset; cursor: pointer; display: flex; padding: 6px; border-radius: 8px; color: var(--muted); &:hover { background: #eef1f8; } &:focus-visible { outline: 2px solid var(--indigo); } }
    .corps { padding: 22px 24px 24px; }
  `,
})
export class Modal {
  readonly titre = input.required<string>();
  readonly largeur = input(560);
  readonly fermer = output<void>();
}
