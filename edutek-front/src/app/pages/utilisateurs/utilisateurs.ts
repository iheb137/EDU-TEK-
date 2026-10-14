import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '../../core/auth';
import { API_URL } from '../../core/config';
import { ImportResultat, LIBELLE_ROLE, MotDePasseTemporaire, Page, Role, UtilisateurAdmin } from '../../core/modeles';
import { Icon } from '../../shared/icon/icon';
import { Modal } from '../../shared/modal/modal';

type Fenetre = null | 'creer' | 'import' | 'roles' | 'secret';
type FiltreEtat = 'tous' | 'actifs' | 'inactifs';

const TYPES_ADMIN = ['SUPERADMIN', 'ADMIN_PEDAGOGIQUE', 'ADMIN_COMMUNICATION', 'ADMIN_SUPPORT', 'ADMIN_FINANCIER'];
const MODELE_CSV = 'type,nom,prenom,email,matricule,telephone,niveau,classeCode,anneeUniversitaire,specialite,grade\n' +
  'ETUDIANT,Ben Salah,Amine,amine.bensalah@exemple.tn,MAT0001,,5,GLSI5D,2026-2027,,\n' +
  'ENSEIGNANT,Mansouri,Sonia,sonia.mansouri@exemple.tn,ENS0001,,,,,DevOps,Maitre assistant\n';

/** Gestion des comptes : liste, création, import CSV, rôles, activation, mot de passe temporaire (SuperAdmin). */
@Component({
  selector: 'app-utilisateurs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './utilisateurs.html',
  styleUrls: ['../../shared/ui.scss', './utilisateurs.scss'],
})
export class Utilisateurs {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  protected readonly moi = inject(Auth).session()?.email;

  protected readonly typesAdmin = TYPES_ADMIN;
  protected readonly libelleRole = (r: string) => LIBELLE_ROLE[r] ?? r;

  protected readonly donnees = signal<Page<UtilisateurAdmin> | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly recherche = signal('');
  protected readonly etat = signal<FiltreEtat>('tous');
  protected readonly numero = signal(0);
  protected readonly taille = 15;
  protected readonly traitement = signal<number | null>(null);

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly secret = signal<MotDePasseTemporaire | null>(null);
  protected readonly cible = signal<UtilisateurAdmin | null>(null);
  protected readonly rolesDispo = signal<Role[]>([]);
  protected readonly rolesChoisis = signal<string[]>([]);
  protected readonly resultatImport = signal<ImportResultat | null>(null);
  protected fichier: File | null = null;
  protected simulation = true;
  protected ignorerErreurs = false;
  protected readonly mdpVisible = signal(false);

  protected readonly formulaire = this.fb.nonNullable.group({
    type: ['ENSEIGNANT', Validators.required],
    prenom: ['', Validators.required],
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    motDePasse: ['', [Validators.required, Validators.minLength(8)]],
    telephone: [''],
    matricule: [''],
    niveau: [''],
    specialite: [''],
    grade: [''],
  });

  private minuteur: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.charger();
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    if (q.get('creer')) { this.ouvrirCreation(); }
    if (q.get('import')) { this.fenetre.set('import'); }
  }

  // ── Liste ───────────────────────────────────────────────────────────────
  protected charger(): void {
    this.chargement.set(true);
    let p = new HttpParams().set('page', this.numero()).set('size', this.taille);
    if (this.recherche().trim()) { p = p.set('q', this.recherche().trim()); }
    if (this.etat() !== 'tous') { p = p.set('actif', this.etat() === 'actifs'); }
    this.http.get<Page<UtilisateurAdmin>>(`${API_URL}/utilisateurs`, { params: p }).subscribe({
      next: (d) => { this.donnees.set(d); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected chercher(valeur: string): void {
    this.recherche.set(valeur);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => { this.numero.set(0); this.charger(); }, 350);
  }

  protected filtrer(valeur: string): void { this.etat.set(valeur as FiltreEtat); this.numero.set(0); this.charger(); }
  protected aller(delta: number): void { this.numero.update((n) => n + delta); this.charger(); }

  // ── Actions sur un compte ───────────────────────────────────────────────
  protected basculerActivation(u: UtilisateurAdmin): void {
    const actif = !u.actif;
    this.traitement.set(u.id);
    this.erreur.set('');
    this.http.patch<UtilisateurAdmin>(`${API_URL}/utilisateurs/${u.id}/activation`, { actif }).subscribe({
      next: (maj) => {
        this.traitement.set(null);
        // Mise à jour immédiate de la ligne, puis rechargement de la liste.
        this.donnees.update((d) => d ? { ...d, contenu: d.contenu.map((x) => (x.id === u.id ? { ...x, actif: maj?.actif ?? actif } : x)) } : d);
        this.confirmer(`Compte ${actif ? 'réactivé' : 'désactivé'} : ${u.email}`);
        this.charger();
      },
      error: (e: unknown) => { this.traitement.set(null); this.erreur.set(Auth.message(e)); },
    });
  }

  protected reinitialiser(u: UtilisateurAdmin): void {
    this.http.post<MotDePasseTemporaire>(`${API_URL}/utilisateurs/${u.id}/reinitialiser-mot-de-passe`, null).subscribe({
      next: (r) => { this.secret.set(r); this.fenetre.set('secret'); this.charger(); },
      error: (e: unknown) => this.erreur.set(Auth.message(e)),
    });
  }

  protected ouvrirRoles(u: UtilisateurAdmin): void {
    this.cible.set(u);
    this.rolesChoisis.set([...u.roles]);
    this.erreurFenetre.set('');
    this.fenetre.set('roles');
    if (!this.rolesDispo().length) {
      this.http.get<Role[]>(`${API_URL}/roles`).subscribe({
        next: (r) => this.rolesDispo.set(r),
        error: (e: unknown) => this.erreurFenetre.set(Auth.message(e)),
      });
    }
  }

  protected cocher(nom: string, coche: boolean): void {
    this.rolesChoisis.update((l) => (coche ? [...new Set([...l, nom])] : l.filter((r) => r !== nom)));
  }

  protected enregistrerRoles(): void {
    const u = this.cible();
    if (!u) { return; }
    this.enCours.set(true);
    this.http.put<UtilisateurAdmin>(`${API_URL}/utilisateurs/${u.id}/roles`, { roles: this.rolesChoisis() }).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(`Rôles mis à jour : ${u.email}`); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Création ────────────────────────────────────────────────────────────
  protected ouvrirCreation(): void {
    this.formulaire.reset({ type: 'ENSEIGNANT', prenom: '', nom: '', email: '', motDePasse: this.genererMotDePasse(), telephone: '', matricule: '', niveau: '', specialite: '', grade: '' });
    this.mdpVisible.set(true);
    this.erreurFenetre.set('');
    this.fenetre.set('creer');
  }

  protected genererMotDePasse(): string {
    const alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const octets = crypto.getRandomValues(new Uint32Array(10));
    const base = Array.from(octets, (n) => alpha[n % alpha.length]).join('');
    return `${base}@${(octets[0] % 90) + 10}`;
  }

  protected regenerer(): void { this.formulaire.controls.motDePasse.setValue(this.genererMotDePasse()); }
  protected estAdmin(): boolean { return TYPES_ADMIN.includes(this.formulaire.controls.type.value); }
  protected estEtudiant(): boolean { return this.formulaire.controls.type.value === 'ETUDIANT'; }
  protected estEnseignant(): boolean { return this.formulaire.controls.type.value === 'ENSEIGNANT'; }

  protected creer(): void {
    const v = this.formulaire.getRawValue();
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    if (!this.estAdmin() && !v.matricule.trim()) { this.erreurFenetre.set('Le matricule est obligatoire.'); return; }
    const commun = { nom: v.nom.trim(), prenom: v.prenom.trim(), email: v.email.trim(), motDePasse: v.motDePasse, telephone: v.telephone.trim() || undefined };
    let chemin = '/admins';
    let corps: Record<string, unknown> = { ...commun, type: v.type };
    if (this.estEtudiant()) { chemin = '/etudiants'; corps = { ...commun, matricule: v.matricule.trim(), niveau: v.niveau.trim() || undefined }; }
    if (this.estEnseignant()) { chemin = '/enseignants'; corps = { ...commun, matricule: v.matricule.trim(), specialite: v.specialite.trim() || undefined, grade: v.grade.trim() || undefined }; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post(`${API_URL}${chemin}`, corps).subscribe({
      next: () => {
        this.enCours.set(false);
        this.secret.set({ email: v.email.trim(), motDePasseTemporaire: v.motDePasse, message: 'Compte créé. Transmettez ce mot de passe à la personne : elle devra le changer à sa première connexion.' });
        this.fenetre.set('secret');
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Import CSV ──────────────────────────────────────────────────────────
  protected ouvrirImport(): void { this.fichier = null; this.simulation = true; this.ignorerErreurs = false; this.resultatImport.set(null); this.erreurFenetre.set(''); this.fenetre.set('import'); }
  protected choisirFichier(e: Event): void { this.fichier = (e.target as HTMLInputElement).files?.[0] ?? null; this.resultatImport.set(null); }

  protected importer(): void {
    if (!this.fichier) { this.erreurFenetre.set('Choisissez un fichier CSV.'); return; }
    const donnees = new FormData();
    donnees.append('fichier', this.fichier);
    const params = new HttpParams().set('simulation', this.simulation).set('ignorerErreurs', this.ignorerErreurs);
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<ImportResultat>(`${API_URL}/utilisateurs/import`, donnees, { params }).subscribe({
      next: (r) => { this.enCours.set(false); this.resultatImport.set(r); if (!r.simulation) { this.charger(); } },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected telechargerIdentifiants(): void {
    const r = this.resultatImport();
    if (!r?.comptes.length) { return; }
    this.telecharger('identifiants-temporaires.csv', 'email,type,motDePasseTemporaire\n' + r.comptes.map((c) => `${c.email},${c.type},${c.motDePasseTemporaire}`).join('\n'));
  }
  protected telechargerModele(): void { this.telecharger('modele-import-comptes.csv', MODELE_CSV); }

  private telecharger(nom: string, contenu: string): void {
    const url = URL.createObjectURL(new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = nom; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Divers ──────────────────────────────────────────────────────────────
  protected async copier(texte: string): Promise<void> {
    try { await navigator.clipboard.writeText(texte); this.confirmer('Copié dans le presse-papiers.'); } catch { /* copie indisponible */ }
  }
  protected fermer(): void { this.fenetre.set(null); }
  protected date(iso?: string): string { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
