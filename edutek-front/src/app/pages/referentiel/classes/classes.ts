import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, indexer, messageErreur, normaliser, parNom } from '../commun/base';
import { Confirmation } from '../commun/confirmation';
import { Classe, Enseignement, Etudiant, Formation } from '../commun/modeles';

/** Année universitaire en cours, au format 2026-2027 (rentrée en septembre). */
export function anneeCourante(): string {
  const d = new Date();
  const debut = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${debut}-${debut + 1}`;
}

/** Classes : liste, création, modification, suppression ; accès à la fiche de chaque classe. */
@Component({
  selector: 'app-classes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal, Confirmation],
  templateUrl: './classes.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class Classes extends PageReferentiel<'editer' | 'supprimer'> {
  protected readonly classes = signal<Classe[]>([]);
  protected readonly formations = signal<Formation[]>([]);
  private readonly etudiants = signal<Etudiant[]>([]);
  private readonly enseignements = signal<Enseignement[]>([]);
  protected readonly recherche = signal('');
  protected readonly filtreFormation = signal<number | null>(null);
  protected readonly cible = signal<Classe | null>(null);

  protected readonly formationsTriees = computed(() => parNom(this.formations(), (f) => f.code));
  protected readonly lignes = computed(() => {
    const fs = indexer(this.formations());
    const q = normaliser(this.recherche().trim());
    const f = this.filtreFormation();
    return parNom(this.classes(), (c) => c.nom)
      .filter((c) => (!f || c.formationId === f) && (!q || normaliser(`${c.code} ${c.nom}`).includes(q)))
      .map((c) => ({
        ...c,
        formation: fs.get(c.formationId),
        effectif: this.etudiants().filter((e) => e.classeId === c.id).length,
        nbEnseignements: this.enseignements().filter((e) => e.classeId === c.id).length,
      }));
  });

  protected readonly formulaire = this.fb.group({
    code: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(30)]),
    nom: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    anneeUniversitaire: this.fb.nonNullable.control('', [Validators.pattern(/^\d{4}-\d{4}$/)]),
    formationId: this.fb.control<number | null>(null, Validators.required),
  });

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      c: this.http.get<Classe[]>(`${API_URL}/classes`),
      f: this.http.get<Formation[]>(`${API_URL}/formations`),
      e: this.http.get<Etudiant[]>(`${API_URL}/etudiants`),
      n: this.http.get<Enseignement[]>(`${API_URL}/enseignements`),
    }).subscribe({
      next: (r) => {
        this.classes.set(r.c); this.formations.set(r.f); this.etudiants.set(r.e); this.enseignements.set(r.n);
        this.erreur.set(''); this.chargement.set(false);
      },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected filtrer(valeur: string): void { this.filtreFormation.set(Number(valeur) || null); }

  protected nouvelle(): void {
    this.cible.set(null);
    const f = this.filtreFormation() ?? (this.formations().length === 1 ? this.formations()[0].id : null);
    this.formulaire.reset({ code: '', nom: '', anneeUniversitaire: anneeCourante(), formationId: f });
    this.ouvrir('editer');
  }

  protected modifier(c: Classe): void {
    this.cible.set(c);
    this.formulaire.reset({ code: c.code, nom: c.nom, anneeUniversitaire: c.anneeUniversitaire ?? '', formationId: c.formationId });
    this.ouvrir('editer');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps = { code: v.code.trim(), nom: v.nom.trim(), anneeUniversitaire: v.anneeUniversitaire.trim() || null, formationId: v.formationId };
    const c = this.cible();
    const req = c
      ? this.http.put<Classe>(`${API_URL}/classes/${c.id}`, { id: c.id, ...corps })
      : this.http.post<Classe>(`${API_URL}/classes`, corps);
    this.envoyer(req, (r) => {
      this.fermer();
      this.confirmer(c ? `Classe modifiée : ${r.nom}` : `Classe créée : ${r.nom}`);
      this.charger();
    });
  }

  protected demanderSuppression(c: Classe): void { this.cible.set(c); this.ouvrir('supprimer'); }

  protected supprimer(): void {
    const c = this.cible();
    if (!c) { return; }
    this.envoyer(this.http.delete(`${API_URL}/classes/${c.id}`), () => {
      this.fermer();
      this.confirmer(`Classe supprimée : ${c.nom}`);
      this.charger();
    });
  }
}
