import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { Icon } from '../../../shared/icon/icon';
import { PageReferentiel, indexer, messageErreur, parNom } from '../commun/base';
import { Classe, Enseignant, Enseignement, Etudiant, Formation, Matiere, Semestre } from '../commun/modeles';

/** Fiche d'une classe : informations, étudiants de la classe et enseignements qui lui sont assurés. */
@Component({
  selector: 'app-classe-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './classe-detail.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class ClasseDetail extends PageReferentiel {
  protected readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly classe = signal<Classe | null>(null);
  private readonly formations = signal<Formation[]>([]);
  private readonly etudiantsTous = signal<Etudiant[]>([]);
  private readonly enseignementsTous = signal<Enseignement[]>([]);
  private readonly matieres = signal<Matiere[]>([]);
  private readonly enseignants = signal<Enseignant[]>([]);
  private readonly semestres = signal<Semestre[]>([]);

  protected readonly formation = computed(() => this.formations().find((f) => f.id === this.classe()?.formationId));
  protected readonly etudiants = computed(() => parNom(this.etudiantsTous().filter((e) => e.classeId === this.id), (e) => `${e.nom} ${e.prenom}`));
  protected readonly enseignements = computed(() => {
    const m = indexer(this.matieres()); const p = indexer(this.enseignants()); const s = indexer(this.semestres());
    return this.enseignementsTous().filter((e) => e.classeId === this.id)
      .map((e) => ({ ...e, matiere: m.get(e.matiereId), enseignant: p.get(e.enseignantId), semestre: s.get(e.semestreId) }))
      .sort((a, b) => (a.semestre?.dateDebut ?? '').localeCompare(b.semestre?.dateDebut ?? '') || (a.matiere?.code ?? '').localeCompare(b.matiere?.code ?? ''));
  });
  protected readonly volume = computed(() => this.enseignements().reduce((n, e) => n + (e.volumeHoraire ?? 0), 0));

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      c: this.http.get<Classe>(`${API_URL}/classes/${this.id}`),
      f: this.http.get<Formation[]>(`${API_URL}/formations`),
      e: this.http.get<Etudiant[]>(`${API_URL}/etudiants`),
      n: this.http.get<Enseignement[]>(`${API_URL}/enseignements`),
      m: this.http.get<Matiere[]>(`${API_URL}/matieres`),
      p: this.http.get<Enseignant[]>(`${API_URL}/enseignants`),
      s: this.http.get<Semestre[]>(`${API_URL}/semestres`),
    }).subscribe({
      next: (r) => {
        this.classe.set(r.c); this.formations.set(r.f); this.etudiantsTous.set(r.e); this.enseignementsTous.set(r.n);
        this.matieres.set(r.m); this.enseignants.set(r.p); this.semestres.set(r.s);
        this.erreur.set(''); this.chargement.set(false);
      },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }
}
