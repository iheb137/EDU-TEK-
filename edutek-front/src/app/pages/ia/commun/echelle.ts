import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Échelle 0–100 % découpée par les seuils de risque, avec, si fourni, la position d'un score. */
@Component({
  selector: 'app-echelle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="echelle" role="img" [attr.aria-label]="description()">
      <div class="zones">
        <span class="zone FAIBLE" [style.width.%]="m()"><b>Faible</b></span>
        <span class="zone MOYEN" [style.width.%]="e() - m()"><b>Moyen</b></span>
        <span class="zone ELEVE" [style.width.%]="100 - e()"><b>Élevé</b></span>
      </div>
      @if (score() !== null && score() !== undefined) {
        <span class="curseur" [style.left.%]="pos()"><span class="bulle">{{ pct(score()!) }}</span></span>
      }
      <div class="graduations">
        <span style="left:0">0 %</span>
        <span class="seuil" [style.left.%]="m()">{{ pct(seuilMoyen()) }}</span>
        <span class="seuil" [style.left.%]="e()">{{ pct(seuilEleve()) }}</span>
        <span style="left:100%">100 %</span>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .echelle { position: relative; padding-top: 30px; }
    .zones { display: flex; height: 26px; border-radius: 8px; overflow: hidden; }
    .zone { display: flex; align-items: center; justify-content: center; min-width: 0; overflow: hidden; font-size: 11.5px; letter-spacing: .04em; text-transform: uppercase; transition: width .3s ease; }
    .zone b { font-weight: 800; white-space: nowrap; }
    .zone.FAIBLE { background: #ddf5ec; color: #0f6b4f; }
    .zone.MOYEN { background: #fff1d6; color: #8a5a00; border-left: 2px solid #fff; }
    .zone.ELEVE { background: #fce8e6; color: #b3261e; border-left: 2px solid #fff; }
    .curseur { position: absolute; top: 24px; width: 3px; height: 38px; margin-left: -1.5px; background: var(--ink); border-radius: 2px; }
    .bulle { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 4px; padding: 2px 8px; border-radius: 8px;
      background: var(--ink); color: #fff; font-size: 12px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .graduations { position: relative; height: 20px; margin-top: 6px; font-size: 11.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
    .graduations span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
    .graduations span:first-child { transform: none; } .graduations span:last-child { transform: translateX(-100%); }
    .graduations .seuil { font-weight: 700; color: var(--muted); }
  `,
})
export class Echelle {
  readonly seuilMoyen = input.required<number>();
  readonly seuilEleve = input.required<number>();
  readonly score = input<number | null | undefined>(null);

  protected readonly m = computed(() => this.borne(this.seuilMoyen()) * 100);
  protected readonly e = computed(() => Math.max(this.borne(this.seuilEleve()), this.borne(this.seuilMoyen())) * 100);
  protected readonly pos = computed(() => this.borne(this.score() ?? 0) * 100);
  protected readonly description = computed(() => {
    const base = `Seuil moyen ${this.pct(this.seuilMoyen())}, seuil élevé ${this.pct(this.seuilEleve())}`;
    const s = this.score();
    return s === null || s === undefined ? base : `Score ${this.pct(s)}. ${base}`;
  });

  protected pct(v: number): string { return Math.round(v * 100) + ' %'; }
  private borne(v: number): number { return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)); }
}
