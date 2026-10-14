import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { DemandeDocument, STATUT_DEMANDE, TYPE_DOCUMENT, classePuce } from '../modeles';

type Fenetre = null | 'prendre' | 'pret' | 'remettre' | 'rejeter';
const ONGLETS = [
  { valeur: 'SOUMIS', libelle: 'Nouvelles' },
  { valeur: 'EN_TRAITEMENT', libelle: 'En traitement' },
  { valeur: 'PRET', libelle: 'À retirer' },
  { valeur: 'REMIS', libelle: 'Remises' },
  { valeur: 'REJETE', libelle: 'Rejetées' },
  { valeur: 'TOUS', libelle: 'Toutes' },
];

/** Demandes de documents administratifs : prise en charge, document prêt à retirer au bureau, remise à l'étudiant ou rejet. */
@Component({
  selector: 'app-demandes-documents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './demandes-documents.html',
  styleUrls: ['../../../shared/ui.scss', '../support.scss', './demandes-documents.scss'],
})
export class DemandesDocuments {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  protected readonly peutTraiter = this.auth.a('ADMIN_SUPPORT');

  protected readonly onglets = ONGLETS;
  protected readonly libelleStatut = (s: string) => STATUT_DEMANDE[s] ?? s;
  protected readonly libelleType = (t: string) => TYPE_DOCUMENT[t] ?? t;
  protected readonly puce = classePuce;
  protected readonly quand = dateHeureFr;

  protected readonly liste = signal<DemandeDocument[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly statut = signal(this.peutTraiter ? 'SOUMIS' : 'TOUS');
  protected readonly recherche = signal('');

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly cible = signal<DemandeDocument | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly motifRejet = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)] });
  protected readonly messageRetrait = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] });
  /** Consigne proposée par défaut, modifiable avant envoi. */
  private readonly consigneParDefaut = 'À retirer au bureau de la scolarité, du lundi au vendredi de 9 h à 12 h et de 14 h à 16 h.';

  protected readonly comptes = computed(() => {
    const c: Partial<Record<string, number>> = { TOUS: 0 };
    for (const d of this.liste() ?? []) { c['TOUS'] = (c['TOUS'] ?? 0) + 1; c[d.statut] = (c[d.statut] ?? 0) + 1; }
    return c;
  });
  protected readonly affiches = computed(() => {
    const s = this.statut();
    const q = this.recherche().trim().toLowerCase();
    const l = (this.liste() ?? []).filter((d) => (s === 'TOUS' || d.statut === s)
      && (!q || d.etudiantNom.toLowerCase().includes(q) || (d.etudiantMatricule ?? '').toLowerCase().includes(q)));
    // Les demandes ouvertes se traitent dans l'ordre d'arrivée ; les autres s'affichent de la plus récente à la plus ancienne.
    const ouvert = s === 'SOUMIS' || s === 'EN_TRAITEMENT';
    return [...l].sort((a, b) => ouvert ? a.dateDemande.localeCompare(b.dateDemande) : b.dateDemande.localeCompare(a.dateDemande));
  });

  constructor() {
    const s = inject(ActivatedRoute).snapshot.queryParamMap.get('statut');
    if (s && ONGLETS.some((o) => o.valeur === s)) { this.statut.set(s); }
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<DemandeDocument[]>(`${API_URL}/demandes-documents`).subscribe({
      next: (l) => { this.liste.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  // ── Actions ─────────────────────────────────────────────────────────────
  protected demander(f: Exclude<Fenetre, null>, d: DemandeDocument): void {
    this.cible.set(d);
    this.erreurFenetre.set('');
    this.motifRejet.reset('');
    this.messageRetrait.reset(this.consigneParDefaut);
    this.fenetre.set(f);
  }

  protected prendreEnCharge(): void {
    const d = this.cible();
    if (!d) { return; }
    this.executer(`${API_URL}/demandes-documents/${d.id}/prendre-en-charge`, null,
      `Demande de ${d.etudiantNom} prise en charge. Elle figure désormais dans l'onglet « En traitement ».`, 'EN_TRAITEMENT');
  }

  protected marquerPret(): void {
    const d = this.cible();
    this.messageRetrait.markAsTouched();
    if (!d || this.messageRetrait.invalid) { return; }
    this.executer(`${API_URL}/demandes-documents/${d.id}/marquer-pret`, { message: this.messageRetrait.value.trim() || null },
      `« ${this.libelleType(d.typeDocument)} » de ${d.etudiantNom} prêt à retirer : l'étudiant est invité à passer au bureau.`, 'PRET');
  }

  protected remettre(): void {
    const d = this.cible();
    if (!d) { return; }
    this.executer(`${API_URL}/demandes-documents/${d.id}/remettre`, null,
      `Remise enregistrée : « ${this.libelleType(d.typeDocument)} » remis à ${d.etudiantNom}.`, 'REMIS');
  }

  protected rejeter(): void {
    const d = this.cible();
    this.motifRejet.markAsTouched();
    if (!d || this.motifRejet.invalid) { return; }
    this.executer(`${API_URL}/demandes-documents/${d.id}/rejeter`, { motif: this.motifRejet.value.trim() },
      `Demande de ${d.etudiantNom} rejetée. L'étudiant est informé du motif.`, null);
  }

  private executer(url: string, corps: unknown, message: string, ongletSuivant: string | null): void {
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<DemandeDocument>(url, corps).subscribe({
      next: () => {
        this.enCours.set(false);
        this.fermer();
        this.confirmer(message);
        if (ongletSuivant) { this.statut.set(ongletSuivant); }
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;
  private confirmer(m: string): void { clearTimeout(this.minuteurInfo); this.info.set(m); this.minuteurInfo = setTimeout(() => this.info.set(''), 4000); }
}
