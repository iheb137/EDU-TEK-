import { nombreFr, pourcentFr } from '../../shared/format';
import { Indicateur } from './modeles';

/** « 1er », « 3e ». */
export function rangFr(rang?: number | null, effectif?: number | null): string {
  if (!rang) { return ''; }
  return `${rang}${rang === 1 ? 'er' : 'e'}${effectif ? ' sur ' + effectif : ''}`;
}

const INDICATEURS: Record<string, { libelle: string; format: (v: number) => string; ordre: number }> = {
  MOYENNE_SEMESTRE: { libelle: 'Moyenne indicative', format: (v) => nombreFr(v) + ' / 20', ordre: 1 },
  TENDANCE_MOYENNE: { libelle: 'Évolution par rapport au semestre précédent', format: (v) => (v > 0 ? '+' : '') + nombreFr(v) + ' point' + (Math.abs(v) >= 2 ? 's' : ''), ordre: 2 },
  CREDITS_OBTENUS: { libelle: 'Crédits obtenus', format: (v) => nombreFr(v, 0), ordre: 3 },
  NB_MATIERES_NON_VALIDEES: { libelle: 'Matières non validées', format: (v) => nombreFr(v, 0), ordre: 4 },
  NB_SEANCES_POINTEES: { libelle: 'Séances pointées', format: (v) => nombreFr(v, 0), ordre: 5 },
  TAUX_ABSENCE: { libelle: 'Taux d\'absence', format: (v) => pourcentFr(v), ordre: 6 },
  TAUX_ABSENCE_NON_JUSTIFIEE: { libelle: 'Absences non justifiées', format: (v) => pourcentFr(v), ordre: 7 },
};

export interface IndicateurAffiche { nom: string; libelle: string; valeur: string; brut: number; }

/** Indicateurs triés et mis en forme pour l'affichage. */
export function indicateursAffiches(liste: Indicateur[]): IndicateurAffiche[] {
  return [...liste]
    .sort((a, b) => (INDICATEURS[a.nom]?.ordre ?? 99) - (INDICATEURS[b.nom]?.ordre ?? 99))
    .map((i) => {
      const d = INDICATEURS[i.nom];
      const lib = d?.libelle ?? i.nom.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
      return { nom: i.nom, libelle: lib, valeur: d ? d.format(i.valeur) : nombreFr(i.valeur), brut: i.valeur };
    });
}

export function valeurIndicateur(liste: Indicateur[], nom: string): number | null {
  return liste.find((i) => i.nom === nom)?.valeur ?? null;
}

/** Message de succès éphémère (4 s). */
export function confirmerPendant(maj: (m: string) => void, message: string): void {
  maj(message);
  setTimeout(() => maj(''), 4000);
}
