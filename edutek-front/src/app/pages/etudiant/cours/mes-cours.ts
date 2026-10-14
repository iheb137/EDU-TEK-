import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import {
  EnseignementSupports, SupportCours, formatFichier, grouperParChapitre, messageErreurBlob, tailleFr, telechargerSupport,
} from '../../enseignant/supports/supports-modeles';

const NOUVEAU_JOURS = 7;

/** Supports de cours publiés par les enseignants de la classe de l'étudiant, par matière et par chapitre. */
@Component({
  selector: 'app-mes-cours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './mes-cours.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss', '../../enseignant/supports/supports-cours.scss'],
})
export class MesCours {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly quand = dateHeureFr;
  protected readonly jour = dateFr;
  protected readonly taille = tailleFr;
  protected readonly format = formatFichier;

  protected readonly cours = signal<EnseignementSupports[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly semestre = signal<number | null>(null);
  protected readonly selection = signal<number | null>(null);
  protected readonly supports = signal<SupportCours[]>([]);
  protected readonly chargementSupports = signal(false);
  protected readonly telechargement = signal<number | null>(null);

  protected readonly semestres = computed(() => {
    const m = new Map<number, string>();
    for (const c of this.cours()) { m.set(c.semestreId, c.semestreNom); }
    return [...m.entries()].sort(([a], [b]) => b - a).map(([id, nom]) => ({ id, nom }));
  });
  protected readonly matieres = computed(() => this.cours().filter((c) => c.semestreId === this.semestre()));
  protected readonly courant = computed(() => this.cours().find((c) => c.enseignementId === this.selection()) ?? null);
  protected readonly groupes = computed(() => grouperParChapitre(this.supports()));

  constructor() {
    const id = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('matiere'));
    this.http.get<EnseignementSupports[]>(`${API_URL}/supports/mes-cours`).subscribe({
      next: (l) => {
        this.cours.set([...l].sort((a, b) => a.matiereNom.localeCompare(b.matiereNom, 'fr')));
        this.chargement.set(false);
        const demande = l.find((c) => c.enseignementId === id);
        this.semestre.set(demande?.semestreId ?? this.semestres()[0]?.id ?? null);
        // Par défaut : la matière demandée, sinon la première qui a des supports.
        const initial = demande ?? this.matieres().find((c) => c.supports > 0) ?? this.matieres()[0];
        if (initial) { this.choisir(initial.enseignementId, false); }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisirSemestre(id: number): void {
    this.semestre.set(id);
    const premier = this.matieres().find((c) => c.supports > 0) ?? this.matieres()[0];
    if (premier) { this.choisir(premier.enseignementId); } else { this.selection.set(null); this.supports.set([]); }
  }

  protected choisir(id: number, memoriser = true): void {
    this.selection.set(id);
    if (memoriser) { this.router.navigate([], { queryParams: { matiere: id }, replaceUrl: true }); }
    this.chargementSupports.set(true);
    this.supports.set([]);
    this.http.get<SupportCours[]>(`${API_URL}/enseignements/${id}/supports`).subscribe({
      next: (l) => { this.supports.set(l); this.chargementSupports.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargementSupports.set(false); },
    });
  }

  protected telecharger(s: SupportCours): void {
    this.telechargement.set(s.id);
    this.erreur.set('');
    telechargerSupport(this.http, s).subscribe({
      next: () => this.telechargement.set(null),
      error: async (e: unknown) => { this.telechargement.set(null); this.erreur.set(await messageErreurBlob(e)); },
    });
  }

  protected nouveau(iso?: string | null): boolean {
    return !!iso && Date.now() - new Date(iso).getTime() < NOUVEAU_JOURS * 86_400_000;
  }
}
