import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth';
import { LIBELLE_ROLE } from '../../../core/modeles';
import { Icon } from '../../../shared/icon/icon';

/** Le nouveau mot de passe doit être confirmé et différer de l'ancien. */
function coherence(g: AbstractControl): ValidationErrors | null {
  const ancien = g.get('ancien')?.value as string;
  const nouveau = g.get('nouveau')?.value as string;
  const confirmation = g.get('confirmation')?.value as string;
  const erreurs: ValidationErrors = {};
  if (confirmation && nouveau !== confirmation) { erreurs['differents'] = true; }
  if (ancien && nouveau && ancien === nouveau) { erreurs['identique'] = true; }
  return Object.keys(erreurs).length ? erreurs : null;
}

/** Profil du compte connecté et changement de mot de passe. */
@Component({
  selector: 'app-profil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './profil.html',
  styleUrls: ['../../../shared/ui.scss', './profil.scss'],
})
export class Profil {
  protected readonly auth = inject(Auth);
  private readonly fb = inject(FormBuilder);
  protected readonly session = this.auth.session();
  protected readonly libelleRole = (r: string) => LIBELLE_ROLE[r] ?? r;

  protected readonly enCours = signal(false);
  protected readonly erreur = signal('');
  protected readonly succes = signal(false);
  protected readonly visible = signal(false);

  protected readonly formulaire = this.fb.nonNullable.group({
    email: [this.session?.email ?? '', [Validators.required, Validators.email]],
    ancien: ['', Validators.required],
    nouveau: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64)]],
    confirmation: ['', Validators.required],
  }, { validators: coherence });

  protected champInvalide(nom: 'email' | 'ancien' | 'nouveau' | 'confirmation'): boolean {
    const c = this.formulaire.controls[nom];
    return c.touched && c.invalid;
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    this.erreur.set('');
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    this.enCours.set(true);
    this.auth.changerMotDePasse(this.session?.etablissement ?? 'tekup', v.email, v.ancien, v.nouveau).subscribe({
      next: () => {
        this.enCours.set(false);
        this.succes.set(true);
        this.formulaire.reset({ email: v.email, ancien: '', nouveau: '', confirmation: '' });
        this.visible.set(false);
        setTimeout(() => this.succes.set(false), 8000);
      },
      error: (e: unknown) => {
        this.enCours.set(false);
        this.erreur.set(e instanceof HttpErrorResponse && e.status === 401
          ? 'Mot de passe actuel incorrect. Vérifiez votre saisie.'
          : Auth.message(e));
      },
    });
  }

  protected seReconnecter(): void { this.auth.deconnecter(); }
}
