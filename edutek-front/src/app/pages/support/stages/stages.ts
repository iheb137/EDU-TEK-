import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { STATUT_STAGE, Stage, classePuce, nbJours, periodeFr } from '../modeles';

type Fenetre = null | 'detail' | 'valider' | 'rejeter';
const ONGLETS = [
  { valeur: 'PROPOSE', libelle: 'À valider' },
  { valeur: 'VALIDE', libelle: 'Validés' },
  { valeur: 'REJETE', libelle: 'Rejetés' },
  { valeur: 'TOUS', libelle: 'Tous' },
];

/** Conventions de stage proposées par les étudiants : validation (admin communication) et consultation. */
@Component({
  selector: 'app-stages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './stages.html',
  styleUrls: ['../../../shared/ui.scss', '../support.scss'],
})
export class Stages {
  private readonly http = inject(HttpClient);
  protected readonly peutValider = inject(Auth).a('ADMIN_COMMUNICATION');

  protected readonly onglets = ONGLETS;
  protected readonly libelleStatut = (s: string) => STATUT_STAGE[s] ?? s;
  protected readonly puce = classePuce;
  protected readonly periode = periodeFr;

  protected readonly liste = signal<Stage[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly statut = signal(this.peutValider ? 'PROPOSE' : 'TOUS');
  protected readonly recherche = signal('');

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly cible = signal<Stage | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly motifRejet = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5), Validators.maxLength(500)] });

  protected readonly comptes = computed(() => {
    const c: Partial<Record<string, number>> = { TOUS: 0 };
    for (const s of this.liste() ?? []) { c['TOUS'] = (c['TOUS'] ?? 0) + 1; c[s.statut] = (c[s.statut] ?? 0) + 1; }
    return c;
  });
  protected readonly affiches = computed(() => {
    const s = this.statut();
    const q = this.recherche().trim().toLowerCase();
    return (this.liste() ?? [])
      .filter((x) => (s === 'TOUS' || x.statut === s)
        && (!q || [x.etudiantNom, x.entreprise, x.sujet].some((v) => (v ?? '').toLowerCase().includes(q))))
      .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  });

  constructor() {
    const s = inject(ActivatedRoute).snapshot.queryParamMap.get('statut');
    if (s && ONGLETS.some((o) => o.valeur === s)) { this.statut.set(s); }
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<Stage[]>(`${API_URL}/stages`).subscribe({
      next: (l) => { this.liste.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  /** Durée lisible : « 26 semaines » (ou en jours pour moins de deux semaines). */
  protected duree(s: Stage): string {
    const j = nbJours(s.dateDebut, s.dateFin);
    if (j < 14) { return `${j} jour${j > 1 ? 's' : ''}`; }
    return `${Math.round(j / 7)} semaines`;
  }

  protected voir(s: Stage): void { this.cible.set(s); this.erreurFenetre.set(''); this.fenetre.set('detail'); }
  protected demanderValidation(s: Stage): void { this.cible.set(s); this.erreurFenetre.set(''); this.fenetre.set('valider'); }
  protected demanderRejet(s: Stage): void { this.cible.set(s); this.motifRejet.reset(''); this.erreurFenetre.set(''); this.fenetre.set('rejeter'); }

  protected valider(): void {
    const s = this.cible();
    if (!s) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<Stage>(`${API_URL}/stages/${s.id}/valider`, null).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(`Stage de ${s.etudiantNom} chez ${s.entreprise} validé.`); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected rejeter(): void {
    const s = this.cible();
    this.motifRejet.markAsTouched();
    if (!s || this.motifRejet.invalid) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<Stage>(`${API_URL}/stages/${s.id}/rejeter`, { motif: this.motifRejet.value.trim() }).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(`Stage de ${s.etudiantNom} rejeté. L'étudiant est informé du motif.`); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;
  private confirmer(m: string): void { clearTimeout(this.minuteurInfo); this.info.set(m); this.minuteurInfo = setTimeout(() => this.info.set(''), 4000); }
}
