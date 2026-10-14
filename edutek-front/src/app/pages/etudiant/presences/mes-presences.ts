import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, pourcentFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { EspaceEtudiant, Referentiel, semestreCourant } from '../espace-etudiant';
import { Evenement, Justificatif, PresenceDto, SemestreDto } from '../modeles';

type Etat = 'present' | 'justifiee' | 'attente' | 'absent';
interface Ligne { presence: PresenceDto; seance?: Evenement; etat: Etat; }

/** Présences et absences de l'étudiant, par semestre. */
@Component({
  selector: 'app-mes-presences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  templateUrl: './mes-presences.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss', './mes-presences.scss'],
})
export class MesPresences {
  private readonly http = inject(HttpClient);
  private readonly espace = inject(EspaceEtudiant);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly semestres = signal<SemestreDto[]>([]);
  protected readonly semestreId = signal<number | null>(null);
  protected readonly presences = signal<PresenceDto[]>([]);
  protected readonly justificatifs = signal<Justificatif[]>([]);
  protected readonly referentiel = signal<Referentiel | null>(null);
  protected readonly filtre = signal<'toutes' | 'absences'>('toutes');

  protected readonly lignes = computed<Ligne[]>(() => {
    const ref = this.referentiel();
    const id = this.semestreId();
    if (!ref || id === null) { return []; }
    const attente = this.justificatifs().filter((j) => j.statut === 'SOUMIS');
    return this.presences()
      .map((p) => {
        const seance = ref.seances.get(p.seanceId);
        let etat: Etat = 'present';
        if (!p.present) {
          etat = p.justification ? 'justifiee'
            : seance && attente.some((j) => j.dateDebut <= seance.date && seance.date <= j.dateFin) ? 'attente' : 'absent';
        }
        return { presence: p, seance, etat };
      })
      .filter((l) => l.seance?.semestreId === id)
      .sort((a, b) => (b.seance!.date + (b.seance!.heureDebut ?? '')).localeCompare(a.seance!.date + (a.seance!.heureDebut ?? '')));
  });

  protected readonly affichees = computed(() => this.filtre() === 'absences' ? this.lignes().filter((l) => l.etat !== 'present') : this.lignes());

  protected readonly cartes = computed(() => {
    const l = this.lignes();
    const abs = l.filter((x) => x.etat !== 'present');
    const just = abs.filter((x) => x.etat === 'justifiee').length;
    const nonJust = abs.filter((x) => x.etat === 'absent').length;
    const assiduite = l.length ? (l.length - abs.length) / l.length : null;
    return [
      { titre: 'Séances pointées', valeur: String(l.length), note: 'sur le semestre', couleur: '#3d5bd6', icone: 'calendar' },
      { titre: 'Taux de présence', valeur: assiduite === null ? '—' : pourcentFr(assiduite), note: `${l.length - abs.length} présence${l.length - abs.length > 1 ? 's' : ''}`, couleur: '#1f9d78', icone: 'checkmark-done' },
      { titre: 'Absences', valeur: String(abs.length), note: `${just} justifiée${just > 1 ? 's' : ''}`, couleur: '#d98a00', icone: 'time' },
      { titre: 'À justifier', valeur: String(nonJust), note: nonJust ? 'Déposez un justificatif si le motif est valable' : 'Aucune absence en attente de justificatif', couleur: '#d6453a', icone: 'alert-circle' },
    ];
  });

  /** Assiduité par matière. */
  protected readonly parMatiere = computed(() => {
    const m = new Map<string, { total: number; absences: number }>();
    for (const l of this.lignes()) {
      const nom = l.seance?.matiere ?? 'Autre';
      const x = m.get(nom) ?? { total: 0, absences: 0 };
      x.total++; if (l.etat !== 'present') { x.absences++; }
      m.set(nom, x);
    }
    return [...m.entries()].map(([nom, x]) => ({ nom, ...x, part: x.total ? ((x.total - x.absences) / x.total) * 100 : 0 })).sort((a, b) => a.nom.localeCompare(b.nom));
  });

  protected readonly nonRattachees = computed(() => {
    const ref = this.referentiel();
    return ref ? this.presences().filter((p) => !ref.seances.has(p.seanceId)).length : 0;
  });

  constructor() {
    forkJoin({
      semestres: this.espace.semestres(),
      presences: this.http.get<PresenceDto[]>(`${API_URL}/presences/mes-presences`),
      ref: this.espace.referentiel(),
      justificatifs: this.http.get<Justificatif[]>(`${API_URL}/justificatifs/mes-justificatifs`).pipe(catchError(() => of([] as Justificatif[]))),
    }).subscribe({
      next: ({ semestres, presences, ref, justificatifs }) => {
        this.semestres.set(semestres); this.presences.set(presences); this.referentiel.set(ref); this.justificatifs.set(justificatifs);
        this.semestreId.set(semestreCourant(semestres)?.id ?? null);
        this.chargement.set(false);
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisir(v: string): void { this.semestreId.set(Number(v)); }
  protected readonly date = dateFr;
  protected heure(h?: string): string { return h ? h.slice(0, 5).replace(':', ' h ') : ''; }
  protected libelleEtat(e: Etat): string {
    return { present: 'Présent', justifiee: 'Absence justifiée', attente: 'Justificatif en attente', absent: 'Absent' }[e];
  }
}
