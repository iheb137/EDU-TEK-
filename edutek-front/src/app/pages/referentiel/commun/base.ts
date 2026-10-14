import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Directive, inject, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Observable } from 'rxjs';
import { Auth } from '../../../core/auth';

/**
 * Message lisible pour une erreur de l'API. Complète `Auth.message` pour les erreurs de validation
 * (400 renvoyée sous la forme { champ: message }).
 */
export function messageErreur(e: unknown): string {
  if (e instanceof HttpErrorResponse && e.status === 400 && e.error && typeof e.error === 'object' && !('erreur' in e.error)) {
    const lignes = Object.entries(e.error as Record<string, unknown>).map(([champ, m]) => `${champ} : ${m}`);
    if (lignes.length) { return 'Données refusées par le serveur. ' + lignes.join(' ; '); }
  }
  return Auth.message(e);
}

/** Mot de passe temporaire robuste (même règle que la page Utilisateurs). */
export function genererMotDePasse(): string {
  const alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const octets = crypto.getRandomValues(new Uint32Array(10));
  const base = Array.from(octets, (n) => alpha[n % alpha.length]).join('');
  return `${base}@${(octets[0] % 90) + 10}`;
}

/** Tri alphabétique français. */
export function parNom<T>(liste: T[], cle: (x: T) => string): T[] {
  return [...liste].sort((a, b) => cle(a).localeCompare(cle(b), 'fr', { sensitivity: 'base' }));
}

/** Normalise un texte pour la recherche (sans casse ni accents). */
export function normaliser(t?: string | null): string {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Indexe une liste par identifiant. */
export function indexer<T extends { id: number }>(liste: T[]): Map<number, T> {
  return new Map(liste.map((x) => [x.id, x]));
}

/** État et comportements communs aux écrans du référentiel (messages, boîte de dialogue, envoi). */
@Directive()
export abstract class PageReferentiel<F extends string = string> {
  protected readonly http = inject(HttpClient);
  protected readonly fb = inject(FormBuilder);
  /** Écriture (POST/PUT/DELETE) réservée à SUPERADMIN et ADMIN_PEDAGOGIQUE sur toutes les routes du module. */
  protected readonly peutEcrire = inject(Auth).a('SUPERADMIN', 'ADMIN_PEDAGOGIQUE');

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly fenetre = signal<F | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;

  protected confirmer(m: string): void {
    this.info.set(m);
    clearTimeout(this.minuteurInfo);
    this.minuteurInfo = setTimeout(() => this.info.set(''), 4000);
  }

  protected ouvrir(f: F): void { this.erreurFenetre.set(''); this.enCours.set(false); this.fenetre.set(f); }
  protected fermer(): void { this.fenetre.set(null); this.erreurFenetre.set(''); }

  /** Envoie une requête d'écriture depuis une boîte de dialogue (bouton désactivé, erreur affichée dans la boîte). */
  protected envoyer<T>(requete: Observable<T>, succes: (r: T) => void): void {
    this.enCours.set(true);
    this.erreurFenetre.set('');
    requete.subscribe({
      next: (r) => { this.enCours.set(false); succes(r); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(messageErreur(e)); },
    });
  }
}
