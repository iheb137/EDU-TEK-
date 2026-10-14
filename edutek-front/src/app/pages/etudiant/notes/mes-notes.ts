import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, nombreFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { EspaceEtudiant, Referentiel, semestreCourant } from '../espace-etudiant';
import { Bulletin, Evenement, LigneMatiere, NoteDto, SemestreDto } from '../modeles';

interface LigneNote { note: NoteDto; evaluation?: Evenement; }
interface GroupeMatiere { nom: string; ligne?: LigneMatiere; notes: LigneNote[]; }

/** Notes de l'étudiant, par semestre et par matière. */
@Component({
  selector: 'app-mes-notes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  templateUrl: './mes-notes.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss', './mes-notes.scss'],
})
export class MesNotes {
  private readonly http = inject(HttpClient);
  private readonly espace = inject(EspaceEtudiant);
  private readonly demande = inject(ActivatedRoute).snapshot.queryParamMap.get('semestre');

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly semestres = signal<SemestreDto[]>([]);
  protected readonly semestreId = signal<number | null>(null);
  protected readonly notes = signal<NoteDto[]>([]);
  protected readonly referentiel = signal<Referentiel | null>(null);
  protected readonly bulletin = signal<Bulletin | null>(null);
  protected readonly chargementBulletin = signal(false);

  protected readonly semestre = computed(() => this.semestres().find((s) => s.id === this.semestreId()) ?? null);
  protected readonly publie = computed(() => { const b = this.bulletin(); return !!b && b.decision !== 'EN_ATTENTE_PUBLICATION'; });

  /** Notes du semestre choisi, regroupées par matière (ordre du bulletin). */
  protected readonly groupes = computed<GroupeMatiere[]>(() => {
    const ref = this.referentiel();
    const id = this.semestreId();
    if (!ref || id === null) { return []; }
    const parMatiere = new Map<string, LigneNote[]>();
    for (const n of this.notes()) {
      const ev = ref.evaluations.get(n.evaluationId);
      if (!ev || ev.semestreId !== id) { continue; }
      const l = parMatiere.get(ev.matiere) ?? [];
      l.push({ note: n, evaluation: ev });
      parMatiere.set(ev.matiere, l);
    }
    const lignes = this.bulletin()?.matieres ?? [];
    const groupes: GroupeMatiere[] = lignes.map((l) => ({ nom: l.nom, ligne: l, notes: parMatiere.get(l.nom) ?? [] }));
    for (const [nom, notes] of parMatiere) {
      if (!lignes.some((l) => l.nom === nom)) { groupes.push({ nom, notes }); }
    }
    for (const g of groupes) { g.notes.sort((a, b) => (a.evaluation?.date ?? '').localeCompare(b.evaluation?.date ?? '')); }
    return groupes;
  });

  protected readonly nbNotes = computed(() => this.groupes().reduce((t, g) => t + g.notes.length, 0));
  protected readonly nonRattachees = computed(() => {
    const ref = this.referentiel();
    return ref ? this.notes().filter((n) => !ref.evaluations.has(n.evaluationId)) : [];
  });

  constructor() {
    forkJoin({ semestres: this.espace.semestres(), notes: this.http.get<NoteDto[]>(`${API_URL}/notes/mes-notes`), ref: this.espace.referentiel() }).subscribe({
      next: ({ semestres, notes, ref }) => {
        this.semestres.set(semestres);
        this.notes.set(notes);
        this.referentiel.set(ref);
        const voulu = semestres.find((s) => String(s.id) === this.demande);
        const s = voulu ?? semestreCourant(semestres);
        this.chargement.set(false);
        if (s) { this.choisir(s.id); }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisir(id: number | string): void {
    this.semestreId.set(Number(id));
    this.bulletin.set(null);
    this.chargementBulletin.set(true);
    this.http.get<Bulletin>(`${API_URL}/resultats/mon-bulletin`, { params: { semestreId: Number(id) } }).subscribe({
      next: (b) => { this.bulletin.set(b); this.chargementBulletin.set(false); },
      error: () => { this.chargementBulletin.set(false); },
    });
  }

  protected readonly date = dateFr;
  protected nombre(n?: number | null): string { return nombreFr(n, 2); }
  protected largeur(v: number): number { return Math.max(0, Math.min(100, (v / 20) * 100)); }
  protected couleur(v: number): string { return v < 10 ? '#e5483b' : v < 12 ? '#f0a01c' : '#2fb98d'; }
}
