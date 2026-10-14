import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modal } from '../../../shared/modal/modal';

/** Boîte de confirmation avant une suppression ou une action irréversible. */
@Component({
  selector: 'app-confirmation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    <app-modal [titre]="titre()" [largeur]="500" (fermer)="fermer.emit()">
      <p class="texte">{{ message() }}</p>
      @if (detail()) { <p class="note detail">{{ detail() }}</p> }
      @if (erreur()) { <p class="bandeau" role="alert">{{ erreur() }}</p> }
      <div class="pied">
        <button class="btn clair" type="button" (click)="fermer.emit()">Annuler</button>
        <button class="btn" type="button" [class.danger]="danger()" [class.indigo]="!danger()" [disabled]="enCours()" (click)="valider.emit()">
          {{ enCours() ? 'Traitement…' : libelle() }}
        </button>
      </div>
    </app-modal>
  `,
  styleUrls: ['../../../shared/ui.scss'],
  styles: `
    :host { display: contents; }
    .texte { margin: 0; font-size: 14.5px; line-height: 1.55; }
    .detail { margin: 10px 0 0; line-height: 1.5; }
    .btn.danger { background: #b3261e; }
  `,
})
export class Confirmation {
  readonly titre = input('Confirmer');
  readonly message = input.required<string>();
  readonly detail = input('');
  readonly libelle = input('Supprimer');
  readonly danger = input(true);
  readonly enCours = input(false);
  readonly erreur = input('');
  readonly valider = output<void>();
  readonly fermer = output<void>();
}
