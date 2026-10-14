import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { ContexteEnseignant } from '../contexte';
import { Avancement, LigneEnseignement, TYPES_EVALUATION, resumer, semestreCourant } from '../modeles';

/** Enseignements de l'enseignant : avancement de la saisie des notes et clôture. */
@Component({
  selector: 'app-mes-enseignements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Modal, RouterLink],
  templateUrl: './mes-enseignements.html',
  styleUrls: ['../../../shared/ui.scss', '../enseignant.scss'],
})
export class MesEnseignements {
  private readonly http = inject(HttpClient);
  private readonly contexte = inject(ContexteEnseignant);
  private readonly auth = inject(Auth);
  protected readonly admin = this.contexte.estAdminPedagogie();
  protected readonly peutCloturer = this.auth.a('SUPERADMIN', 'ADMIN_PEDAGOGIQUE', 'ENSEIGNANT');
  protected readonly typeEval = (t: string) => TYPES_EVALUATION[t] ?? t;
  protected readonly dateFr = dateFr;
  protected readonly dateHeureFr = dateHeureFr;

  protected readonly lignes = signal<LigneEnseignement[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly semestre = signal<number | 0>(0);
  protected readonly classe = signal<number | 0>(0);
  protected readonly recherche = signal('');

  protected readonly fenetre = signal<null | 'detail' | 'cloturer' | 'rouvrir'>(null);
  protected readonly cible = signal<LigneEnseignement | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  protected readonly semestres = computed(() => {
    const m = new Map<number, string>();
    this.lignes().forEach((l) => m.set(l.e.semestreId, l.e.semestre));
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([id, nom]) => ({ id, nom }));
  });
  protected readonly classes = computed(() => {
    const m = new Map<number, string>();
    this.lignes().forEach((l) => m.set(l.e.classeId, l.e.classe));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr')).map(([id, nom]) => ({ id, nom }));
  });
  protected readonly visibles = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.lignes().filter((l) =>
      (!this.semestre() || l.e.semestreId === this.semestre()) &&
      (!this.classe() || l.e.classeId === this.classe()) &&
      (!q || l.e.libelle.toLowerCase().includes(q) || l.e.codeMatiere.toLowerCase().includes(q)));
  });
  protected readonly synthese = computed(() => {
    const v = this.visibles();
    return { total: v.length, clotures: v.filter((l) => l.av?.cloture).length, completes: v.filter((l) => l.attendues > 0 && l.soumises >= l.attendues).length };
  });

  constructor() { this.charger(true); }

  protected charger(initial = false): void {
    this.chargement.set(true);
    this.contexte.enseignements().subscribe({
      next: (liste) => {
        if (!liste.length) { this.lignes.set([]); this.chargement.set(false); return; }
        forkJoin(liste.map((e) => this.http.get<Avancement>(`${API_URL}/enseignements/${e.id}/avancement`).pipe(
          map((av) => resumer(e, av)), catchError(() => of(resumer(e, null)))))).subscribe((l) => {
          this.lignes.set(l);
          if (initial && !this.semestre()) { this.semestre.set(semestreCourant(l.map((x) => x.e))); }
          this.erreur.set('');
          this.chargement.set(false);
        });
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisirSemestre(v: string): void { this.semestre.set(Number(v)); }
  protected choisirClasse(v: string): void { this.classe.set(Number(v)); }

  protected ouvrir(f: 'detail' | 'cloturer' | 'rouvrir', l: LigneEnseignement): void {
    this.cible.set(l); this.erreurFenetre.set(''); this.fenetre.set(f);
  }
  protected fermer(): void { this.fenetre.set(null); }

  protected cloturer(): void { this.basculer('cloturer', 'Saisie clôturée'); }
  protected rouvrir(): void { this.basculer('rouvrir', 'Saisie rouverte'); }

  private basculer(action: 'cloturer' | 'rouvrir', message: string): void {
    const l = this.cible();
    if (!l) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post(`${API_URL}/enseignements/${l.e.id}/${action}`, null).subscribe({
      next: () => {
        this.enCours.set(false);
        this.fermer();
        this.confirmer(`${message} : ${l.e.libelle}.`);
        this.http.get<Avancement>(`${API_URL}/enseignements/${l.e.id}/avancement`).subscribe({
          next: (av) => this.lignes.update((ls) => ls.map((x) => (x.e.id === l.e.id ? resumer(l.e, av) : x))),
        });
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected manquantes(l: LigneEnseignement): number { return Math.max(0, l.attendues - l.soumises - l.brouillons); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
