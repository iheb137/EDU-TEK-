import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { aujourdhui } from '../espace-etudiant';
import { Justificatif, JustificatifRequete, MOTIFS_JUSTIFICATIF, STATUT_JUSTIFICATIF, libelle } from '../modeles';
import { confirmerPendant } from '../outils';

const DUREE_MAX_JOURS = 31;

/** Contrôle de la période : fin ≥ début, pas dans le futur, 31 jours au plus. */
function periodeValide(g: AbstractControl): ValidationErrors | null {
  const debut = g.get('dateDebut')?.value as string;
  const fin = g.get('dateFin')?.value as string;
  if (!debut || !fin) { return null; }
  if (fin < debut) { return { ordre: true }; }
  if (fin > aujourdhui()) { return { futur: true }; }
  const jours = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 86400000) + 1;
  return jours > DUREE_MAX_JOURS ? { duree: true } : null;
}

/** Justificatifs d'absence : dépôt, modification et retrait tant qu'ils ne sont pas traités. */
@Component({
  selector: 'app-mes-justificatifs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal, RouterLink],
  templateUrl: './mes-justificatifs.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss'],
})
export class MesJustificatifs {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  protected readonly motifs = Object.entries(MOTIFS_JUSTIFICATIF);
  protected readonly maxDate = aujourdhui();
  protected readonly dureeMax = DUREE_MAX_JOURS;

  protected readonly liste = signal<Justificatif[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly fenetre = signal<null | 'formulaire' | 'retirer'>(null);
  protected readonly cible = signal<Justificatif | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  protected readonly enAttente = computed(() => this.liste().filter((j) => j.statut === 'SOUMIS').length);

  protected readonly formulaire = this.fb.nonNullable.group({
    dateDebut: ['', Validators.required],
    dateFin: ['', Validators.required],
    motif: ['', Validators.required],
    commentaire: ['', Validators.maxLength(500)],
    pieceUrl: ['', [Validators.maxLength(255), Validators.pattern(/^https?:\/\/\S+$/)]],
  }, { validators: periodeValide });

  constructor() {
    this.charger();
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    if (q.get('debut')) { this.ouvrir(null, q.get('debut')!, q.get('fin') ?? q.get('debut')!); }
  }

  protected charger(): void {
    this.http.get<Justificatif[]>(`${API_URL}/justificatifs/mes-justificatifs`).subscribe({
      next: (l) => {
        this.liste.set([...l].sort((a, b) => (b.dateSoumission ?? '').localeCompare(a.dateSoumission ?? '') || b.id - a.id));
        this.erreur.set(''); this.chargement.set(false);
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected ouvrir(j: Justificatif | null, debut = '', fin = ''): void {
    this.cible.set(j);
    this.formulaire.reset({
      dateDebut: j?.dateDebut ?? debut, dateFin: j?.dateFin ?? fin, motif: j?.motif ?? '',
      commentaire: j?.commentaire ?? '', pieceUrl: j?.pieceUrl ?? '',
    });
    this.erreurFenetre.set('');
    this.fenetre.set('formulaire');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps: JustificatifRequete = {
      dateDebut: v.dateDebut, dateFin: v.dateFin, motif: v.motif,
      commentaire: v.commentaire.trim() || undefined, pieceUrl: v.pieceUrl.trim() || undefined,
    };
    const j = this.cible();
    const req = j ? this.http.put<Justificatif>(`${API_URL}/justificatifs/${j.id}`, corps) : this.http.post<Justificatif>(`${API_URL}/justificatifs`, corps);
    this.enCours.set(true);
    this.erreurFenetre.set('');
    req.subscribe({
      next: () => {
        this.enCours.set(false); this.fermer();
        confirmerPendant((m) => this.info.set(m), j ? 'Justificatif modifié.' : 'Justificatif envoyé au support administratif.');
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected demanderRetrait(j: Justificatif): void { this.cible.set(j); this.erreurFenetre.set(''); this.fenetre.set('retirer'); }

  protected retirer(): void {
    const j = this.cible();
    if (!j) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/justificatifs/${j.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); confirmerPendant((m) => this.info.set(m), 'Justificatif retiré.'); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  protected champInvalide(nom: 'dateDebut' | 'dateFin' | 'motif' | 'commentaire' | 'pieceUrl'): boolean {
    const c = this.formulaire.controls[nom]; return c.touched && c.invalid;
  }
  protected erreurPeriode(): string {
    const e = this.formulaire.errors;
    if (!e || !(this.formulaire.controls.dateDebut.touched || this.formulaire.controls.dateFin.touched)) { return ''; }
    if (e['ordre']) { return 'La date de fin doit être postérieure ou égale à la date de début.'; }
    if (e['futur']) { return 'La date de fin ne peut pas être dans le futur.'; }
    if (e['duree']) { return `La période est limitée à ${DUREE_MAX_JOURS} jours.`; }
    return '';
  }
  protected periode(j: Justificatif): string { return j.dateDebut === j.dateFin ? `Le ${dateFr(j.dateDebut)}` : `Du ${dateFr(j.dateDebut)} au ${dateFr(j.dateFin)}`; }
  protected motif(m: string): string { return libelle(MOTIFS_JUSTIFICATIF, m); }
  protected statut(s: string): string { return libelle(STATUT_JUSTIFICATIF, s); }
  protected readonly dateHeure = dateHeureFr;
}
