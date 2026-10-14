import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Etablissement } from '../modeles';

type Fenetre = null | 'creer' | 'secret' | 'activation';
interface Secret { code: string; nom: string; email: string; motDePasse: string; }

const CODE_PLATEFORME = 'plateforme';

/** Établissements hébergés par la plateforme : liste, création avec administrateur, activation (SuperAdmin plateforme). */
@Component({
  selector: 'app-etablissements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './etablissements.html',
  styleUrls: ['../../../shared/ui.scss', './etablissements.scss'],
})
export class Etablissements {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(Auth);
  protected readonly codePlateforme = CODE_PLATEFORME;
  protected readonly dateFr = dateFr;

  /** L'API réserve ces routes au SuperAdmin connecté sur l'établissement « plateforme ». */
  protected readonly surPlateforme = computed(() => this.auth.session()?.etablissement === CODE_PLATEFORME);

  protected readonly liste = signal<Etablissement[] | null>(null);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly filtre = signal('');
  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly secret = signal<Secret | null>(null);
  protected readonly cible = signal<Etablissement | null>(null);
  protected readonly mdpVisible = signal(true);

  protected readonly visibles = computed(() => {
    const q = this.filtre().trim().toLowerCase();
    const l = this.liste() ?? [];
    return q ? l.filter((e) => e.code.includes(q) || e.nom.toLowerCase().includes(q)) : l;
  });
  protected readonly nbActifs = computed(() => (this.liste() ?? []).filter((e) => e.actif).length);

  protected readonly formulaire = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{1,39}$/)]],
    nom: ['', [Validators.required, Validators.maxLength(200)]],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminMotDePasse: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64)]],
  });

  constructor() {
    if (this.surPlateforme()) { this.charger(); }
  }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<Etablissement[]>(`${API_URL}/plateforme/etablissements`).subscribe({
      next: (l) => { this.liste.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  // ── Création ────────────────────────────────────────────────────────────
  protected ouvrirCreation(): void {
    this.formulaire.reset({ code: '', nom: '', adminEmail: '', adminMotDePasse: this.genererMotDePasse() });
    this.mdpVisible.set(true);
    this.erreurFenetre.set('');
    this.fenetre.set('creer');
  }

  protected genererMotDePasse(): string {
    const alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const octets = crypto.getRandomValues(new Uint32Array(10));
    return `${Array.from(octets, (n) => alpha[n % alpha.length]).join('')}@${(octets[0] % 90) + 10}`;
  }
  protected regenerer(): void { this.formulaire.controls.adminMotDePasse.setValue(this.genererMotDePasse()); }

  /** Le code est saisi en minuscules sans espaces, pour correspondre à ce qu'attend l'API. */
  protected normaliserCode(valeur: string): void {
    const propre = valeur.toLowerCase().replace(/\s+/g, '-');
    if (propre !== valeur) { this.formulaire.controls.code.setValue(propre); }
  }

  protected creer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps = { code: v.code.trim(), nom: v.nom.trim(), adminEmail: v.adminEmail.trim(), adminMotDePasse: v.adminMotDePasse };
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<Etablissement>(`${API_URL}/plateforme/etablissements`, corps).subscribe({
      next: (e) => {
        this.enCours.set(false);
        this.secret.set({ code: e?.code ?? corps.code, nom: e?.nom ?? corps.nom, email: corps.adminEmail, motDePasse: corps.adminMotDePasse });
        this.fenetre.set('secret');
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Activation ──────────────────────────────────────────────────────────
  protected demanderActivation(e: Etablissement): void {
    this.cible.set(e);
    this.erreurFenetre.set('');
    this.fenetre.set('activation');
  }

  protected confirmerActivation(): void {
    const e = this.cible();
    if (!e) { return; }
    const actif = !e.actif;
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.patch<Etablissement>(`${API_URL}/plateforme/etablissements/${encodeURIComponent(e.code)}/actif`, { actif }).subscribe({
      next: (maj) => {
        this.enCours.set(false);
        this.liste.update((l) => l?.map((x) => (x.code === e.code ? { ...x, actif: maj?.actif ?? actif } : x)) ?? l);
        this.fermer();
        this.confirmer(`Établissement ${actif ? 'réactivé' : 'désactivé'} : ${e.nom}`);
      },
      error: (err: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(err)); },
    });
  }

  // ── Divers ──────────────────────────────────────────────────────────────
  protected async copier(texte: string): Promise<void> {
    try { await navigator.clipboard.writeText(texte); this.confirmer('Copié dans le presse-papiers.'); } catch { /* copie indisponible */ }
  }
  protected deconnecter(): void { this.auth.deconnecter(); }
  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
