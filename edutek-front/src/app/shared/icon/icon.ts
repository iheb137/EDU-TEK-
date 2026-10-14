import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONES } from './icons';

/** Affiche une icône Ionicons en SVG intégré : elle prend la couleur du texte (`currentColor`). */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.width.px]': 'taille()', '[style.height.px]': 'taille()' },
  template: `<span class="svg" [innerHTML]="svg()"></span>`,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; }
    .svg { display: flex; width: 100%; height: 100%; }
    .svg ::ng-deep svg { width: 100%; height: 100%; fill: currentColor; }
    // Les icônes Ionicons ne portent pas leurs couleurs : elles viennent de ces classes.
    .svg ::ng-deep .ionicon-fill-none { fill: none; stroke: currentColor; }
    .svg ::ng-deep .ionicon-stroke-width { stroke-width: 32px; }
  `,
})
export class Icon {
  readonly nom = input.required<string>();
  readonly taille = input(20);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly svg = computed<SafeHtml>(() => {
    const brut = ICONES[this.nom()] ?? '';
    // Contenu provenant du paquet ionicons (fiable) : on retire seulement le préfixe « data: ».
    const markup = brut.replace(/^data:image\/svg\+xml;utf8,/, '');
    return this.sanitizer.bypassSecurityTrustHtml(markup);
  });
}
