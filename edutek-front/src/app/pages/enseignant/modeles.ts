/** Modèles du module « enseignant » (enseignements, classes virtuelles, pointages, paiements, tarifs). */
import { nombreFr } from '../../shared/format';

export interface Enseignement {
  id: number; groupe?: string; volumeHoraire?: number; enseignantId: number; matiereId: number; classeId: number; semestreId: number;
}
export interface Matiere { id: number; code: string; nom: string; coefficient?: number; credits?: number; semestreId: number; }
export interface Classe { id: number; code: string; nom: string; anneeUniversitaire?: string; formationId: number; }
export interface SemestreRef { id: number; nom: string; dateDebut?: string; dateFin?: string; formationId: number; }
export interface EnseignantRef { id: number; nom: string; prenom: string; email: string; matricule?: string; specialite?: string; grade?: string; actif?: boolean; }

/** Enseignement enrichi des libellés (matière, classe, semestre). */
export interface EnseignementVue extends Enseignement {
  matiere: string; codeMatiere: string; classe: string; semestre: string; libelle: string;
  semestreDebut?: string; semestreFin?: string;
}

/** Semestre « courant » parmi des enseignements : celui qui contient aujourd'hui, sinon le dernier commencé. */
export function semestreCourant(liste: EnseignementVue[]): number {
  const jour = aujourdhui();
  const sems = [...new Map(liste.map((e) => [e.semestreId, e])).values()];
  const enCours = sems.filter((e) => (e.semestreDebut ?? '') <= jour && (!e.semestreFin || e.semestreFin >= jour));
  const commences = sems.filter((e) => (e.semestreDebut ?? '') <= jour);
  const tri = (l: EnseignementVue[]) => l.sort((a, b) => (b.semestreDebut ?? '').localeCompare(a.semestreDebut ?? '') || b.semestreId - a.semestreId);
  return (tri(enCours)[0] ?? tri(commences)[0] ?? tri(sems)[0])?.semestreId ?? 0;
}

export interface EvaluationAvancement { id: number; type: string; anonyme: boolean; attendues: number; brouillons: number; soumises: number; }
export interface Avancement { id: number; cloture: boolean; dateCloture?: string | null; evaluations: EvaluationAvancement[]; }

export interface LigneEnseignement {
  e: EnseignementVue;
  av: Avancement | null;
  attendues: number; soumises: number; brouillons: number; nbEvaluations: number; part: number;
}

/** Résumé chiffré de l'avancement de la saisie d'un enseignement. */
export function resumer(e: EnseignementVue, av: Avancement | null): LigneEnseignement {
  const evs = av?.evaluations ?? [];
  const attendues = evs.reduce((s, x) => s + x.attendues, 0);
  const soumises = evs.reduce((s, x) => s + Number(x.soumises), 0);
  const brouillons = evs.reduce((s, x) => s + Number(x.brouillons), 0);
  return { e, av, attendues, soumises, brouillons, nbEvaluations: evs.length, part: attendues ? Math.min(100, Math.round((soumises / attendues) * 100)) : 0 };
}

export interface Seance { id: number; date: string; heureDebut: string; heureFin: string; salle?: string; enseignementId: number; }

export interface ClasseVirtuelle {
  id: number; plateforme: string; lien: string; codeAcces?: string | null; dateHeure: string;
  enseignementId: number; classeId?: number; classeNom?: string; matiereNom?: string; enseignantNom?: string;
}
export interface Support { id: number; titre: string; type: string; url: string; dateDepot?: string; classeVirtuelleId: number; }

export interface Pointage {
  id: number; seanceId: number; date: string; heureDebut: string; heureFin: string; matiereNom: string; classeNom: string;
  enseignantId: number; enseignantNom: string; minutesPlanifiees: number; minutesDeclarees: number; minutesValidees?: number | null;
  statut: string; commentaire?: string | null; commentaireFinance?: string | null; datePointage?: string; dateValidation?: string | null;
}

export interface LignePaiement { pointageId: number; date: string; matiereNom: string; minutes: number; tarifHoraire: number; montant: number; }
export interface Paiement {
  id: number; enseignantId: number; enseignantNom: string; periode: string; minutes: number; montant: number; statut: string;
  dateGeneration?: string; dateValidation?: string | null; datePaiement?: string | null; lignes?: LignePaiement[] | null;
}
export interface Generation { periode: string; etats: Paiement[]; avertissements: string[]; }

export interface Tarif { id: number; montant: number; dateDebut: string; grade?: string | null; definiParId?: number; }

// ── Libellés ──────────────────────────────────────────────────────────────
export const PLATEFORMES: { code: string; libelle: string }[] = [
  { code: 'GOOGLE_MEET', libelle: 'Google Meet' }, { code: 'ZOOM', libelle: 'Zoom' },
  { code: 'TEAMS', libelle: 'Microsoft Teams' }, { code: 'AUTRE', libelle: 'Autre plateforme' },
];
export const TYPES_SUPPORT: { code: string; libelle: string }[] = [
  { code: 'PDF', libelle: 'PDF' }, { code: 'VIDEO', libelle: 'Vidéo' }, { code: 'DOCUMENT', libelle: 'Document' },
  { code: 'LIEN', libelle: 'Lien' }, { code: 'AUTRE', libelle: 'Autre' },
];
export const STATUTS_POINTAGE: Record<string, { libelle: string; classe: string }> = {
  EN_ATTENTE: { libelle: 'En attente', classe: 'orange' },
  VALIDE: { libelle: 'Validé', classe: 'vert' },
  CORRIGE: { libelle: 'Corrigé', classe: '' },
  ANOMALIE: { libelle: 'Anomalie', classe: 'rouge' },
};
export const STATUTS_PAIEMENT: Record<string, { libelle: string; classe: string }> = {
  BROUILLON: { libelle: 'Brouillon', classe: 'gris' },
  VALIDE: { libelle: 'Validé', classe: '' },
  PAYE: { libelle: 'Payé', classe: 'vert' },
};
export const TYPES_EVALUATION: Record<string, string> = {
  DS: 'Devoir surveillé', EXAMEN: 'Examen', TP: 'Travaux pratiques', PROJET: 'Projet', ORAL: 'Oral', CC: 'Contrôle continu',
};

export const libellePlateforme = (c: string) => PLATEFORMES.find((p) => p.code === c)?.libelle ?? c;
export const libelleSupport = (c: string) => TYPES_SUPPORT.find((p) => p.code === c)?.libelle ?? c;

// ── Formats ───────────────────────────────────────────────────────────────
/** 90 → « 1 h 30 », 45 → « 45 min ». */
export function dureeFr(minutes?: number | null): string {
  if (minutes === null || minutes === undefined) { return ''; }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) { return `${m} min`; }
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
/** Montant en dinars tunisiens (3 décimales). */
export function montantFr(n?: number | null): string {
  return n === null || n === undefined ? '' : `${(n).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
}
/** « 08:30:00 » → « 08:30 ». */
export const heure = (h?: string | null) => (h ? h.slice(0, 5) : '');
/** « 2026-09 » → « septembre 2026 ». */
export function periodeFr(p?: string | null): string {
  if (!p) { return ''; }
  const [a, m] = p.split('-').map(Number);
  const t = new Date(a, (m || 1) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
/** Date du jour au format AAAA-MM-JJ (heure locale). */
export function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Mois courant ou décalé au format AAAA-MM. */
export function moisCourant(decalage = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
/** Date + heure locale → « AAAA-MM-JJTHH:mm » (valeur d'un champ datetime-local). */
export function versChampDateHeure(iso?: string | null): string {
  if (!iso) { return ''; }
  return iso.slice(0, 16);
}
/** Durée planifiée d'une séance en minutes. */
export function minutesEntre(debut: string, fin: string): number {
  const [h1, m1] = debut.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}
export { nombreFr };
