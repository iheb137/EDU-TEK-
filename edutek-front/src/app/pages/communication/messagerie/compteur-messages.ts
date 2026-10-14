import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../../../core/auth';
import { Icon } from '../../../shared/icon/icon';
import { Compteurs } from '../compteurs';

/** Accès à la messagerie depuis l'en-tête, avec la pastille des messages non lus. */
@Component({
  selector: 'app-compteur-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink, RouterLinkActive],
  template: `
    <a class="bouton-icone" routerLink="/messagerie" routerLinkActive="actif" [attr.aria-label]="libelle()" [title]="libelle()">
      <app-icon nom="mail" [taille]="22" />
      @if (compteurs.messages() > 0) { <span class="pastille" aria-hidden="true">{{ pastille() }}</span> }
    </a>
  `,
  styles: `
    :host { display: block; }
    .bouton-icone { position: relative; width: 40px; height: 40px; border-radius: 10px; color: #fff; background: rgb(255 255 255 / 7%);
      display: flex; align-items: center; justify-content: center; transition: background .2s;
      &:hover, &.actif { background: rgb(255 255 255 / 14%); } }
    .pastille { position: absolute; top: 3px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; box-sizing: border-box;
      background: #ff6b5e; color: #fff; font-size: 10.5px; font-weight: 800; line-height: 18px; text-align: center; box-shadow: 0 0 0 2px var(--navy-800); }
  `,
})
export class CompteurMessages {
  protected readonly compteurs = inject(Compteurs);
  protected readonly pastille = computed(() => (this.compteurs.messages() > 99 ? '99+' : String(this.compteurs.messages())));
  protected readonly libelle = computed(() => {
    const n = this.compteurs.messages();
    return n ? `Messagerie : ${n} message${n > 1 ? 's' : ''} non lu${n > 1 ? 's' : ''}` : 'Messagerie';
  });

  constructor() {
    if (inject(Auth).connecte()) {
      const arreter = this.compteurs.suivre();
      inject(DestroyRef).onDestroy(arreter);
    }
  }
}
