import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '../../core/auth';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-connexion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './connexion.html',
  styleUrl: './connexion.scss',
})
export class Connexion {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);

  protected readonly annee = new Date().getFullYear();
  protected readonly mdpVisible = signal(false);
  protected readonly envoye = signal(false);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal('');
  protected readonly changement = signal(false);

  protected readonly formulaire = this.fb.nonNullable.group({
    etablissement: ['tekup', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    motDePasse: ['', [Validators.required]],
    nouveauMdp: [''],
  });

  protected basculerMdp(): void { this.mdpVisible.update((v) => !v); }

  protected soumettre(): void {
    this.envoye.set(true);
    this.erreur.set('');
    const f = this.formulaire.controls;
    if (f.etablissement.invalid || f.email.invalid || f.motDePasse.invalid) { return; }
    if (this.changement() && f.nouveauMdp.value.length < 8) { this.erreur.set('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return; }
    this.enCours.set(true);
    const v = this.formulaire.getRawValue();

    if (this.changement()) {
      this.auth.changerMotDePasse(v.etablissement, v.email, v.motDePasse, v.nouveauMdp).subscribe({
        next: () => {
          this.changement.set(false);
          this.formulaire.patchValue({ motDePasse: v.nouveauMdp, nouveauMdp: '' });
          this.enCours.set(false);
          this.connexion();
        },
        error: (e: unknown) => { this.enCours.set(false); this.erreur.set(Auth.message(e)); },
      });
      return;
    }
    this.connexion();
  }

  private connexion(): void {
    const v = this.formulaire.getRawValue();
    this.enCours.set(true);
    this.auth.connecter(v.etablissement, v.email, v.motDePasse).subscribe({
      next: () => this.router.navigateByUrl('/tableau-de-bord'),
      error: (e: unknown) => {
        this.enCours.set(false);
        const texte = JSON.stringify((e as HttpErrorResponse).error ?? '');
        if (e instanceof HttpErrorResponse && e.status === 403 && texte.includes('MOT_DE_PASSE_A_CHANGER')) {
          this.changement.set(true);
          this.erreur.set('Votre mot de passe est temporaire. Choisissez-en un nouveau pour continuer.');
        } else { this.erreur.set(Auth.message(e)); }
      },
    });
  }
}
