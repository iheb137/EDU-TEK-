import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';
import { Auth } from '../../../../core/auth';
import { API_URL } from '../../../../core/config';
import { dateFr, dateHeureFr } from '../../../../shared/format';
import { Icon } from '../../../../shared/icon/icon';
import { Modal } from '../../../../shared/modal/modal';
import { EnseignantRef, Pointage, STATUTS_POINTAGE, dureeFr, heure, moisCourant, periodeFr } from '../../modeles';

type Fenetre = null | 'corriger' | 'anomalie' | 'lot' | 'detail';

/** File de traitement des pointages par le service financier. */
@Component({
  selector: 'app-pointages-finance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './pointages.html',
  styleUrls: ['../../../../shared/ui.scss', '../../enseignant.scss'],
})
export class PointagesFinance {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  protected readonly peutTraiter = inject(Auth).a('ADMIN_FINANCIER');
  protected readonly dateFr = dateFr;
  protected readonly dateHeureFr = dateHeureFr;
  protected readonly dureeFr = dureeFr;
  protected readonly heure = heure;
  protected readonly periodeFr = periodeFr;
  protected readonly statuts = Object.entries(STATUTS_POINTAGE).map(([code, s]) => ({ code, ...s }));
  protected readonly statut = (s: string) => STATUTS_POINTAGE[s] ?? { libelle: s, classe: 'gris' };

  protected readonly liste = signal<Pointage[]>([]);
  protected readonly enseignants = signal<EnseignantRef[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly periode = signal('');
  protected readonly filtreStatut = signal('EN_ATTENTE');
  protected readonly enseignantId = signal(0);
  protected readonly traitement = signal<number | null>(null);

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly cible = signal<Pointage | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly nbLot = signal<number | null>(null);

  protected readonly formCorrection = this.fb.nonNullable.group({
    minutes: [0, [Validators.required, Validators.min(1), Validators.max(720)]],
    commentaire: ['', [Validators.required, Validators.maxLength(500)]],
  });
  protected readonly formAnomalie = this.fb.nonNullable.group({ commentaire: ['', [Validators.required, Validators.maxLength(500)]] });
  protected readonly formLot = this.fb.nonNullable.group({ periode: [moisCourant(), Validators.required], enseignantId: [0] });

  protected readonly totaux = computed(() => {
    const l = this.liste();
    return { nb: l.length, declarees: l.reduce((s, p) => s + p.minutesDeclarees, 0), ecarts: l.filter((p) => p.minutesDeclarees !== p.minutesPlanifiees).length };
  });

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    if (q.has('statut')) { this.filtreStatut.set(q.get('statut') ?? ''); }
    if (q.get('periode')) { this.periode.set(q.get('periode')!); }
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
    this.http.get<Pointage[]>(`${API_URL}/pointages`, { params: p }).subscribe({
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

  // ── Décisions unitaires ─────────────────────────────────────────────────
  protected valider(p: Pointage): void {
    this.traitement.set(p.id);
    this.erreur.set('');
    this.http.post<Pointage>(`${API_URL}/pointages/${p.id}/valider`, null).subscribe({
      next: (maj) => { this.traitement.set(null); this.remplacer(maj); this.confirmer(`Pointage validé : ${maj.enseignantNom}, ${dateFr(maj.date)} (${dureeFr(maj.minutesValidees)}).`); },
      error: (e: unknown) => { this.traitement.set(null); this.erreur.set(Auth.message(e)); },
    });
  }

  protected ouvrir(f: 'corriger' | 'anomalie' | 'detail', p: Pointage): void {
    this.cible.set(p);
    this.formCorrection.reset({ minutes: p.minutesValidees ?? p.minutesDeclarees, commentaire: '' });
    this.formAnomalie.reset({ commentaire: '' });
    this.erreurFenetre.set('');
    this.fenetre.set(f);
  }

  protected corriger(): void {
    this.formCorrection.markAllAsTouched();
    const p = this.cible();
    if (this.formCorrection.invalid || !p) { return; }
    const v = this.formCorrection.getRawValue();
    this.decider(this.http.post<Pointage>(`${API_URL}/pointages/${p.id}/corriger`, { minutes: Number(v.minutes), commentaire: v.commentaire.trim() }), 'Pointage corrigé');
  }

  protected signaler(): void {
    this.formAnomalie.markAllAsTouched();
    const p = this.cible();
    if (this.formAnomalie.invalid || !p) { return; }
    this.decider(this.http.post<Pointage>(`${API_URL}/pointages/${p.id}/anomalie`, { commentaire: this.formAnomalie.getRawValue().commentaire.trim() }), 'Pointage signalé en anomalie');
  }

  private decider(req: Observable<Pointage>, message: string): void {
    this.enCours.set(true);
    this.erreurFenetre.set('');
    req.subscribe({
      next: (maj) => { this.enCours.set(false); this.fermer(); this.remplacer(maj); this.confirmer(`${message} : ${maj.enseignantNom}, ${dateFr(maj.date)}. L'enseignant est notifié.`); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  /** Remplace la ligne ; la retire si elle ne correspond plus au filtre de statut. */
  private remplacer(maj: Pointage): void {
    const f = this.filtreStatut();
    this.liste.update((l) => (f && maj.statut !== f ? l.filter((x) => x.id !== maj.id) : l.map((x) => (x.id === maj.id ? maj : x))));
  }

  // ── Validation d'une période en lot ─────────────────────────────────────
  protected ouvrirLot(): void {
    this.formLot.reset({ periode: this.periode() || moisCourant(), enseignantId: this.enseignantId() });
    this.erreurFenetre.set('');
    this.fenetre.set('lot');
    this.compterLot();
  }

  protected compterLot(): void {
    const v = this.formLot.getRawValue();
    this.nbLot.set(null);
    if (!v.periode) { return; }
    let p = new HttpParams().set('periode', v.periode).set('statut', 'EN_ATTENTE');
    if (Number(v.enseignantId)) { p = p.set('enseignantId', Number(v.enseignantId)); }
    this.http.get<Pointage[]>(`${API_URL}/pointages`, { params: p }).subscribe({
      next: (l) => this.nbLot.set(l.length),
      error: (e: unknown) => this.erreurFenetre.set(Auth.message(e)),
    });
  }

  protected validerLot(): void {
    this.formLot.markAllAsTouched();
    if (this.formLot.invalid) { return; }
    const v = this.formLot.getRawValue();
    let p = new HttpParams().set('periode', v.periode);
    if (Number(v.enseignantId)) { p = p.set('enseignantId', Number(v.enseignantId)); }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<{ valides: number }>(`${API_URL}/pointages/valider-periode`, null, { params: p }).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.fermer();
        this.confirmer(`${r.valides} pointage${r.valides > 1 ? 's' : ''} validé${r.valides > 1 ? 's' : ''} pour ${periodeFr(v.periode).toLowerCase()}.`);
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected nomEnseignant(id: number): string {
    const e = this.enseignants().find((x) => x.id === id);
    return e ? `${e.prenom} ${e.nom}` : '';
  }
  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
