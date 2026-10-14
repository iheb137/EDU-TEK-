/** Modèles du module Communication (messagerie, notifications, annuaire, actualités, diffusions). */

export interface Message {
  id: number;
  objet: string;
  contenu: string;
  dateEnvoi: string;
  lu: boolean;
  expediteurId: number;
  expediteurNom: string;
  destinataireId: number;
  destinataireNom: string;
}
export interface MessageRequete { destinataireId: number; objet: string; contenu: string; }

export interface Notification { id: number; titre: string; contenu: string; dateEnvoi: string; lue: boolean; }

export interface Personne { id: number; nom: string; prenom: string; roles: string[]; }

export interface Actualite {
  id: number;
  titre: string;
  contenu: string;
  datePublication: string;
  lienDocument?: string | null;
  auteurId?: number;
  auteurNom?: string;
}
export interface ActualiteRequete { titre: string; contenu: string; lienDocument?: string; }

export type Audience = 'ETUDIANTS' | 'ENSEIGNANTS' | 'TOUS' | 'CLASSE';
export interface DiffusionRequete { audience: Audience; classeId?: number; titre: string; contenu: string; }
export interface DiffusionResultat { audience: Audience; destinataires: number; }

export interface Classe { id: number; code: string; nom: string; anneeUniversitaire?: string; formationId?: number; }

export const LIBELLE_AUDIENCE: Record<Audience, string> = {
  ETUDIANTS: 'Tous les étudiants',
  ENSEIGNANTS: 'Tous les enseignants',
  TOUS: 'Tous les utilisateurs',
  CLASSE: 'Une classe',
};

/** Retire accents et majuscules (comparaisons de recherche côté navigateur). */
export function normaliser(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Règle de l'annuaire côté serveur : 2 à 50 lettres, espaces, apostrophes et tirets. */
export const RECHERCHE_VALIDE = /^[\p{L}][\p{L} '’-]{1,49}$/u;

/** Date courte d'une liste de messages : l'heure si c'est aujourd'hui, sinon le jour. */
export function dateCourte(iso?: string | null): string {
  if (!iso) { return ''; }
  const d = new Date(iso);
  const auj = new Date();
  if (d.toDateString() === auj.toDateString()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  const memeAnnee = d.getFullYear() === auj.getFullYear();
  return d.toLocaleDateString('fr-FR', memeAnnee ? { day: 'numeric', month: 'short' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Une notification annonçant un message reçu renvoie vers la messagerie. */
export function estNotificationMessage(n: Notification): boolean {
  return /^nouveau message/i.test(n.titre ?? '');
}
