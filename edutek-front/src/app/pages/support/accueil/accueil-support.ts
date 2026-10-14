import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { DemandeDocument, Justificatif, MOTIF_JUSTIFICATIF, STATUT_DEMANDE, TYPE_DOCUMENT, classePuce, periodeFr } from '../modeles';

const ORDRE_STATUTS = ['SOUMIS', 'EN_TRAITEMENT', 'PRET', 'REMIS', 'REJETE'];
const COULEUR_STATUT: Record<string, string> = { SOUMIS: '#d98a00', EN_TRAITEMENT: '#3d5bd6', PRET: '#1f9d78', REMIS: '#55648a', REJETE: '#c2372c' };

/** Tableau de bord de l'administrateur support : justificatifs à traiter et demandes de documents. */
@Component({
  selector: 'app-accueil-support',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './accueil-support.html',
  styleUrls: ['../../../shared/ui.scss', '../support.scss', './accueil-support.scss'],
})
export class AccueilSupport {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(Auth);

  protected readonly libelleMotif = (m: string) => MOTIF_JUSTIFICATIF[m] ?? m;
  protected readonly libelleType = (t: string) => TYPE_DOCUMENT[t] ?? t;
  protected readonly libelleStatut = (s: string) => STATUT_DEMANDE[s] ?? s;
  protected readonly puce = classePuce;
  protected readonly periode = periodeFr;
  protected readonly quand = dateHeureFr;

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly justificatifs = signal<Justificatif[]>([]);
  protected readonly demandes = signal<DemandeDocument[]>([]);

  /** File d'attente : les plus anciens d'abord. */
  protected readonly aTraiter = computed(() => [...this.justificatifs()].sort((a, b) => (a.dateSoumission ?? '').localeCompare(b.dateSoumission ?? '')));
  protected readonly demandesOuvertes = computed(() => this.demandes().filter((d) => d.statut === 'SOUMIS' || d.statut === 'EN_TRAITEMENT')
    .sort((a, b) => a.dateDemande.localeCompare(b.dateDemande)));
  protected readonly parStatut = computed(() => {
    const c = new Map<string, number>();
    this.demandes().forEach((d) => c.set(d.statut, (c.get(d.statut) ?? 0) + 1));
    const max = Math.max(1, ...c.values());
    return ORDRE_STATUTS.map((s) => ({ statut: s, libelle: STATUT_DEMANDE[s], n: c.get(s) ?? 0, part: ((c.get(s) ?? 0) / max) * 100, couleur: COULEUR_STATUT[s] }));
  });
  private readonly nb = (s: string) => this.demandes().filter((d) => d.statut === s).length;

  protected readonly indicateurs = computed(() => [
    { titre: 'Justificatifs à traiter', valeur: this.justificatifs().length, note: 'déposés par les étudiants', couleur: '#d98a00', icone: 'medkit', lien: '/justificatifs' },
    { titre: 'Nouvelles demandes', valeur: this.nb('SOUMIS'), note: 'documents à prendre en charge', couleur: '#3d5bd6', icone: 'document-text', lien: '/demandes-documents' },
    { titre: 'En traitement', valeur: this.nb('EN_TRAITEMENT'), note: 'documents à livrer', couleur: '#0a1b45', icone: 'hourglass', lien: '/demandes-documents' },
    { titre: 'À retirer au bureau', valeur: this.nb('PRET'), note: 'documents prêts, en attente de l\'étudiant', couleur: '#1f9d78', icone: 'checkmark-done', lien: '/demandes-documents' },
  ]);

  constructor() { this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    const erreurs: string[] = [];
    const sur = <T,>(o: Observable<T>, defaut: T) => o.pipe(catchError((e: unknown) => { erreurs.push(Auth.message(e)); return of(defaut); }));
    forkJoin({
      justificatifs: sur(this.http.get<Justificatif[]>(`${API_URL}/justificatifs`, { params: { statut: 'SOUMIS' } }), [] as Justificatif[]),
      demandes: sur(this.http.get<DemandeDocument[]>(`${API_URL}/demandes-documents`), [] as DemandeDocument[]),
    }).subscribe((r) => {
      this.justificatifs.set(r.justificatifs);
      this.demandes.set(r.demandes);
      this.erreur.set([...new Set(erreurs)].join(' '));
      this.chargement.set(false);
    });
  }

  protected delai(i: number, base = 0.15): string { return (base + i * 0.08).toFixed(2) + 's'; }
}
