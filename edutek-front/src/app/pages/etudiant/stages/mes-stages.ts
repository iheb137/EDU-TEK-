import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { STATUT_STAGE, Stage, StageRequete, libelle } from '../modeles';
import { confirmerPendant } from '../outils';

function periodeValide(g: AbstractControl): ValidationErrors | null {
  const d = g.get('dateDebut')?.value as string;
  const f = g.get('dateFin')?.value as string;
  return d && f && f <= d ? { ordre: true } : null;
}

/** Stages de l'étudiant : proposition, modification et retrait tant que la proposition n'est pas traitée. */
@Component({
  selector: 'app-mes-stages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './mes-stages.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss'],
})
export class MesStages {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  protected readonly liste = signal<Stage[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly fenetre = signal<null | 'formulaire' | 'retirer'>(null);
  protected readonly cible = signal<Stage | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  protected readonly formulaire = this.fb.nonNullable.group({
    entreprise: ['', [Validators.required, Validators.maxLength(255)]],
    sujet: ['', [Validators.required, Validators.maxLength(255)]],
    dateDebut: ['', Validators.required],
    dateFin: ['', Validators.required],
  }, { validators: periodeValide });

  constructor() { this.charger(); }

  protected charger(): void {
    this.http.get<Stage[]>(`${API_URL}/stages/mes-stages`).subscribe({
      next: (l) => { this.liste.set([...l].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected ouvrir(s: Stage | null): void {
    this.cible.set(s);
    this.formulaire.reset({ entreprise: s?.entreprise ?? '', sujet: s?.sujet ?? '', dateDebut: s?.dateDebut ?? '', dateFin: s?.dateFin ?? '' });
    this.erreurFenetre.set('');
    this.fenetre.set('formulaire');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps: StageRequete = { entreprise: v.entreprise.trim(), sujet: v.sujet.trim(), dateDebut: v.dateDebut, dateFin: v.dateFin };
    if (!corps.entreprise || !corps.sujet) { this.erreurFenetre.set('Renseignez l\'entreprise et le sujet.'); return; }
    const s = this.cible();
    const req = s ? this.http.put<Stage>(`${API_URL}/stages/${s.id}`, corps) : this.http.post<Stage>(`${API_URL}/stages`, corps);
    this.enCours.set(true);
    this.erreurFenetre.set('');
    req.subscribe({
      next: () => {
        this.enCours.set(false); this.fermer();
        confirmerPendant((m) => this.info.set(m), s ? 'Proposition de stage modifiée.' : 'Proposition de stage envoyée pour validation.');
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected demanderRetrait(s: Stage): void { this.cible.set(s); this.erreurFenetre.set(''); this.fenetre.set('retirer'); }

  protected retirer(): void {
    const s = this.cible();
    if (!s) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/stages/${s.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); confirmerPendant((m) => this.info.set(m), 'Proposition de stage retirée.'); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  protected champInvalide(nom: 'entreprise' | 'sujet' | 'dateDebut' | 'dateFin'): boolean { const c = this.formulaire.controls[nom]; return c.touched && c.invalid; }
  protected erreurPeriode(): boolean { return !!this.formulaire.errors?.['ordre'] && this.formulaire.controls.dateFin.touched; }
  protected statut(s: string): string { return libelle(STATUT_STAGE, s); }
  protected duree(s: Stage): string {
    const sem = Math.round((new Date(s.dateFin).getTime() - new Date(s.dateDebut).getTime()) / (7 * 86400000));
    return sem >= 1 ? `${sem} semaine${sem > 1 ? 's' : ''}` : 'moins d\'une semaine';
  }
  protected readonly date = dateFr;
}
