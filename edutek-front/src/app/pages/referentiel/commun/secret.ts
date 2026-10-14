import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';

/** Affiche une seule fois le mot de passe temporaire d'un compte qui vient d'être créé. */
@Component({
  selector: 'app-secret',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Modal],
  template: `
    <app-modal titre="Mot de passe temporaire" [largeur]="520" (fermer)="fermer.emit()">
      <p class="gris" style="margin:0 0 14px">Compte créé. Transmettez ce mot de passe à la personne : il ne sera plus affiché.</p>
      <p class="note" style="margin:0 0 6px">Compte : <strong>{{ email() }}</strong></p>
      <div class="secret">
        <span>{{ motDePasse() }}</span>
        <button class="icone" type="button" title="Copier" aria-label="Copier le mot de passe" (click)="copier()"><app-icon nom="copy" [taille]="19" /></button>
      </div>
      @if (copie()) { <p class="note" role="status" style="margin:8px 0 0">Copié dans le presse-papiers.</p> }
      <div class="pied"><button class="btn indigo" type="button" (click)="fermer.emit()">Terminé</button></div>
    </app-modal>
  `,
  styleUrls: ['../../../shared/ui.scss'],
  styles: `:host { display: contents; }`,
})
export class Secret {
  readonly email = input.required<string>();
  readonly motDePasse = input.required<string>();
  readonly fermer = output<void>();
  protected readonly copie = signal(false);

  protected async copier(): Promise<void> {
    try { await navigator.clipboard.writeText(this.motDePasse()); this.copie.set(true); } catch { /* copie indisponible */ }
  }
}
