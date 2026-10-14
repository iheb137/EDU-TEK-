import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of, switchMap } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr, nombreFr, pourcentFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { EspaceEtudiant, Referentiel, semestreCourant } from '../espace-etudiant';
import {
  CATEGORIES_RECOMMANDATION, ClasseVirtuelle, DemandeDocument, Indicateur, Justificatif, NoteDto, PLATEFORMES, PresenceDto,
  Recommandation, STATUT_DEMANDE, SemestreDto, TYPES_DOCUMENT, libelle,
} from '../modeles';
import { valeurIndicateur } from '../outils';

interface MatiereCredits { id: number; credits?: number; semestreId: number; }

interface Donnees {
  indicateurs: Indicateur[]; presences: PresenceDto[]; notes: NoteDto[]; ref: Referentiel | null; recommandations: Recommandation[];
  classes: ClasseVirtuelle[]; demandes: DemandeDocument[]; justificatifs: Justificatif[]; matieres: MatiereCredits[];
}

/** Repli silencieux : une source indisponible n'empêche pas l'affichage du reste de l'accueil. */
function ouVide<T>(o: Observable<T>, defaut: T, manquantes: string[], nom: string): Observable<T> {
  return o.pipe(catchError(() => { manquantes.push(nom); return of(defaut); }));
}

/** Accueil de l'étudiant : synthèse du semestre courant, absences, recommandations, classes virtuelles et démarches. */
@Component({
  selector: 'app-accueil-etudiant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './accueil-etudiant.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss', './accueil-etudiant.scss'],
})
export class AccueilEtudiant {
  private readonly http = inject(HttpClient);
  private readonly espace = inject(EspaceEtudiant);
  protected readonly auth = inject(Auth);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly manquantes = signal<string[]>([]);
  protected readonly semestre = signal<SemestreDto | null>(null);
  protected readonly donnees = signal<Donnees | null>(null);

  protected readonly absences = computed(() => {
    const d = this.donnees(); const s = this.semestre();
    if (!d?.ref || !s) { return { seances: 0, absences: 0, aJustifier: 0 }; }
    const duSemestre = d.presences.filter((p) => d.ref!.seances.get(p.seanceId)?.semestreId === s.id);
    const abs = duSemestre.filter((p) => !p.present);
    return { seances: duSemestre.length, absences: abs.length, aJustifier: abs.filter((p) => !p.justification).length };
  });

  protected readonly cartes = computed(() => {
    const d = this.donnees(); const s = this.semestre();
    if (!d || !s) { return []; }
    const moy = valeurIndicateur(d.indicateurs, 'MOYENNE_SEMESTRE');
    const nv = valeurIndicateur(d.indicateurs, 'NB_MATIERES_NON_VALIDEES');
    const cred = valeurIndicateur(d.indicateurs, 'CREDITS_OBTENUS');
    const total = d.matieres.filter((m) => m.semestreId === s.id).reduce((t, m) => t + (m.credits ?? 0), 0);
    const a = this.absences();
    const nonLues = d.recommandations.filter((r) => !r.lue).length;
    return [
      { titre: 'Moyenne indicative', valeur: moy === null ? '—' : nombreFr(moy), sur: moy !== null, lien: '/mon-bulletin',
        note: moy === null ? 'Pas encore calculée pour ce semestre' : nv ? `${nv} matière${nv > 1 ? 's' : ''} non validée${nv > 1 ? 's' : ''} à ce stade` : 'Toutes les matières validées à ce stade', couleur: '#3d5bd6', icone: 'calculator' },
      { titre: 'Crédits acquis', valeur: cred === null ? '—' : nombreFr(cred, 0), sur: false, lien: '/mon-bulletin',
        note: total ? `sur ${total} crédits au programme` : 'Crédits du semestre', couleur: '#1f9d78', icone: 'ribbon' },
      { titre: 'Absences', valeur: String(a.absences), sur: false, lien: '/mes-presences',
        note: a.seances ? `${a.aJustifier} à justifier · ${pourcentFr(a.seances ? a.absences / a.seances : 0)} des séances` : 'Aucune séance pointée', couleur: '#d98a00', icone: 'time' },
      { titre: 'Recommandations', valeur: String(nonLues), sur: false, lien: '/mes-recommandations',
        note: nonLues ? `non lue${nonLues > 1 ? 's' : ''}` : 'Tout est lu', couleur: '#d6453a', icone: 'bulb' },
    ];
  });

  protected readonly prochainesClasses = computed(() =>
    [...(this.donnees()?.classes ?? [])].sort((a, b) => (a.dateHeure ?? '').localeCompare(b.dateHeure ?? '')).slice(0, 4));

  protected readonly demarches = computed(() => {
    const d = this.donnees();
    if (!d) { return []; }
    const demandes = d.demandes.filter((x) => ['SOUMIS', 'EN_TRAITEMENT', 'PRET'].includes(x.statut))
      .map((x) => ({ cle: 'd' + x.id, titre: libelle(TYPES_DOCUMENT, x.typeDocument), detail: `Demandé le ${dateFr(x.dateDemande)}`, statut: libelle(STATUT_DEMANDE, x.statut), pret: x.statut === 'PRET', lien: '/mes-demandes' }));
    const justifs = d.justificatifs.filter((j) => j.statut === 'SOUMIS')
      .map((j) => ({ cle: 'j' + j.id, titre: 'Justificatif d\'absence', detail: j.dateDebut === j.dateFin ? `Absence du ${dateFr(j.dateDebut)}` : `Du ${dateFr(j.dateDebut)} au ${dateFr(j.dateFin)}`, statut: 'En attente', pret: false, lien: '/mes-justificatifs' }));
    return [...demandes, ...justifs].slice(0, 5);
  });

  protected readonly recommandations = computed(() => (this.donnees()?.recommandations ?? []).filter((r) => !r.lue).slice(0, 2));

  protected readonly dernieresNotes = computed(() => {
    const d = this.donnees();
    if (!d?.ref) { return []; }
    return d.notes
      .map((n) => ({ note: n, ev: d.ref!.evaluations.get(n.evaluationId) }))
      .filter((x) => x.ev)
      .sort((a, b) => b.ev!.date.localeCompare(a.ev!.date) || b.note.id - a.note.id)
      .slice(0, 5);
  });

  constructor() {
    const manquantes: string[] = [];
    this.espace.semestres().pipe(
      switchMap((liste) => {
        const s = semestreCourant(liste);
        this.semestre.set(s);
        const sid = s?.id;
        return forkJoin({
          indicateurs: sid ? ouVide(this.http.get<Indicateur[]>(`${API_URL}/indicateurs/mes-indicateurs`, { params: { semestreId: sid } }), [], manquantes, 'indicateurs') : of([]),
          presences: ouVide(this.http.get<PresenceDto[]>(`${API_URL}/presences/mes-presences`), [], manquantes, 'présences'),
          notes: ouVide(this.http.get<NoteDto[]>(`${API_URL}/notes/mes-notes`), [], manquantes, 'notes'),
          ref: ouVide<Referentiel | null>(this.espace.referentiel(), null, manquantes, 'calendrier'),
          recommandations: ouVide(this.http.get<Recommandation[]>(`${API_URL}/recommandations/mes-recommandations`), [], manquantes, 'recommandations'),
          classes: ouVide(this.http.get<ClasseVirtuelle[]>(`${API_URL}/classes-virtuelles/mes-classes`, { params: { avenir: true } }), [], manquantes, 'classes virtuelles'),
          demandes: ouVide(this.http.get<DemandeDocument[]>(`${API_URL}/demandes-documents/mes-demandes`), [], manquantes, 'demandes de documents'),
          justificatifs: ouVide(this.http.get<Justificatif[]>(`${API_URL}/justificatifs/mes-justificatifs`), [], manquantes, 'justificatifs'),
          matieres: ouVide(this.http.get<MatiereCredits[]>(`${API_URL}/matieres`), [], manquantes, 'matières'),
        });
      }),
    ).subscribe({
      next: (d) => { this.donnees.set(d); this.manquantes.set(manquantes); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected categorie(c: string): string { return libelle(CATEGORIES_RECOMMANDATION, c); }
  protected plateforme(p: string): string { return libelle(PLATEFORMES, p); }
  protected jour(iso?: string): string { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit' }) : ''; }
  protected mois(iso?: string): string { return iso ? new Date(iso).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : ''; }
  protected heure(iso?: string): string { return iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ') : ''; }
  protected nombre(n: number): string { return nombreFr(n); }
  protected readonly date = dateFr;
  protected readonly dateHeure = dateHeureFr;
  protected delai(i: number, base = 0.12): string { return (base + i * 0.08).toFixed(2) + 's'; }
}
