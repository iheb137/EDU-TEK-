import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { lireFacteurs } from '../libelles';
import { Facteur } from '../modeles';

/** Liste lisible des facteurs explicatifs d'une prédiction, avec le sens et le poids de chacun. */
@Component({
  selector: 'app-facteurs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lignes().length) {
      <ul class="facteurs">
        @for (f of lignes(); track f.nom) {
          <li>
            <div class="tete">
              <span class="libelle">{{ f.libelle }}</span>
              <span class="valeur">{{ f.valeur }}</span>
            </div>
            <div class="balance" [attr.aria-label]="f.libelle + ' : ' + sens(f.sens)" role="img">
              <div class="moitie gauche">@if (f.sens === 'baisse') { <span class="barre baisse" [style.width.%]="f.part"></span> }</div>
              <div class="axe"></div>
              <div class="moitie droite">@if (f.sens === 'hausse') { <span class="barre hausse" [style.width.%]="f.part"></span> }</div>
            </div>
            <p class="explication"><span class="sens" [class]="'sens ' + f.sens">{{ sens(f.sens) }}</span> {{ f.explication }}</p>
          </li>
        }
      </ul>
      <div class="legende" aria-hidden="true"><span><i class="baisse"></i>Fait baisser le score</span><span><i class="hausse"></i>Fait monter le score</span></div>
    } @else {
      <p class="aucun">Aucun facteur explicatif n'a été enregistré pour cette prédiction.</p>
    }
  `,
  styles: `
    :host { display: block; }
    .facteurs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
    .tete { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
    .libelle { font-weight: 700; }
    .valeur { font-weight: 800; font-variant-numeric: tabular-nums; }
    .balance { margin-top: 8px; display: grid; grid-template-columns: 1fr 2px 1fr; align-items: center; height: 10px; }
    .moitie { height: 10px; background: #eef1f8; display: flex; }
    .gauche { justify-content: flex-end; border-radius: 5px 0 0 5px; }
    .droite { border-radius: 0 5px 5px 0; }
    .axe { height: 16px; background: #9aa6c4; border-radius: 1px; }
    .barre { height: 100%; animation: grow .8s cubic-bezier(.2, .8, .2, 1) both; }
    .barre.hausse { background: #e5483b; border-radius: 0 5px 5px 0; transform-origin: left; }
    .barre.baisse { background: #2fb98d; border-radius: 5px 0 0 5px; transform-origin: right; }
    .explication { margin: 8px 0 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
    .sens { font-weight: 700; }
    .sens.hausse { color: #b3261e; } .sens.baisse { color: #0f6b4f; } .sens.neutre { color: var(--faint); }
    .legende { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 18px; font-size: 12.5px; color: var(--faint);
      span { display: inline-flex; align-items: center; gap: 6px; } i { width: 12px; height: 8px; border-radius: 3px; display: inline-block; }
      .hausse { background: #e5483b; } .baisse { background: #2fb98d; } }
    .aucun { margin: 0; font-size: 14px; color: var(--muted); }
  `,
})
export class Facteurs {
  readonly facteurs = input<Facteur[] | null | undefined>([]);

  protected readonly lignes = computed(() => {
    const l = lireFacteurs(this.facteurs());
    const max = Math.max(0.0001, ...l.map((f) => Math.abs(f.contribution)));
    return l.map((f) => ({ ...f, part: Math.max(4, (Math.abs(f.contribution) / max) * 100) }));
  });

  protected sens(s: string): string {
    return s === 'hausse' ? 'Fait monter le score.' : s === 'baisse' ? 'Fait baisser le score.' : 'Sans effet notable.';
  }
}
