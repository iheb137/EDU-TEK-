import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { dateFr, nombreFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { PageReferentiel, messageErreur } from '../commun/base';
import { Formation, PlanEtudes, Regles } from '../commun/modeles';

/** Fiche d'une formation : plan d'études par semestre et règles de calcul (barème, seuil, compensation…). */
@Component({
  selector: 'app-formation-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './formation-detail.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss', './formation-detail.scss'],
})
export class FormationDetail extends PageReferentiel {
  protected readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly formation = signal<Formation | null>(null);
  protected readonly plan = signal<PlanEtudes | null>(null);
  protected readonly regles = signal<Regles | null>(null);
  protected readonly erreurRegles = signal('');
  protected readonly date = dateFr;
  protected readonly nombre = nombreFr;
  protected readonly choixDecimales = [0, 1, 2, 3];

  protected readonly formulaire = this.fb.group({
    noteMax: this.fb.control<number | null>(20, [Validators.required, Validators.min(1), Validators.max(1000)]),
    seuilAdmission: this.fb.control<number | null>(10, [Validators.required, Validators.min(0)]),
    eliminatoire: this.fb.nonNullable.control(false),
    noteEliminatoire: this.fb.control<number | null>(null, [Validators.min(0)]),
    compensation: this.fb.nonNullable.control(true),
    decimales: this.fb.nonNullable.control(2),
  });

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      f: this.http.get<Formation>(`${API_URL}/formations/${this.id}`),
      p: this.http.get<PlanEtudes>(`${API_URL}/formations/${this.id}/plan-etudes`),
      r: this.http.get<Regles>(`${API_URL}/formations/${this.id}/regles`),
    }).subscribe({
      next: ({ f, p, r }) => {
        this.formation.set(f); this.plan.set(p); this.appliquer(r);
        this.erreur.set(''); this.chargement.set(false);
      },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  private appliquer(r: Regles): void {
    this.regles.set(r);
    this.formulaire.reset({
      noteMax: r.noteMax, seuilAdmission: r.seuilAdmission,
      eliminatoire: r.noteEliminatoire !== null && r.noteEliminatoire !== undefined,
      noteEliminatoire: r.noteEliminatoire ?? null, compensation: r.compensation, decimales: r.decimales,
    });
    if (r.verrouillee || !this.peutEcrire) { this.formulaire.disable(); } else { this.formulaire.enable(); }
  }

  /** Contrôles de cohérence repris du serveur, affichés avant l'envoi. */
  protected incoherence(): string {
    const v = this.formulaire.getRawValue();
    if (v.noteMax === null || v.seuilAdmission === null) { return ''; }
    if (v.seuilAdmission > v.noteMax) { return 'Le seuil d\'admission ne peut pas dépasser la note maximale.'; }
    if (v.eliminatoire && v.noteEliminatoire !== null && v.noteEliminatoire > v.seuilAdmission) { return 'La note éliminatoire ne peut pas dépasser le seuil d\'admission.'; }
    if (v.eliminatoire && v.noteEliminatoire === null) { return 'Indiquez la note éliminatoire ou décochez l\'option.'; }
    return '';
  }

  protected enregistrerRegles(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid || this.incoherence()) { return; }
    const v = this.formulaire.getRawValue();
    const corps = {
      noteMax: v.noteMax, seuilAdmission: v.seuilAdmission,
      noteEliminatoire: v.eliminatoire ? v.noteEliminatoire : null,
      compensation: v.compensation, decimales: Number(v.decimales),
    };
    this.enCours.set(true);
    this.erreurRegles.set('');
    this.http.put<Regles>(`${API_URL}/formations/${this.id}/regles`, corps).subscribe({
      next: (r) => { this.enCours.set(false); this.appliquer(r); this.confirmer('Règles de calcul enregistrées.'); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurRegles.set(messageErreur(e)); },
    });
  }

  protected nbMatieres(p: PlanEtudes): number { return p.semestres.reduce((n, s) => n + s.matieres.length, 0); }

  protected annuler(): void { const r = this.regles(); if (r) { this.appliquer(r); } this.erreurRegles.set(''); }
}
