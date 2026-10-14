import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Justificatif, MOTIF_JUSTIFICATIF, STATUT_JUSTIFICATIF, classePuce, nbJours, periodeFr } from '../modeles';

type Fenetre = null | 'detail' | 'valider' | 'rejeter';
const ONGLETS = [
  { valeur: 'SOUMIS', libelle: 'À traiter' },
  { valeur: 'VALIDE', libelle: 'Validés' },
  { valeur: 'REJETE', libelle: 'Rejetés' },
  { valeur: 'TOUS', libelle: 'Tous' },
];

/** File des justificatifs d'absence : consultation (SuperAdmin) et traitement (admin support). */
@Component({
  selector: 'app-justificatifs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './justificatifs.html',
  styleUrls: ['../../../shared/ui.scss', '../support.scss'],
})
export class Justificatifs {
  private readonly http = inject(HttpClient);
  protected readonly peutTraiter = inject(Auth).a('ADMIN_SUPPORT');

  protected readonly onglets = ONGLETS;
  protected readonly libelleStatut = (s: string) => STATUT_JUSTIFICATIF[s] ?? s;
  protected readonly libelleMotif = (m: string) => MOTIF_JUSTIFICATIF[m] ?? m;
  protected readonly puce = classePuce;
  protected readonly periode = periodeFr;
  protected readonly jours = nbJours;
  protected readonly quand = dateHeureFr;

  protected readonly liste = signal<Justificatif[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly statut = signal(this.peutTraiter ? 'SOUMIS' : 'TOUS');
  protected readonly etudiantId = signal<number | null>(null);
  /** Étudiants rencontrés dans les listes (l'admin support n'a pas accès à l'annuaire des étudiants). */
  private readonly connus = signal(new Map<number, string>());

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly cible = signal<Justificatif | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly motifRejet = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)] });

  protected readonly etudiants = computed(() => [...this.connus().entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
  protected readonly comptes = computed(() => {
    const c: Partial<Record<string, number>> = { TOUS: 0, SOUMIS: 0, VALIDE: 0, REJETE: 0 };
    for (const j of this.liste() ?? []) { c['TOUS'] = (c['TOUS'] ?? 0) + 1; c[j.statut] = (c[j.statut] ?? 0) + 1; }
    return c;
  });
  protected readonly affiches = computed(() => {
    const s = this.statut();
    const l = (this.liste() ?? []).filter((j) => s === 'TOUS' || j.statut === s);
    // La file « à traiter » se lit du plus ancien au plus récent ; les autres vues, du plus récent au plus ancien.
    const t = (j: Justificatif) => j.dateDecision ?? j.dateSoumission ?? '';
    return s === 'SOUMIS' ? [...l].sort((a, b) => t(a).localeCompare(t(b))) : [...l].sort((a, b) => t(b).localeCompare(t(a)));
  });

  private aOuvrir: number | null = null;

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const s = q.get('statut');
    if (s && ONGLETS.some((o) => o.valeur === s)) { this.statut.set(s); }
    const id = Number(q.get('id'));
    if (id) { this.aOuvrir = id; }
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    let p = new HttpParams();
    if (this.etudiantId()) { p = p.set('etudiantId', this.etudiantId()!); }
    this.http.get<Justificatif[]>(`${API_URL}/justificatifs`, { params: p }).subscribe({
      next: (l) => {
        this.liste.set(l);
        this.erreur.set('');
        this.chargement.set(false);
        this.connus.update((m) => { const n = new Map(m); l.forEach((j) => n.set(j.etudiantId, `${j.etudiantNom}${j.etudiantMatricule ? ' · ' + j.etudiantMatricule : ''}`)); return n; });
        if (this.aOuvrir) {
          const j = l.find((x) => x.id === this.aOuvrir);
          this.aOuvrir = null;
          if (j) { this.statut.set(j.statut); this.voir(j); }
        }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisirEtudiant(v: string): void { this.etudiantId.set(v ? Number(v) : null); this.charger(); }

  protected voir(j: Justificatif): void { this.cible.set(j); this.erreurFenetre.set(''); this.fenetre.set('detail'); }
  protected demanderValidation(j: Justificatif): void { this.cible.set(j); this.erreurFenetre.set(''); this.fenetre.set('valider'); }
  protected demanderRejet(j: Justificatif): void { this.cible.set(j); this.motifRejet.reset(''); this.erreurFenetre.set(''); this.fenetre.set('rejeter'); }

  protected valider(): void {
    const j = this.cible();
    if (!j) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<Justificatif>(`${API_URL}/justificatifs/${j.id}/valider`, null).subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.fermer();
        const n = r?.nbAbsencesJustifiees ?? 0;
        this.confirmer(`Justificatif de ${j.etudiantNom} validé : ${n} absence${n > 1 ? 's' : ''} justifiée${n > 1 ? 's' : ''}.`);
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected rejeter(): void {
    const j = this.cible();
    this.motifRejet.markAsTouched();
    if (!j || this.motifRejet.invalid) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<Justificatif>(`${API_URL}/justificatifs/${j.id}/rejeter`, { motif: this.motifRejet.value.trim() }).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(`Justificatif de ${j.etudiantNom} rejeté. L'étudiant est informé du motif.`); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;
  private confirmer(m: string): void { clearTimeout(this.minuteurInfo); this.info.set(m); this.minuteurInfo = setTimeout(() => this.info.set(''), 4000); }
}
