import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, genererMotDePasse, indexer, messageErreur, normaliser, parNom } from '../commun/base';
import { Confirmation } from '../commun/confirmation';
import { Classe, Etudiant } from '../commun/modeles';
import { Secret } from '../commun/secret';

const TAILLE = 15;
/** Valeur du filtre « sans classe ». */
const SANS_CLASSE = -1;

/** Étudiants : recherche, filtre par classe, création (mot de passe temporaire), modification, suppression. */
@Component({
  selector: 'app-etudiants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal, Confirmation, Secret],
  templateUrl: './etudiants.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class Etudiants extends PageReferentiel<'editer' | 'supprimer' | 'secret'> {
  protected readonly etudiants = signal<Etudiant[]>([]);
  protected readonly classes = signal<Classe[]>([]);
  protected readonly recherche = signal('');
  protected readonly filtreClasse = signal<number | null>(null);
  protected readonly numero = signal(0);
  protected readonly cible = signal<Etudiant | null>(null);
  protected readonly secret = signal({ email: '', motDePasse: '' });
  protected readonly mdpVisible = signal(true);
  protected readonly sansClasse = SANS_CLASSE;

  protected readonly classesTriees = computed(() => parNom(this.classes(), (c) => c.nom));
  private readonly classesParId = computed(() => indexer(this.classes()));

  private readonly filtres = computed(() => {
    const q = normaliser(this.recherche().trim());
    const c = this.filtreClasse();
    return parNom(this.etudiants(), (e) => `${e.nom} ${e.prenom}`).filter((e) =>
      (c === null || (c === SANS_CLASSE ? !e.classeId : e.classeId === c))
      && (!q || normaliser(`${e.nom} ${e.prenom} ${e.prenom} ${e.nom} ${e.email} ${e.matricule}`).includes(q)));
  });
  protected readonly total = computed(() => this.filtres().length);
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / TAILLE)));
  protected readonly lignes = computed(() => this.filtres()
    .slice(this.numero() * TAILLE, (this.numero() + 1) * TAILLE)
    .map((e) => ({ ...e, classe: e.classeId ? this.classesParId().get(e.classeId) : undefined })));

  protected readonly formulaire = this.fb.group({
    prenom: this.fb.nonNullable.control('', Validators.required),
    nom: this.fb.nonNullable.control('', Validators.required),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    matricule: this.fb.nonNullable.control('', Validators.required),
    niveau: this.fb.nonNullable.control(''),
    classeId: this.fb.control<number | null>(null),
    telephone: this.fb.nonNullable.control(''),
    motDePasse: this.fb.nonNullable.control(''),
  });

  constructor() {
    super();
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const classe = Number(q.get('classe')) || null;
    this.filtreClasse.set(classe);
    this.charger(() => { if (q.get('creer') && this.peutEcrire) { this.nouveau(classe); } });
  }

  protected charger(ensuite?: () => void): void {
    this.chargement.set(true);
    forkJoin({
      e: this.http.get<Etudiant[]>(`${API_URL}/etudiants`),
      c: this.http.get<Classe[]>(`${API_URL}/classes`),
    }).subscribe({
      next: (r) => {
        this.etudiants.set(r.e); this.classes.set(r.c); this.erreur.set(''); this.chargement.set(false);
        if (this.numero() >= this.pages()) { this.numero.set(this.pages() - 1); }
        ensuite?.();
      },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected chercher(v: string): void { this.recherche.set(v); this.numero.set(0); }
  protected filtrer(v: string): void { this.filtreClasse.set(v === '' ? null : Number(v)); this.numero.set(0); }
  protected aller(delta: number): void { this.numero.update((n) => n + delta); }

  protected nouveau(classeId: number | null = this.filtreClasse()): void {
    this.cible.set(null);
    this.formulaire.reset({
      prenom: '', nom: '', email: '', matricule: '', niveau: '', telephone: '',
      classeId: classeId && classeId > 0 ? classeId : null, motDePasse: genererMotDePasse(),
    });
    this.mdpVisible.set(true);
    this.ouvrir('editer');
  }

  protected modifier(e: Etudiant): void {
    this.cible.set(e);
    this.formulaire.reset({
      prenom: e.prenom, nom: e.nom, email: e.email, matricule: e.matricule, niveau: e.niveau ?? '',
      classeId: e.classeId ?? null, telephone: e.telephone ?? '', motDePasse: '',
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
      niveau: v.niveau.trim() || null, classeId: v.classeId, telephone: v.telephone.trim() || null,
      ...(c ? {} : { motDePasse: v.motDePasse }),
    };
    const req = c
      ? this.http.put<Etudiant>(`${API_URL}/etudiants/${c.id}`, corps)
      : this.http.post<Etudiant>(`${API_URL}/etudiants`, corps);
    this.envoyer(req, (e) => {
      if (c) { this.fermer(); this.confirmer(`Étudiant modifié : ${e.prenom} ${e.nom}`); } else {
        this.secret.set({ email: e.email, motDePasse: v.motDePasse });
        this.fenetre.set('secret');
      }
      this.charger();
    });
  }

  protected demanderSuppression(e: Etudiant): void { this.cible.set(e); this.ouvrir('supprimer'); }

  protected supprimer(): void {
    const e = this.cible();
    if (!e) { return; }
    this.envoyer(this.http.delete(`${API_URL}/etudiants/${e.id}`), () => {
      this.fermer();
      this.confirmer(`Étudiant supprimé : ${e.prenom} ${e.nom}`);
      this.charger();
    });
  }
}
