import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Auth } from '../../../core/auth';
import { LIBELLE_ROLE } from '../../../core/modeles';
import { Icon } from '../../../shared/icon/icon';
import { Personne, RECHERCHE_VALIDE, normaliser } from '../modeles';
import { chercherPersonnes } from './recherche';

const ROLES = ['ETUDIANT', 'ENSEIGNANT', 'SUPERADMIN', 'ADMIN_PEDAGOGIQUE', 'ADMIN_COMMUNICATION', 'ADMIN_SUPPORT', 'ADMIN_FINANCIER'];

/** Annuaire de l'établissement : recherche de personnes et accès direct à la rédaction d'un message. */
@Component({
  selector: 'app-annuaire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './annuaire.html',
  styleUrls: ['../../../shared/ui.scss', './annuaire.scss'],
})
export class Annuaire {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = inject(Auth).session();

  protected readonly roles = ROLES;
  protected readonly libelleRole = (r: string) => LIBELLE_ROLE[r] ?? r;

  protected readonly saisie = signal('');
  protected readonly role = signal('');
  protected readonly resultats = signal<Personne[] | null>(null);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  protected readonly consigne = signal('Saisissez au moins 2 lettres d\'un nom ou d\'un prénom.');

  protected readonly filtres = computed(() => {
    const r = this.role();
    return (this.resultats() ?? []).filter((p) => !r || p.roles.includes(r));
  });

  private minuteur: ReturnType<typeof setTimeout> | undefined;
  private requete: Subscription | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => { clearTimeout(this.minuteur); this.requete?.unsubscribe(); });
  }

  protected chercher(v: string): void {
    this.saisie.set(v);
    clearTimeout(this.minuteur);
    this.requete?.unsubscribe();
    const q = v.trim();
    this.erreur.set('');
    if (q.length < 2) { this.resultats.set(null); this.chargement.set(false); this.consigne.set('Saisissez au moins 2 lettres d\'un nom ou d\'un prénom.'); return; }
    if (!RECHERCHE_VALIDE.test(q)) {
      this.resultats.set(null); this.chargement.set(false);
      this.consigne.set('La recherche porte sur les noms et prénoms : lettres, espaces, apostrophes et tirets uniquement (50 caractères maximum).');
      return;
    }
    this.minuteur = setTimeout(() => {
      this.chargement.set(true);
      this.requete = chercherPersonnes(this.http, q).subscribe({
        next: (l) => { this.resultats.set(l); this.chargement.set(false); },
        error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.resultats.set(null); this.chargement.set(false); },
      });
    }, 300);
  }

  /** Le compte connecté (même nom complet et mêmes rôles) : pas de message à soi-même. */
  protected estMoi(p: Personne): boolean {
    const s = this.session;
    if (!s) { return false; }
    return normaliser(`${p.prenom} ${p.nom}`) === normaliser(`${s.prenom} ${s.nom}`) && p.roles.every((r) => s.roles.includes(r));
  }

  protected ecrire(p: Personne): void {
    this.router.navigate(['/messagerie'], { queryParams: { ecrire: 1, a: p.id, prenom: p.prenom, nom: p.nom, roles: p.roles.join(',') } });
  }
}
