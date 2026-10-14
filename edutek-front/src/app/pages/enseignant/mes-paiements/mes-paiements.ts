import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, telechargerTexte } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Paiement, STATUTS_PAIEMENT, dureeFr, montantFr, periodeFr } from '../modeles';

/** États de paiement de l'enseignant (validés et payés), avec le détail des séances rémunérées. */
@Component({
  selector: 'app-mes-paiements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Modal],
  templateUrl: './mes-paiements.html',
  styleUrls: ['../../../shared/ui.scss', '../enseignant.scss'],
})
export class MesPaiements {
  private readonly http = inject(HttpClient);
  protected readonly dateFr = dateFr;
  protected readonly dureeFr = dureeFr;
  protected readonly montantFr = montantFr;
  protected readonly periodeFr = periodeFr;
  protected readonly statut = (s: string) => STATUTS_PAIEMENT[s] ?? { libelle: s, classe: 'gris' };

  protected readonly liste = signal<Paiement[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly cible = signal<Paiement | null>(null);

  protected readonly synthese = computed(() => {
    const l = this.liste();
    const annee = String(new Date().getFullYear());
    return {
      aVerser: l.filter((p) => p.statut === 'VALIDE').reduce((s, p) => s + p.montant, 0),
      nbAVerser: l.filter((p) => p.statut === 'VALIDE').length,
      verseAnnee: l.filter((p) => p.statut === 'PAYE' && p.periode.startsWith(annee)).reduce((s, p) => s + p.montant, 0),
      minutesAnnee: l.filter((p) => p.periode.startsWith(annee)).reduce((s, p) => s + p.minutes, 0),
      annee,
    };
  });

  constructor() { this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<Paiement[]>(`${API_URL}/paiements/mes-paiements`).subscribe({
      next: (l) => { this.liste.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected exporter(p: Paiement): void {
    const lignes = (p.lignes ?? []).map((l) => [l.date, `"${l.matiereNom.replace(/"/g, '""')}"`, l.minutes, l.tarifHoraire.toFixed(3), l.montant.toFixed(3)].join(';'));
    telechargerTexte(`etat-paiement-${p.periode}.csv`, ['date;matiere;minutes;tarif_horaire;montant', ...lignes, `total;;${p.minutes};;${p.montant.toFixed(3)}`].join('\n'));
  }
}
