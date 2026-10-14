import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Echelle } from '../commun/echelle';
import { IaApi, semestreParDefaut } from '../ia-api';
import { ModeleIa, ParametresRisque, Prediction, SemestreRef } from '../modeles';

/** Même règle que le backend : score ≥ seuil élevé → ÉLEVÉ, sinon score ≥ seuil moyen → MOYEN, sinon FAIBLE. */
function repartir(l: Prediction[], moyen: number, eleve: number): { faible: number; moyen: number; eleve: number } {
  const r = { faible: 0, moyen: 0, eleve: 0 };
  for (const p of l) {
    if (p.probabilite >= eleve) { r.eleve++; } else if (p.probabilite >= moyen) { r.moyen++; } else { r.faible++; }
  }
  return r;
}

function ordreSeuils(g: AbstractControl): ValidationErrors | null {
  const m = Number(g.get('moyen')?.value);
  const e = Number(g.get('eleve')?.value);
  return Number.isFinite(m) && Number.isFinite(e) && m >= e ? { ordre: true } : null;
}

/** Paramètres de risque : lecture (SuperAdmin, admin pédagogique) et modification (admin pédagogique). */
@Component({
  selector: 'app-parametres-ia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Icon, Echelle],
  templateUrl: './parametres-ia.html',
  styleUrls: ['../../../shared/ui.scss', '../ia.scss', './parametres-ia.scss'],
})
export class ParametresIa {
  private readonly api = inject(IaApi);
  private readonly fb = inject(FormBuilder);
  protected readonly peutModifier = inject(Auth).a('ADMIN_PEDAGOGIQUE');
  protected readonly dateHeure = dateHeureFr;

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly enCours = signal(false);
  protected readonly erreurForm = signal('');
  protected readonly parametres = signal<ParametresRisque | null>(null);
  protected readonly modeles = signal<ModeleIa[]>([]);
  protected readonly semestre = signal<SemestreRef | null>(null);
  protected readonly predictions = signal<Prediction[] | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    moyen: [40, [Validators.required, Validators.min(1), Validators.max(98)]],
    eleve: [70, [Validators.required, Validators.min(2), Validators.max(99)]],
  }, { validators: ordreSeuils });

  private readonly valeurs = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly propose = computed(() => {
    const v = this.valeurs();
    return { moyen: (Number(v.moyen) || 0) / 100, eleve: (Number(v.eleve) || 0) / 100 };
  });
  protected readonly modifie = computed(() => {
    const p = this.parametres();
    const v = this.propose();
    return !!p && (Math.abs(p.seuilMoyen - v.moyen) > 1e-9 || Math.abs(p.seuilEleve - v.eleve) > 1e-9);
  });
  protected readonly impact = computed(() => {
    const l = this.predictions();
    const p = this.parametres();
    if (!l || !p) { return null; }
    const v = this.propose();
    return { total: l.length, actuel: repartir(l, p.seuilMoyen, p.seuilEleve), propose: repartir(l, v.moyen, v.eleve) };
  });
  protected readonly modeleActif = computed(() => this.modeles().find((m) => m.statut === 'ACTIF') ?? this.modeles()[0] ?? null);

  constructor() {
    this.api.parametres().subscribe({
      next: (p) => { this.appliquer(p); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
    this.api.modeles().subscribe({ next: (l) => this.modeles.set(l), error: () => this.modeles.set([]) });
    this.api.semestres().subscribe({
      next: (l) => {
        const s = semestreParDefaut(l);
        this.semestre.set(s);
        if (!s) { this.predictions.set([]); return; }
        this.api.predictions({ semestreId: s.id, dernieresSeulement: true }).subscribe({
          next: (p) => this.predictions.set(p),
          error: () => this.predictions.set([]),
        });
      },
      error: () => this.predictions.set([]),
    });
  }

  protected enregistrer(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enCours() || !this.peutModifier) { return; }
    const v = this.propose();
    this.enCours.set(true);
    this.erreurForm.set('');
    this.api.modifierParametres(v.moyen, v.eleve).subscribe({
      next: (p) => {
        this.enCours.set(false);
        this.appliquer(p);
        this.info.set('Seuils enregistrés. Ils s\'appliqueront aux prochaines analyses.');
        setTimeout(() => this.info.set(''), 4000);
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurForm.set(Auth.message(e)); },
    });
  }

  protected annuler(): void { const p = this.parametres(); if (p) { this.appliquer(p); } }

  protected pct(v: number): string { return Math.round(v * 100) + ' %'; }

  private appliquer(p: ParametresRisque): void {
    this.parametres.set(p);
    this.form.reset({ moyen: Math.round(p.seuilMoyen * 100), eleve: Math.round(p.seuilEleve * 100) });
  }
}
