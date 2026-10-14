import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, indexer, messageErreur, parNom } from '../commun/base';
import { Classe, Etudiant, Formation, Inscription, STATUTS_INSCRIPTION, statutInscription } from '../commun/modeles';

/** Fiche d'un étudiant : informations, classe et inscriptions (ajout et changement de statut). */
@Component({
  selector: 'app-etudiant-fiche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal],
  templateUrl: './etudiant-fiche.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class EtudiantFiche extends PageReferentiel<'inscription'> {
  protected readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly etudiant = signal<Etudiant | null>(null);
  private readonly classes = signal<Classe[]>([]);
  protected readonly formations = signal<Formation[]>([]);
  private readonly toutes = signal<Inscription[]>([]);
  protected readonly cible = signal<Inscription | null>(null);
  protected readonly statuts = STATUTS_INSCRIPTION;
  protected readonly statut = statutInscription;
  protected readonly date = dateFr;

  protected readonly classe = computed(() => this.classes().find((c) => c.id === this.etudiant()?.classeId));
  protected readonly formationClasse = computed(() => this.formations().find((f) => f.id === this.classe()?.formationId));
  protected readonly formationsTriees = computed(() => parNom(this.formations(), (f) => f.code));
  protected readonly inscriptions = computed(() => {
    const fs = indexer(this.formations());
    return this.toutes().filter((i) => i.etudiantId === this.id)
      .sort((a, b) => (b.dateInscription ?? '').localeCompare(a.dateInscription ?? ''))
      .map((i) => ({ ...i, formation: fs.get(i.formationId) }));
  });

  protected readonly formulaire = this.fb.group({
    formationId: this.fb.control<number | null>(null, Validators.required),
    statut: this.fb.nonNullable.control('ACTIVE', Validators.required),
    dateInscription: this.fb.nonNullable.control(''),
  });

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      e: this.http.get<Etudiant>(`${API_URL}/etudiants/${this.id}`),
      c: this.http.get<Classe[]>(`${API_URL}/classes`),
      f: this.http.get<Formation[]>(`${API_URL}/formations`),
      i: this.http.get<Inscription[]>(`${API_URL}/inscriptions`),
    }).subscribe({
      next: (r) => {
        this.etudiant.set(r.e); this.classes.set(r.c); this.formations.set(r.f); this.toutes.set(r.i);
        this.erreur.set(''); this.chargement.set(false);
      },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected nouvelle(): void {
    this.cible.set(null);
    this.formulaire.reset({ formationId: this.formationClasse()?.id ?? null, statut: 'ACTIVE', dateInscription: new Date().toISOString().slice(0, 10) });
    this.formulaire.controls.formationId.enable();
    this.ouvrir('inscription');
  }

  protected modifier(i: Inscription): void {
    this.cible.set(i);
    this.formulaire.reset({ formationId: i.formationId, statut: i.statut ?? 'ACTIVE', dateInscription: i.dateInscription ?? '' });
    // L'API refuse de changer l'étudiant ou la formation d'une inscription existante.
    this.formulaire.controls.formationId.disable();
    this.ouvrir('inscription');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const c = this.cible();
    const corps = { etudiantId: this.id, formationId: v.formationId, statut: v.statut, dateInscription: v.dateInscription || null };
    const req = c
      ? this.http.put<Inscription>(`${API_URL}/inscriptions/${c.id}`, { id: c.id, ...corps })
      : this.http.post<Inscription>(`${API_URL}/inscriptions`, corps);
    this.envoyer(req, () => {
      this.fermer();
      this.confirmer(c ? 'Inscription modifiée.' : 'Inscription enregistrée.');
      this.charger();
    });
  }
}
