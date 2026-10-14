import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, model, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Auth } from '../../../core/auth';
import { LIBELLE_ROLE } from '../../../core/modeles';
import { Icon } from '../../../shared/icon/icon';
import { chercherPersonnes } from '../annuaire/recherche';
import { Personne, RECHERCHE_VALIDE } from '../modeles';

/** Champ « Destinataire » avec autocomplétion sur l'annuaire de l'établissement. */
@Component({
  selector: 'app-choix-destinataire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(document:click)': 'fermerSiExterieur($event)' },
  template: `
    @if (destinataire(); as d) {
      <div class="choisi">
        <app-icon nom="person-circle" [taille]="22" />
        <span class="nom">{{ d.prenom }} {{ d.nom }}</span>
        @for (r of d.roles; track r) { <span class="puce">{{ libelleRole(r) }}</span> }
        <button class="retirer" type="button" [attr.aria-label]="'Retirer ' + d.prenom + ' ' + d.nom" title="Changer de destinataire" (click)="retirer()"><app-icon nom="close" [taille]="18" /></button>
      </div>
    } @else {
      <div class="zone">
        <app-icon class="loupe" nom="search" [taille]="18" />
        <input [id]="idChamp()" type="text" role="combobox" autocomplete="off" placeholder="Rechercher par nom ou prénom"
               aria-autocomplete="list" [attr.aria-expanded]="ouvert()" [attr.aria-controls]="idChamp() + '-liste'"
               [attr.aria-activedescendant]="actif() >= 0 ? idChamp() + '-opt-' + actif() : null"
               [value]="saisie()" (input)="taper($any($event.target).value)" (keydown)="clavier($event)" (focus)="ouvert.set(resultats().length > 0)">
        @if (ouvert()) {
          <ul class="liste" role="listbox" [id]="idChamp() + '-liste'">
            @if (chargement()) { <li class="info">Recherche…</li> }
            @else if (erreur()) { <li class="info erreur">{{ erreur() }}</li> }
            @else {
              @for (p of resultats(); track p.id; let i = $index) {
                <li role="option" [id]="idChamp() + '-opt-' + i" [attr.aria-selected]="i === actif()" [class.actif]="i === actif()"
                    (mousedown)="$event.preventDefault()" (click)="choisir(p)" (mouseenter)="actif.set(i)">
                  <span class="nom">{{ p.prenom }} {{ p.nom }}</span>
                  <span class="roles">{{ libelles(p.roles) }}</span>
                </li>
              } @empty { <li class="info">Aucune personne ne correspond à « {{ saisie().trim() }} ».</li> }
            }
          </ul>
        }
      </div>
      @if (aide()) { <span class="aide">{{ aide() }}</span> }
    }
  `,
  styles: `
    :host { display: block; position: relative; }
    .zone { position: relative; }
    .loupe { position: absolute; left: 12px; top: 12px; color: var(--faint); }
    input { width: 100%; height: 42px; padding: 0 12px 0 38px; border-radius: 10px; border: 1px solid var(--line); font: 500 14px var(--font); background: #fff; color: var(--ink); }
    .liste { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 20; list-style: none; margin: 0; padding: 6px; max-height: 260px; overflow: auto;
      background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 34px rgb(7 21 51 / 18%); }
    li[role='option'] { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 14px;
      &.actif { background: #eef2fd; } }
    .nom { font-weight: 700; }
    .roles { font-size: 12px; color: var(--muted); text-align: right; }
    .info { padding: 10px; font-size: 13.5px; color: var(--muted); &.erreur { color: #b3261e; } }
    .aide { display: block; margin-top: 6px; font-size: 12.5px; color: var(--faint); }
    .choisi { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 42px; padding: 4px 6px 4px 10px; border-radius: 10px;
      border: 1px solid #c9d4f3; background: #f5f8ff; color: var(--indigo); font-size: 14px; .nom { color: var(--ink); } }
    .puce { padding: 2px 9px; border-radius: 10px; font-size: 11.5px; font-weight: 700; background: #e8edfb; color: #2a44a8; }
    .retirer { all: unset; margin-left: auto; display: flex; padding: 6px; border-radius: 8px; cursor: pointer; color: var(--muted);
      &:hover { background: #e8edfb; color: var(--indigo); } &:focus-visible { outline: 2px solid var(--indigo); } }
  `,
})
export class ChoixDestinataire {
  private readonly http = inject(HttpClient);
  private readonly hote = inject(ElementRef<HTMLElement>);
  readonly destinataire = model<Personne | null>(null);
  readonly idChamp = input('destinataire');

  protected readonly saisie = signal('');
  protected readonly resultats = signal<Personne[]>([]);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  protected readonly ouvert = signal(false);
  protected readonly actif = signal(-1);
  protected readonly aide = signal('Saisissez au moins 2 lettres.');

  protected readonly libelleRole = (r: string) => LIBELLE_ROLE[r] ?? r;
  protected readonly libelles = (roles: string[]) => roles.map((r) => LIBELLE_ROLE[r] ?? r).join(', ');

  private minuteur: ReturnType<typeof setTimeout> | undefined;
  private requete: Subscription | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => { clearTimeout(this.minuteur); this.requete?.unsubscribe(); });
  }

  protected taper(v: string): void {
    this.saisie.set(v);
    clearTimeout(this.minuteur);
    this.requete?.unsubscribe();
    const q = v.trim();
    if (q.length < 2) { this.ouvert.set(false); this.resultats.set([]); this.aide.set('Saisissez au moins 2 lettres.'); return; }
    if (!RECHERCHE_VALIDE.test(q)) { this.ouvert.set(false); this.aide.set('Lettres, espaces, apostrophes et tirets uniquement.'); return; }
    this.aide.set('');
    this.minuteur = setTimeout(() => this.chercher(q), 250);
  }

  private chercher(q: string): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.ouvert.set(true);
    this.requete = chercherPersonnes(this.http, q).subscribe({
      next: (l) => { this.resultats.set(l.slice(0, 20)); this.actif.set(l.length ? 0 : -1); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.resultats.set([]); this.chargement.set(false); },
    });
  }

  protected clavier(e: KeyboardEvent): void {
    const n = this.resultats().length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.ouvert.set(true); this.actif.update((i) => (i + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.actif.update((i) => (i <= 0 ? n - 1 : i - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const p = this.resultats()[this.actif()];
      if (this.ouvert() && p) { this.choisir(p); }
    } else if (e.key === 'Escape' && this.ouvert()) { e.stopPropagation(); this.ouvert.set(false); }
  }

  protected choisir(p: Personne): void {
    this.destinataire.set(p);
    this.ouvert.set(false);
    this.saisie.set('');
    this.resultats.set([]);
  }

  protected retirer(): void {
    this.destinataire.set(null);
    this.aide.set('Saisissez au moins 2 lettres.');
    setTimeout(() => document.getElementById(this.idChamp())?.focus());
  }

  protected fermerSiExterieur(e: MouseEvent): void {
    if (this.ouvert() && !this.hote.nativeElement.contains(e.target as Node)) { this.ouvert.set(false); }
  }
}
