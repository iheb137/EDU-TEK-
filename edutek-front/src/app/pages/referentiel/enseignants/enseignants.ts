import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, genererMotDePasse, messageErreur, normaliser, parNom } from '../commun/base';
import { Confirmation } from '../commun/confirmation';
import { Enseignant, Enseignement } from '../commun/modeles';
import { Secret } from '../commun/secret';

const TAILLE = 15;

/** Enseignants : recherche, création (mot de passe temporaire), modification, suppression. */
@Component({
  selector: 'app-enseignants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal, Confirmation, Secret],
  templateUrl: './enseignants.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class Enseignants extends PageReferentiel<'editer' | 'supprimer' | 'secret'> {
  protected readonly enseignants = signal<Enseignant[]>([]);
  private readonly enseignements = signal<Enseignement[]>([]);
  protected readonly recherche = signal('');
  protected readonly numero = signal(0);
  protected readonly cible = signal<Enseignant | null>(null);
  protected readonly secret = signal({ email: '', motDePasse: '' });
  protected readonly mdpVisible = signal(true);

  private readonly filtres = computed(() => {
    const q = normaliser(this.recherche().trim());
    return parNom(this.enseignants(), (e) => `${e.nom} ${e.prenom}`).filter((e) =>
      !q || normaliser(`${e.nom} ${e.prenom} ${e.prenom} ${e.nom} ${e.email} ${e.matricule} ${e.specialite ?? ''}`).includes(q));
  });
  protected readonly total = computed(() => this.filtres().length);
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / TAILLE)));
  protected readonly lignes = computed(() => this.filtres()
    .slice(this.numero() * TAILLE, (this.numero() + 1) * TAILLE)
    .map((e) => {
      const liste = this.enseignements().filter((x) => x.enseignantId === e.id);
      return { ...e, nbEnseignements: liste.length, volume: liste.reduce((n, x) => n + (x.volumeHoraire ?? 0), 0) };
    }));

  protected readonly formulaire = this.fb.group({
    prenom: this.fb.nonNullable.control('', Validators.required),
    nom: this.fb.nonNullable.control('', Validators.required),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    matricule: this.fb.nonNullable.control('', Validators.required),
    specialite: this.fb.nonNullable.control(''),
    grade: this.fb.nonNullable.control(''),
    telephone: this.fb.nonNullable.control(''),
    motDePasse: this.fb.nonNullable.control(''),
  });

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      e: this.http.get<Enseignant[]>(`${API_URL}/enseignants`),
      n: this.http.get<Enseignement[]>(`${API_URL}/enseignements`),
    }).subscribe({
      next: (r) => {
        this.enseignants.set(r.e); this.enseignements.set(r.n); this.erreur.set(''); this.chargement.set(false);
        if (this.numero() >= this.pages()) { this.numero.set(this.pages() - 1); }
      },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected chercher(v: string): void { this.recherche.set(v); this.numero.set(0); }
  protected aller(delta: number): void { this.numero.update((n) => n + delta); }

  protected nouveau(): void {
    this.cible.set(null);
    this.formulaire.reset({ prenom: '', nom: '', email: '', matricule: '', specialite: '', grade: '', telephone: '', motDePasse: genererMotDePasse() });
    this.mdpVisible.set(true);
    this.ouvrir('editer');
  }

  protected modifier(e: Enseignant): void {
    this.cible.set(e);
    this.formulaire.reset({
      prenom: e.prenom, nom: e.nom, email: e.email, matricule: e.matricule, specialite: e.specialite ?? '',
      grade: e.grade ?? '', telephone: e.telephone ?? '', motDePasse: '',
    });
    this.ouvrir('editer');
  }

  protected regenerer(): void { this.formulaire.controls.motDePasse.setValue(genererMotDePasse()); }
  protected mdpInvalide(): boolean { return !this.cible() && this.formulaire.controls.motDePasse.value.length < 8; }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid || this.mdpInvalide()) { return; }
    const v = this.formulaire.getRawValue();
    const c = this.cible();
    const corps = {
      prenom: v.prenom.trim(), nom: v.nom.trim(), email: v.email.trim(), matricule: v.matricule.trim(),
      specialite: v.specialite.trim() || null, grade: v.grade.trim() || null, telephone: v.telephone.trim() || null,
      ...(c ? {} : { motDePasse: v.motDePasse }),
    };
    const req = c
      ? this.http.put<Enseignant>(`${API_URL}/enseignants/${c.id}`, corps)
      : this.http.post<Enseignant>(`${API_URL}/enseignants`, corps);
    this.envoyer(req, (e) => {
      if (c) { this.fermer(); this.confirmer(`Enseignant modifié : ${e.prenom} ${e.nom}`); } else {
        this.secret.set({ email: e.email, motDePasse: v.motDePasse });
        this.fenetre.set('secret');
      }
      this.charger();
    });
  }

  protected demanderSuppression(e: Enseignant): void { this.cible.set(e); this.ouvrir('supprimer'); }

  protected supprimer(): void {
    const e = this.cible();
    if (!e) { return; }
    this.envoyer(this.http.delete(`${API_URL}/enseignants/${e.id}`), () => {
      this.fermer();
      this.confirmer(`Enseignant supprimé : ${e.prenom} ${e.nom}`);
      this.charger();
    });
  }
}
