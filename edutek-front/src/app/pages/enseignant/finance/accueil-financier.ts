import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Paiement, Pointage, STATUTS_PAIEMENT, Tarif, aujourdhui, dureeFr, heure, moisCourant, montantFr, periodeFr } from '../modeles';

/** Accueil du service financier : pointages à traiter et états de paiement à valider ou payer. */
@Component({
  selector: 'app-accueil-financier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  templateUrl: './accueil-financier.html',
  styleUrls: ['../../../shared/ui.scss', '../enseignant.scss', './accueil-financier.scss'],
})
export class AccueilFinancier {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(Auth);
  protected readonly peutTraiter = this.auth.a('ADMIN_FINANCIER');
  protected readonly dateFr = dateFr;
  protected readonly dureeFr = dureeFr;
  protected readonly montantFr = montantFr;
  protected readonly periodeFr = periodeFr;
  protected readonly heure = heure;
  protected readonly statutPaiement = (s: string) => STATUTS_PAIEMENT[s] ?? { libelle: s, classe: 'gris' };
  protected readonly moisPrecedent = moisCourant(-1);

  protected readonly pointages = signal<Pointage[]>([]);
  protected readonly anomalies = signal<Pointage[]>([]);
  protected readonly paiements = signal<Paiement[]>([]);
  protected readonly tarifs = signal<Tarif[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');

  /** Pointages en attente regroupés par mois (du plus ancien au plus récent). */
  protected readonly parMois = computed(() => {
    const m = new Map<string, { periode: string; nb: number; minutes: number; enseignants: Set<number> }>();
    for (const p of this.pointages()) {
      const k = p.date.slice(0, 7);
      const g = m.get(k) ?? { periode: k, nb: 0, minutes: 0, enseignants: new Set<number>() };
      g.nb++; g.minutes += p.minutesDeclarees; g.enseignants.add(p.enseignantId);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => a.periode.localeCompare(b.periode));
  });
  protected readonly plusAnciens = computed(() => [...this.pointages()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5));
  protected readonly brouillons = computed(() => this.paiements().filter((p) => p.statut === 'BROUILLON'));
  protected readonly aPayer = computed(() => this.paiements().filter((p) => p.statut === 'VALIDE'));
  protected readonly aTraiter = computed(() => [...this.brouillons(), ...this.aPayer()].slice(0, 6));
  protected readonly somme = (l: Paiement[]) => l.reduce((s, p) => s + p.montant, 0);
  protected readonly tarifGeneral = computed(() => {
    const jour = aujourdhui();
    return this.tarifs().filter((t) => !t.grade?.trim() && t.dateDebut <= jour).sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))[0] ?? null;
  });
  protected readonly ecarts = computed(() => this.pointages().filter((p) => p.minutesDeclarees !== p.minutesPlanifiees).length);

  constructor() { this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      pointages: this.http.get<Pointage[]>(`${API_URL}/pointages`, { params: { statut: 'EN_ATTENTE' } }),
      anomalies: this.http.get<Pointage[]>(`${API_URL}/pointages`, { params: { statut: 'ANOMALIE' } }).pipe(catchError(() => of([] as Pointage[]))),
      paiements: this.http.get<Paiement[]>(`${API_URL}/paiements`),
      tarifs: this.http.get<Tarif[]>(`${API_URL}/tarifs`).pipe(catchError(() => of([] as Tarif[]))),
    }).subscribe({
      next: (r) => {
        this.pointages.set(r.pointages); this.anomalies.set(r.anomalies); this.paiements.set(r.paiements); this.tarifs.set(r.tarifs);
        this.erreur.set(''); this.chargement.set(false);
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }
}
