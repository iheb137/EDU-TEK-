import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { Auth } from '../../../core/auth';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { IaApi, semestreParDefaut } from '../ia-api';
import {
  ICONE_TYPE_ACTION, TYPES_ACTION, libelleNiveau, libelleStatutAction, libelleStatutAlerte, libelleTypeAction, pourcentScore,
} from '../libelles';
import { ActionAccompagnement, AlerteIa, SemestreRef, StatutAction } from '../modeles';

interface Ligne { action: ActionAccompagnement; alerte: AlerteIa; }
interface Groupe { statut: StatutAction; titre: string; aide: string; vide: string; lignes: Ligne[]; }

const GROUPES: Omit<Groupe, 'lignes'>[] = [
  { statut: 'PLANIFIEE', titre: 'Planifiées', aide: 'Actions décidées, pas encore commencées.', vide: 'Aucune action planifiée.' },
  { statut: 'EN_COURS', titre: 'En cours', aide: 'Actions engagées auprès de l\'étudiant.', vide: 'Aucune action en cours.' },
  { statut: 'TERMINEE', titre: 'Terminées', aide: 'Actions menées à leur terme.', vide: 'Aucune action terminée.' },
  { statut: 'ANNULEE', titre: 'Annulées', aide: 'Actions abandonnées ou devenues sans objet.', vide: 'Aucune action annulée.' },
];

/** Suivi des actions d'accompagnement, reconstruit à partir des alertes et de leurs actions. */
@Component({
  selector: 'app-accompagnement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet, Icon],
  templateUrl: './accompagnement.html',
  styleUrls: ['../../../shared/ui.scss', '../ia.scss', './accompagnement.scss'],
})
export class Accompagnement {
  private readonly api = inject(IaApi);

  protected readonly typesAction = TYPES_ACTION;
  protected readonly libelleType = libelleTypeAction;
  protected readonly libelleNiveau = libelleNiveau;
  protected readonly libelleStatutAlerte = libelleStatutAlerte;
  protected readonly libelleStatutAction = libelleStatutAction;
  protected readonly iconeType = (t: string) => ICONE_TYPE_ACTION[t] ?? 'clipboard';
  protected readonly pourcent = pourcentScore;
  protected readonly date = dateFr;

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly avertissement = signal('');
  protected readonly semestres = signal<SemestreRef[]>([]);
  protected readonly semestreId = signal<number | null>(null);
  protected readonly alertes = signal<AlerteIa[]>([]);
  protected readonly lignes = signal<Ligne[]>([]);
  protected readonly type = signal('');
  protected readonly recherche = signal('');
  protected readonly voirCloturees = signal(false);

  private readonly filtrees = computed(() => {
    const q = this.normaliser(this.recherche());
    const t = this.type();
    return this.lignes()
      .filter((l) => !t || l.action.type === t)
      .filter((l) => !q || this.normaliser(`${l.alerte.etudiantNom} ${l.alerte.etudiantMatricule} ${l.action.description}`).includes(q));
  });

  protected readonly groupes = computed<Groupe[]>(() => GROUPES.map((g) => ({
    ...g,
    lignes: this.filtrees().filter((l) => l.action.statut === g.statut)
      .sort((a, b) => (b.action.dateCreation ?? '').localeCompare(a.action.dateCreation ?? '')),
  })));
  protected readonly actifs = computed(() => this.groupes().slice(0, 2));
  protected readonly clotures = computed(() => this.groupes().slice(2));
  protected readonly nbClotures = computed(() => this.clotures().reduce((n, g) => n + g.lignes.length, 0));

  protected readonly sansAction = computed(() => this.alertes().filter((a) => a.statut === 'OUVERTE' && !a.nbActions).length);
  protected readonly enSuivi = computed(() => new Set(this.lignes().filter((l) => l.action.statut === 'PLANIFIEE' || l.action.statut === 'EN_COURS').map((l) => l.alerte.etudiantId)).size);

  constructor() {
    this.api.semestres().subscribe({
      next: (l) => { this.semestres.set(l); this.semestreId.set(semestreParDefaut(l)?.id ?? null); this.charger(); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.avertissement.set('');
    this.api.alertes({ semestreId: this.semestreId() }).subscribe({
      next: (alertes) => {
        this.alertes.set(alertes);
        const avecActions = alertes.filter((a) => a.nbActions > 0);
        if (!avecActions.length) { this.lignes.set([]); this.chargement.set(false); return; }
        let echecs = 0;
        forkJoin(avecActions.map((a) => this.api.actions(a.id).pipe(
          map((actions) => actions.map((action) => ({ action, alerte: a }))),
          catchError(() => { echecs++; return of([] as Ligne[]); }),
        ))).subscribe((tous) => {
          this.lignes.set(tous.flat());
          if (echecs) { this.avertissement.set(`Les actions de ${echecs} alerte${echecs > 1 ? 's' : ''} n'ont pas pu être chargées.`); }
          this.chargement.set(false);
        });
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisirSemestre(v: string): void { this.semestreId.set(v === 'tous' ? null : Number(v)); this.charger(); }
  protected choisirType(v: string): void { this.type.set(v); }
  protected chercher(v: string): void { this.recherche.set(v); }
  protected parametresAlertes(): Record<string, string | number> {
    return { statut: 'OUVERTE', semestre: this.semestreId() ?? 'tous' };
  }

  private normaliser(t: string): string { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
}
