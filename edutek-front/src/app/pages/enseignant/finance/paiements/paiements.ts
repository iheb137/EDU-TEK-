import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Auth } from '../../../../core/auth';
import { API_URL } from '../../../../core/config';
import { dateFr, dateHeureFr, telechargerTexte } from '../../../../shared/format';
import { Icon } from '../../../../shared/icon/icon';
import { Modal } from '../../../../shared/modal/modal';
import { EnseignantRef, Generation, Paiement, STATUTS_PAIEMENT, dureeFr, montantFr, moisCourant, periodeFr } from '../../modeles';

type Action = 'valider' | 'payer' | 'supprimer';

/** États de paiement des enseignants : génération mensuelle, validation, paiement. */
@Component({
  selector: 'app-paiements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './paiements.html',
  styleUrls: ['../../../../shared/ui.scss', '../../enseignant.scss', './paiements.scss'],
})
export class Paiements {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  protected readonly peutDecider = this.auth.a('ADMIN_FINANCIER');
  protected readonly peutGenerer = this.auth.a('ADMIN_FINANCIER', 'SUPERADMIN');
  protected readonly dateFr = dateFr;
  protected readonly dateHeureFr = dateHeureFr;
  protected readonly dureeFr = dureeFr;
  protected readonly montantFr = montantFr;
  protected readonly periodeFr = periodeFr;
  protected readonly moisMax = moisCourant();
  protected readonly statuts = Object.entries(STATUTS_PAIEMENT).map(([code, s]) => ({ code, ...s }));
  protected readonly statut = (s: string) => STATUTS_PAIEMENT[s] ?? { libelle: s, classe: 'gris' };

  protected readonly liste = signal<Paiement[]>([]);
  protected readonly enseignants = signal<EnseignantRef[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly periode = signal('');
  protected readonly filtreStatut = signal('');
  protected readonly enseignantId = signal(0);

  protected readonly generation = signal<Generation | null>(null);
  protected readonly generationEnCours = signal(false);
  protected readonly erreurGeneration = signal('');
  protected readonly formGeneration = this.fb.nonNullable.group({ periode: [moisCourant(-1), Validators.required], enseignantId: [0] });

  protected readonly fenetre = signal<null | 'detail' | Action>(null);
  protected readonly cible = signal<Paiement | null>(null);
  protected readonly detail = signal<Paiement | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  protected readonly totaux = computed(() => {
    const l = this.liste();
    const somme = (s: string) => l.filter((p) => p.statut === s).reduce((t, p) => t + p.montant, 0);
    return { brouillon: somme('BROUILLON'), valide: somme('VALIDE'), paye: somme('PAYE'), nbBrouillon: l.filter((p) => p.statut === 'BROUILLON').length, nbValide: l.filter((p) => p.statut === 'VALIDE').length };
  });

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    if (q.get('statut')) { this.filtreStatut.set(q.get('statut')!); }
    if (q.get('periode')) { this.periode.set(q.get('periode')!); this.formGeneration.controls.periode.setValue(q.get('periode')!); }
    this.charger();
    this.http.get<EnseignantRef[]>(`${API_URL}/enseignants`).pipe(catchError(() => of([] as EnseignantRef[])))
      .subscribe((l) => this.enseignants.set([...l].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))));
  }

  protected charger(): void {
    this.chargement.set(true);
    let p = new HttpParams();
    if (this.periode()) { p = p.set('periode', this.periode()); }
    if (this.filtreStatut()) { p = p.set('statut', this.filtreStatut()); }
    if (this.enseignantId()) { p = p.set('enseignantId', this.enseignantId()); }
    this.http.get<Paiement[]>(`${API_URL}/paiements`, { params: p }).subscribe({
      next: (l) => { this.liste.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected filtrer(champ: 'periode' | 'statut' | 'enseignant', v: string): void {
    if (champ === 'periode') { this.periode.set(v); }
    if (champ === 'statut') { this.filtreStatut.set(v); }
    if (champ === 'enseignant') { this.enseignantId.set(Number(v)); }
    this.charger();
  }

  // ── Génération ──────────────────────────────────────────────────────────
  protected generer(): void {
    this.formGeneration.markAllAsTouched();
    if (this.formGeneration.invalid) { return; }
    const v = this.formGeneration.getRawValue();
    if (v.periode > this.moisMax) { this.erreurGeneration.set('Impossible de générer un état pour un mois à venir.'); return; }
    let p = new HttpParams().set('periode', v.periode);
    if (Number(v.enseignantId)) { p = p.set('enseignantId', Number(v.enseignantId)); }
    this.generationEnCours.set(true);
    this.erreurGeneration.set('');
    this.generation.set(null);
    this.http.post<Generation>(`${API_URL}/paiements/generer`, null, { params: p }).subscribe({
      next: (r) => {
        this.generationEnCours.set(false);
        this.generation.set(r);
        // Affiche la période générée dans la liste.
        this.periode.set(r.periode);
        this.filtreStatut.set('');
        this.charger();
      },
      error: (e: unknown) => { this.generationEnCours.set(false); this.erreurGeneration.set(Auth.message(e)); },
    });
  }

  // ── Détail et décisions ─────────────────────────────────────────────────
  protected ouvrirDetail(p: Paiement): void {
    this.cible.set(p);
    this.detail.set(null);
    this.erreurFenetre.set('');
    this.fenetre.set('detail');
    this.http.get<Paiement>(`${API_URL}/paiements/${p.id}`).subscribe({
      next: (d) => this.detail.set(d),
      error: (e: unknown) => this.erreurFenetre.set(Auth.message(e)),
    });
  }

  protected demander(a: Action, p: Paiement): void { this.cible.set(p); this.erreurFenetre.set(''); this.fenetre.set(a); }

  protected executer(a: Action): void {
    const p = this.cible();
    if (!p) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    const req = a === 'supprimer' ? this.http.delete(`${API_URL}/paiements/${p.id}`) : this.http.post<Paiement>(`${API_URL}/paiements/${p.id}/${a}`, null);
    const messages: Record<Action, string> = {
      valider: `État validé : ${p.enseignantNom}, ${periodeFr(p.periode).toLowerCase()}. Il est désormais visible par l'enseignant.`,
      payer: `État marqué comme payé : ${p.enseignantNom}, ${periodeFr(p.periode).toLowerCase()} (${montantFr(p.montant)}).`,
      supprimer: `Brouillon supprimé : ${p.enseignantNom}, ${periodeFr(p.periode).toLowerCase()}.`,
    };
    req.subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(messages[a]); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected exporter(p: Paiement): void {
    const lignes = (p.lignes ?? []).map((l) => [l.date, `"${l.matiereNom.replace(/"/g, '""')}"`, l.minutes, l.tarifHoraire.toFixed(3), l.montant.toFixed(3)].join(';'));
    const nom = p.enseignantNom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
    telechargerTexte(`etat-paiement-${p.periode}-${nom}.csv`, ['date;matiere;minutes;tarif_horaire;montant', ...lignes, `total;;${p.minutes};;${p.montant.toFixed(3)}`].join('\n'));
  }

  protected exporterListe(): void {
    const l = this.liste().map((p) => [p.periode, `"${p.enseignantNom}"`, p.minutes, p.montant.toFixed(3), p.statut].join(';'));
    telechargerTexte(`etats-paiement${this.periode() ? '-' + this.periode() : ''}.csv`, ['periode;enseignant;minutes;montant;statut', ...l].join('\n'));
  }

  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
