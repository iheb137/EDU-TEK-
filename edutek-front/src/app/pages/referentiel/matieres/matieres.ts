import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { nombreFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, indexer, messageErreur, normaliser, parNom } from '../commun/base';
import { Confirmation } from '../commun/confirmation';
import { Formation, Matiere, Semestre } from '../commun/modeles';

/** Matières : liste filtrable par semestre, création, modification (coefficient, crédits), suppression. */
@Component({
  selector: 'app-matieres',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal, Confirmation],
  templateUrl: './matieres.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class Matieres extends PageReferentiel<'editer' | 'supprimer'> {
  protected readonly matieres = signal<Matiere[]>([]);
  private readonly semestres = signal<Semestre[]>([]);
  private readonly formations = signal<Formation[]>([]);
  protected readonly filtreSemestre = signal<number | null>(Number(inject(ActivatedRoute).snapshot.queryParamMap.get('semestre')) || null);
  protected readonly recherche = signal('');
  protected readonly cible = signal<Matiere | null>(null);
  protected readonly nombre = nombreFr;

  protected readonly semestresParId = computed(() => indexer(this.semestres()));
  /** Semestres regroupés par formation pour les listes déroulantes. */
  protected readonly groupes = computed(() => parNom(this.formations(), (f) => f.code).map((f) => ({
    formation: f,
    semestres: this.semestres().filter((s) => s.formationId === f.id).sort((a, b) => (a.dateDebut ?? '').localeCompare(b.dateDebut ?? '')),
  })).filter((g) => g.semestres.length));

  protected readonly lignes = computed(() => {
    const s = this.filtreSemestre();
    const q = normaliser(this.recherche().trim());
    return parNom(this.matieres(), (m) => m.code)
      .filter((m) => (!s || m.semestreId === s) && (!q || normaliser(m.code + ' ' + m.nom).includes(q)))
      .map((m) => ({ ...m, semestre: this.semestresParId().get(m.semestreId) }));
  });
  protected readonly totaux = computed(() => ({
    credits: this.lignes().reduce((n, m) => n + (m.credits ?? 0), 0),
    coefficients: this.lignes().reduce((n, m) => n + (m.coefficient ?? 0), 0),
  }));

  protected readonly formulaire = this.fb.group({
    code: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(30)]),
    nom: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(200)]),
    semestreId: this.fb.control<number | null>(null, Validators.required),
    coefficient: this.fb.control<number | null>(1, [Validators.required, Validators.min(0.1), Validators.max(100)]),
    credits: this.fb.control<number | null>(2, [Validators.required, Validators.min(0), Validators.max(60)]),
  });

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      m: this.http.get<Matiere[]>(`${API_URL}/matieres`),
      s: this.http.get<Semestre[]>(`${API_URL}/semestres`),
      f: this.http.get<Formation[]>(`${API_URL}/formations`),
    }).subscribe({
      next: (r) => { this.matieres.set(r.m); this.semestres.set(r.s); this.formations.set(r.f); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected filtrer(valeur: string): void { this.filtreSemestre.set(Number(valeur) || null); }

  protected nouvelle(): void {
    this.cible.set(null);
    this.formulaire.reset({ code: '', nom: '', semestreId: this.filtreSemestre(), coefficient: 1, credits: 2 });
    this.ouvrir('editer');
  }

  protected modifier(m: Matiere): void {
    this.cible.set(m);
    this.formulaire.reset({ code: m.code, nom: m.nom, semestreId: m.semestreId, coefficient: m.coefficient ?? null, credits: m.credits ?? null });
    this.ouvrir('editer');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps = { code: v.code.trim(), nom: v.nom.trim(), semestreId: v.semestreId, coefficient: v.coefficient, credits: v.credits };
    const c = this.cible();
    const req = c
      ? this.http.put<Matiere>(`${API_URL}/matieres/${c.id}`, { id: c.id, ...corps })
      : this.http.post<Matiere>(`${API_URL}/matieres`, corps);
    this.envoyer(req, (m) => {
      this.fermer();
      this.confirmer(c ? `Matière modifiée : ${m.code}` : `Matière créée : ${m.code}`);
      this.charger();
    });
  }

  protected demanderSuppression(m: Matiere): void { this.cible.set(m); this.ouvrir('supprimer'); }

  protected supprimer(): void {
    const m = this.cible();
    if (!m) { return; }
    this.envoyer(this.http.delete(`${API_URL}/matieres/${m.id}`), () => {
      this.fermer();
      this.confirmer(`Matière supprimée : ${m.code}`);
      this.charger();
    });
  }
}
