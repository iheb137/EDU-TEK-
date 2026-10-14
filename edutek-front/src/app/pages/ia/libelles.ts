import { nombreFr } from '../../shared/format';
import { Facteur, NiveauRisque, StatutAction, StatutAlerte, TypeAction } from './modeles';

/** Libellés, transitions autorisées (identiques aux règles du backend) et lecture des facteurs. */

export const LIBELLE_NIVEAU: Record<string, string> = { ELEVE: 'ÉLEVÉ', MOYEN: 'MOYEN', FAIBLE: 'FAIBLE' };
export const NIVEAUX: NiveauRisque[] = ['ELEVE', 'MOYEN', 'FAIBLE'];

export const LIBELLE_STATUT_ALERTE: Record<string, string> = {
  OUVERTE: 'Ouverte', EN_COURS: 'En cours', TRAITEE: 'Traitée', CLASSEE: 'Classée',
};
export const STATUTS_ALERTE: StatutAlerte[] = ['OUVERTE', 'EN_COURS', 'TRAITEE', 'CLASSEE'];

/** Transitions d'alerte acceptées par l'API (OUVERTE → EN_COURS/TRAITEE/CLASSEE, EN_COURS → TRAITEE/CLASSEE). */
export const TRANSITIONS_ALERTE: Record<string, StatutAlerte[]> = {
  OUVERTE: ['EN_COURS', 'TRAITEE', 'CLASSEE'],
  EN_COURS: ['TRAITEE', 'CLASSEE'],
};

export const ACTION_STATUT_ALERTE: Record<string, { bouton: string; explication: string; icone: string }> = {
  EN_COURS: { bouton: 'Prendre en charge', icone: 'play', explication: 'L\'équipe pédagogique commence le suivi de la situation. L\'alerte ne pourra plus revenir au statut « Ouverte ».' },
  TRAITEE: { bouton: 'Marquer comme traitée', icone: 'checkmark-done', explication: 'Le suivi est terminé : la situation a été prise en compte. L\'alerte est close et aucune nouvelle action ne pourra y être ajoutée.' },
  CLASSEE: { bouton: 'Classer sans suite', icone: 'archive', explication: 'Après examen, l\'équipe estime qu\'aucun accompagnement n\'est nécessaire. L\'alerte est close et aucune nouvelle action ne pourra y être ajoutée.' },
};

export const LIBELLE_STATUT_ACTION: Record<string, string> = {
  PLANIFIEE: 'Planifiée', EN_COURS: 'En cours', TERMINEE: 'Terminée', ANNULEE: 'Annulée',
};
export const STATUTS_ACTION: StatutAction[] = ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'];

/** Transitions d'action acceptées par l'API (PLANIFIEE → EN_COURS/TERMINEE/ANNULEE, EN_COURS → TERMINEE/ANNULEE). */
export const TRANSITIONS_ACTION: Record<string, StatutAction[]> = {
  PLANIFIEE: ['EN_COURS', 'TERMINEE', 'ANNULEE'],
  EN_COURS: ['TERMINEE', 'ANNULEE'],
};

export const LIBELLE_TYPE_ACTION: Record<string, string> = {
  ENTRETIEN: 'Entretien individuel', TUTORAT: 'Tutorat', ORIENTATION: 'Orientation',
  SOUTIEN_PEDAGOGIQUE: 'Soutien pédagogique', AUTRE: 'Autre action',
};
export const TYPES_ACTION: TypeAction[] = ['ENTRETIEN', 'TUTORAT', 'SOUTIEN_PEDAGOGIQUE', 'ORIENTATION', 'AUTRE'];

export const ICONE_TYPE_ACTION: Record<string, string> = {
  ENTRETIEN: 'chatbubbles', TUTORAT: 'people', ORIENTATION: 'flag', SOUTIEN_PEDAGOGIQUE: 'book', AUTRE: 'clipboard',
};

export function libelleNiveau(n?: string | null): string { return n ? LIBELLE_NIVEAU[n] ?? n : ''; }
export function libelleStatutAlerte(s?: string | null): string { return s ? LIBELLE_STATUT_ALERTE[s] ?? s : ''; }
export function libelleStatutAction(s?: string | null): string { return s ? LIBELLE_STATUT_ACTION[s] ?? s : ''; }
export function libelleTypeAction(t?: string | null): string { return t ? LIBELLE_TYPE_ACTION[t] ?? t : ''; }

/** Facteur présenté de façon lisible : libellé, valeur mise en forme, phrase d'explication. */
export interface FacteurLisible {
  nom: string;
  libelle: string;
  valeur: string;
  explication: string;
  contribution: number;
  sens: 'hausse' | 'baisse' | 'neutre';
}

const NOMS_FACTEURS: Record<string, string> = {
  MOYENNE_SEMESTRE: 'Moyenne du semestre',
  TAUX_ABSENCE: 'Taux d\'absence',
  TAUX_ABSENCE_NON_JUSTIFIEE: 'Absences non justifiées',
  NB_MATIERES_NON_VALIDEES: 'Matières non validées',
  TENDANCE_MOYENNE: 'Évolution de la moyenne',
  CREDITS_OBTENUS: 'Crédits obtenus',
};

/** Libellé lisible d'un indicateur (utilisé aussi pour les facteurs fréquents). */
export function libelleFacteur(nom: string): string {
  if (NOMS_FACTEURS[nom]) { return NOMS_FACTEURS[nom]; }
  const t = nom.toLowerCase().replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function lireFacteur(f: Facteur): FacteurLisible {
  const sens: FacteurLisible['sens'] = f.contribution > 0.0001 ? 'hausse' : f.contribution < -0.0001 ? 'baisse' : 'neutre';
  const base = { nom: f.nom, libelle: libelleFacteur(f.nom), contribution: f.contribution, sens };
  const pct = Math.round((f.valeur ?? 0) * 100) + ' %';
  switch (f.nom) {
    case 'MOYENNE_SEMESTRE':
      return { ...base, valeur: `${nombreFr(f.valeur)} / 20`,
        explication: f.valeur < 10 ? 'Moyenne inférieure à 10, calculée à partir des notes enregistrées pour le semestre.' : 'Moyenne égale ou supérieure à 10 : ce point fait baisser le score.' };
    case 'TAUX_ABSENCE':
      return { ...base, valeur: pct, explication: `Absences sur l'ensemble des séances pointées du semestre (justifiées ou non).` };
    case 'TAUX_ABSENCE_NON_JUSTIFIEE':
      return { ...base, valeur: pct, explication: 'Part des séances pointées où l\'absence n\'a pas encore de justificatif enregistré.' };
    case 'NB_MATIERES_NON_VALIDEES': {
      const n = Math.round(f.valeur);
      return { ...base, valeur: `${n} matière${n > 1 ? 's' : ''}`, explication: 'Matières dont la moyenne, avec les notes enregistrées, est inférieure au seuil de validation.' };
    }
    case 'TENDANCE_MOYENNE': {
      const v = f.valeur ?? 0;
      return { ...base, valeur: `${v > 0 ? '+' : ''}${nombreFr(v)} pt${Math.abs(v) >= 2 ? 's' : ''}`,
        explication: v < 0 ? 'Baisse de la moyenne par rapport au semestre précédent.' : 'Progression de la moyenne par rapport au semestre précédent.' };
    }
    default:
      return { ...base, valeur: nombreFr(f.valeur), explication: 'Indicateur pris en compte par le modèle.' };
  }
}

/** Facteurs triés par poids décroissant (valeur absolue), prêts à afficher. */
export function lireFacteurs(liste: Facteur[] | null | undefined): FacteurLisible[] {
  return [...(liste ?? [])].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).map(lireFacteur);
}

/** Facteur qui a le plus pesé à la hausse (ou null). */
export function facteurPrincipal(liste: Facteur[] | null | undefined): FacteurLisible | null {
  return lireFacteurs(liste).find((f) => f.sens === 'hausse') ?? null;
}

/** Score sous forme de pourcentage arrondi (0,7754 → « 78 % »). */
export function pourcentScore(p?: number | null): string {
  return p === null || p === undefined ? '' : Math.round(p * 100) + ' %';
}
