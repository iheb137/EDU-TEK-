import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, messageErreur, parNom } from '../commun/base';
import { Confirmation } from '../commun/confirmation';
import { Classe, Formation, Semestre } from '../commun/modeles';

/** Formations : liste, création, modification, suppression ; accès aux règles de calcul et au plan d'études. */
@Component({
  selector: 'app-formations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal, Confirmation],
  templateUrl: './formations.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class Formations extends PageReferentiel<'editer' | 'supprimer'> {
  protected readonly formations = signal<Formation[]>([]);
  private readonly semestres = signal<Semestre[]>([]);
  private readonly classes = signal<Classe[]>([]);
  protected readonly cible = signal<Formation | null>(null);

  protected readonly lignes = computed(() => parNom(this.formations(), (f) => f.code).map((f) => ({
    ...f,
    nbSemestres: this.semestres().filter((s) => s.formationId === f.id).length,
    nbClasses: this.classes().filter((c) => c.formationId === f.id).length,
  })));

  protected readonly formulaire = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    nom: ['', [Validators.required, Validators.maxLength(200)]],
    niveau: [''],
  });

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      f: this.http.get<Formation[]>(`${API_URL}/formations`),
      s: this.http.get<Semestre[]>(`${API_URL}/semestres`),
      c: this.http.get<Classe[]>(`${API_URL}/classes`),
    }).subscribe({
      next: (r) => { this.formations.set(r.f); this.semestres.set(r.s); this.classes.set(r.c); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected nouvelle(): void {
    this.cible.set(null);
    this.formulaire.reset({ code: '', nom: '', niveau: '' });
    this.ouvrir('editer');
  }

  protected modifier(f: Formation): void {
    this.cible.set(f);
    this.formulaire.reset({ code: f.code, nom: f.nom, niveau: f.niveau ?? '' });
    this.ouvrir('editer');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps = { code: v.code.trim(), nom: v.nom.trim(), niveau: v.niveau.trim() || null };
    const c = this.cible();
    const req = c
      ? this.http.put<Formation>(`${API_URL}/formations/${c.id}`, { id: c.id, ...corps })
      : this.http.post<Formation>(`${API_URL}/formations`, corps);
    this.envoyer(req, (f) => {
      this.fermer();
      this.confirmer(c ? `Formation modifiée : ${f.code}` : `Formation créée : ${f.code}`);
      this.charger();
    });
  }

  /** Le serveur supprime en cascade classes, semestres et matières de la formation : on l'annonce clairement. */
  protected detailSuppression(): string {
    const l = this.lignes().find((x) => x.id === this.cible()?.id);
    const n = l ? `${l.nbSemestres} semestre${l.nbSemestres > 1 ? 's' : ''} et ${l.nbClasses} classe${l.nbClasses > 1 ? 's' : ''}` : 'ses semestres et classes';
    return `Attention : ${n} rattachés, ainsi que leurs matières, seront supprimés avec la formation. `
      + 'La suppression est refusée si des étudiants, enseignements, inscriptions ou des règles de calcul propres en dépendent.';
  }

  protected demanderSuppression(f: Formation): void { this.cible.set(f); this.ouvrir('supprimer'); }

  protected supprimer(): void {
    const f = this.cible();
    if (!f) { return; }
    this.envoyer(this.http.delete(`${API_URL}/formations/${f.id}`), () => {
      this.fermer();
      this.confirmer(`Formation supprimée : ${f.code}`);
      this.charger();
    });
  }
}
