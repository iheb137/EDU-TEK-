import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { nombreFr } from '../../../shared/format';
import { Stats } from '../modeles';

/** Indicateurs statistiques d'une série de notes et histogramme de répartition (SVG). */
@Component({
  selector: 'app-bloc-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = stats();
    <dl class="chiffres">
      <div><dt>Effectif</dt><dd>{{ s.effectif }}</dd></div>
      <div><dt>Moyenne</dt><dd>{{ n(s.moyenne) }}</dd></div>
      <div><dt>Médiane</dt><dd>{{ n(s.mediane) }}</dd></div>
      <div><dt>Écart-type</dt><dd>{{ n(s.ecartType) }}</dd></div>
      <div><dt>Minimum</dt><dd>{{ n(s.min) }}</dd></div>
      <div><dt>Maximum</dt><dd>{{ n(s.max) }}</dd></div>
      <div class="reussite"><dt>Réussite (≥ {{ n(seuil()) }})</dt><dd>{{ s.tauxReussite === null || s.tauxReussite === undefined ? '–' : n(s.tauxReussite, 1) + ' %' }}</dd></div>
    </dl>
    @if (barres().length) {
      <figure class="histo">
        <figcaption>Répartition des notes</figcaption>
        <svg [attr.viewBox]="'0 0 ' + largeur + ' ' + (hauteur + 34)" role="img" [attr.aria-label]="resume()">
          <line x1="0" [attr.y1]="hauteur" [attr.x2]="largeur" [attr.y2]="hauteur" class="axe" />
          @for (b of barres(); track b.libelle) {
            <rect [attr.x]="b.x" [attr.y]="hauteur - b.h" [attr.width]="b.l" [attr.height]="b.h" rx="5" [class.sous]="b.sous" />
            <text [attr.x]="b.x + b.l / 2" [attr.y]="hauteur - b.h - 6" class="val">{{ b.nombre }}</text>
            <text [attr.x]="b.x + b.l / 2" [attr.y]="hauteur + 20" class="lib">{{ b.libelle }}</text>
          }
        </svg>
      </figure>
    }
  `,
  styles: `
    :host { display: block; }
    .chiffres { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; }
    .chiffres div { padding: 10px 12px; border-radius: 12px; background: #f5f7fc; border: 1px solid #e8edf7; }
    .chiffres dt { font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--faint); }
    .chiffres dd { margin: 4px 0 0; font-size: 20px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
    .chiffres .reussite { background: #eefaf5; border-color: #d3f0e4; } .chiffres .reussite dd { color: #0f6b4f; }
    .histo { margin: 18px 0 0; }
    figcaption { font-size: 12.5px; font-weight: 700; color: var(--muted); margin-bottom: 8px; }
    svg { width: 100%; max-width: 480px; display: block; }
    rect { fill: var(--indigo); opacity: .85; } rect.sous { fill: #e08a7d; }
    .axe { stroke: var(--line); stroke-width: 1; }
    text { font: 600 12px var(--font); fill: var(--muted); text-anchor: middle; } .val { fill: var(--ink); font-weight: 700; }
  `,
})
export class BlocStats {
  readonly stats = input.required<Stats>();
  readonly seuil = input(10);
  readonly noteMax = input(20);
  protected readonly largeur = 520;
  protected readonly hauteur = 150;
  protected readonly n = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '–' : nombreFr(v, d));

  protected readonly barres = computed(() => {
    const d = this.stats().distribution ?? [];
    if (!d.length) { return []; }
    const max = Math.max(1, ...d.map((t) => t.nombre));
    const pas = this.largeur / d.length;
    const l = Math.min(70, pas * 0.62);
    return d.map((t, i) => {
      const borneHaute = Number(t.libelle.split('-')[1] ?? NaN);
      return { libelle: t.libelle.replace('-', '–'), nombre: t.nombre, x: i * pas + (pas - l) / 2, l, h: Math.max(2, (t.nombre / max) * (this.hauteur - 24)), sous: !isNaN(borneHaute) && borneHaute <= this.seuil() };
    });
  });
  protected readonly resume = computed(() => 'Répartition : ' + (this.stats().distribution ?? []).map((t) => `${t.libelle} : ${t.nombre}`).join(', '));
}
