import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, indexer, messageErreur, parNom } from '../commun/base';
import { Confirmation } from '../commun/confirmation';
import { Formation, Matiere, Semestre } from '../commun/modeles';

/** Semestres : liste filtrable par formation, création, modification, suppression. */
@Component({
  selector: 'app-semestres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal, Confirmation],
  templateUrl: './semestres.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class Semestres extends PageReferentiel<'editer' | 'supprimer'> {
  protected readonly semestres = signal<Semestre[]>([]);
  protected readonly formations = signal<Formation[]>([]);
  private readonly matieres = signal<Matiere[]>([]);
  protected readonly filtreFormation = signal<number | null>(Number(inject(ActivatedRoute).snapshot.queryParamMap.get('formation')) || null);
  protected readonly cible = signal<Semestre | null>(null);
  protected readonly date = dateFr;

  protected readonly formationsParId = computed(() => indexer(this.formations()));
  protected readonly lignes = computed(() => {
    const f = this.filtreFormation();
    return this.semestres()
      .filter((s) => !f || s.formationId === f)
      .sort((a, b) => (a.dateDebut ?? '').localeCompare(b.dateDebut ?? '') || a.nom.localeCompare(b.nom, 'fr'))
      .map((s) => {
        const ms = this.matieres().filter((m) => m.semestreId === s.id);
        return { ...s, formation: this.formationsParId().get(s.formationId), nbMatieres: ms.length, credits: ms.reduce((n, m) => n + (m.credits ?? 0), 0) };
      });
  });
  protected readonly formationsTriees = computed(() => parNom(this.formations(), (f) => f.code));

  protected readonly formulaire = this.fb.group({
    nom: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    formationId: this.fb.control<number | null>(null, Validators.required),
    dateDebut: this.fb.nonNullable.control(''),
    dateFin: this.fb.nonNullable.control(''),
  });

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      s: this.http.get<Semestre[]>(`${API_URL}/semestres`),
      f: this.http.get<Formation[]>(`${API_URL}/formations`),
      m: this.http.get<Matiere[]>(`${API_URL}/matieres`),
    }).subscribe({
      next: (r) => { this.semestres.set(r.s); this.formations.set(r.f); this.matieres.set(r.m); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected filtrer(valeur: string): void { this.filtreFormation.set(Number(valeur) || null); }

  protected nouveau(): void {
    this.cible.set(null);
    const parDefaut = this.filtreFormation() ?? (this.formations().length === 1 ? this.formations()[0].id : null);
    this.formulaire.reset({ nom: '', formationId: parDefaut, dateDebut: '', dateFin: '' });
    this.ouvrir('editer');
  }

  protected modifier(s: Semestre): void {
    this.cible.set(s);
    this.formulaire.reset({ nom: s.nom, formationId: s.formationId, dateDebut: s.dateDebut ?? '', dateFin: s.dateFin ?? '' });
    this.ouvrir('editer');
  }

  protected datesIncoherentes(): boolean {
    const v = this.formulaire.getRawValue();
    return !!v.dateDebut && !!v.dateFin && v.dateFin < v.dateDebut;
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid || this.datesIncoherentes()) { return; }
    const v = this.formulaire.getRawValue();
    const corps = { nom: v.nom.trim(), formationId: v.formationId, dateDebut: v.dateDebut || null, dateFin: v.dateFin || null };
    const c = this.cible();
    const req = c
      ? this.http.put<Semestre>(`${API_URL}/semestres/${c.id}`, { id: c.id, ...corps })
      : this.http.post<Semestre>(`${API_URL}/semestres`, corps);
    this.envoyer(req, (s) => {
      this.fermer();
      this.confirmer(c ? `Semestre modifié : ${s.nom}` : `Semestre créé : ${s.nom}`);
      this.charger();
    });
  }

  protected demanderSuppression(s: Semestre): void { this.cible.set(s); this.ouvrir('supprimer'); }

  protected supprimer(): void {
    const s = this.cible();
    if (!s) { return; }
    this.envoyer(this.http.delete(`${API_URL}/semestres/${s.id}`), () => {
      this.fermer();
      this.confirmer(`Semestre supprimé : ${s.nom}`);
      this.charger();
    });
  }
}
