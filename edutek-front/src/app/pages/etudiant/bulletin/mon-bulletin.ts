import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr, nombreFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { EspaceEtudiant, semestreCourant } from '../espace-etudiant';
import { Bulletin, DECISIONS, Indicateur, ResultatSemestre, SemestreDto, libelle } from '../modeles';
import { indicateursAffiches, rangFr } from '../outils';

/** Bulletin d'un semestre (moyennes par matière, crédits, décision, rang si publié) et historique des résultats publiés. */
@Component({
  selector: 'app-mon-bulletin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  templateUrl: './mon-bulletin.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss', './mon-bulletin.scss'],
})
export class MonBulletin {
  private readonly http = inject(HttpClient);
  private readonly espace = inject(EspaceEtudiant);
  private readonly demande = inject(ActivatedRoute).snapshot.queryParamMap.get('semestre');

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly semestres = signal<SemestreDto[]>([]);
  protected readonly semestreId = signal<number | null>(null);
  protected readonly resultats = signal<ResultatSemestre[]>([]);
  protected readonly bulletin = signal<Bulletin | null>(null);
  protected readonly indicateurs = signal<Indicateur[]>([]);
  protected readonly chargementBulletin = signal(false);
  protected readonly erreurBulletin = signal('');

  protected readonly publie = computed(() => { const b = this.bulletin(); return !!b && b.decision !== 'EN_ATTENTE_PUBLICATION'; });
  protected readonly resultat = computed(() => this.resultats().find((r) => r.semestreId === this.semestreId()) ?? null);
  protected readonly creditsTotal = computed(() => (this.bulletin()?.matieres ?? []).reduce((t, m) => t + (m.credits ?? 0), 0));
  protected readonly indicateursSuivi = computed(() => indicateursAffiches(this.indicateurs()));
  protected readonly dateIndicateurs = computed(() => this.indicateurs()[0]?.dateCalcul);
  protected readonly historique = computed(() => {
    const noms = new Map(this.semestres().map((s, i) => [s.id, { nom: s.nom, ordre: i }]));
    return [...this.resultats()]
      .map((r) => ({ ...r, semestreNom: noms.get(r.semestreId)?.nom ?? `Semestre n° ${r.semestreId}`, ordre: noms.get(r.semestreId)?.ordre ?? 99 }))
      .sort((a, b) => b.ordre - a.ordre);
  });

  protected readonly cartes = computed(() => {
    const b = this.bulletin();
    if (!b) { return []; }
    const r = this.resultat();
    const pub = this.publie();
    return [
      { titre: 'Moyenne du semestre', valeur: pub && b.moyenne != null ? nombreFr(b.moyenne) : '—', sur: pub && b.moyenne != null, note: pub ? 'Résultat officiel publié' : 'Affichée après publication des résultats', couleur: '#3d5bd6', icone: 'calculator' },
      { titre: 'Crédits obtenus', valeur: pub && b.creditsObtenus != null ? String(b.creditsObtenus) : '—', sur: false, note: `sur ${this.creditsTotal()} crédits au programme`, couleur: '#1f9d78', icone: 'ribbon' },
      { titre: 'Décision', valeur: libelle(DECISIONS, b.decision), sur: false, texte: true, note: pub ? 'Décision du jury' : 'Résultats non encore publiés', couleur: '#d98a00', icone: 'flag' },
      { titre: 'Rang dans la classe', valeur: r?.rangClasse ? rangFr(r.rangClasse) : '—', sur: false, note: r?.rangClasse ? `${r.effectifClasse ?? '?'} étudiants · ${rangFr(r.rangFiliere, r.effectifFiliere) || 'rang filière non communiqué'} en filière` : 'Communiqué après publication', couleur: '#6a4fc9', icone: 'podium' },
    ];
  });

  constructor() {
    forkJoin({
      semestres: this.espace.semestres(),
      resultats: this.http.get<ResultatSemestre[]>(`${API_URL}/resultats/mes-resultats`),
    }).subscribe({
      next: ({ semestres, resultats }) => {
        this.semestres.set(semestres);
        this.resultats.set(resultats);
        this.chargement.set(false);
        const s = semestres.find((x) => String(x.id) === this.demande) ?? semestreCourant(semestres);
        if (s) { this.choisir(s.id); }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisir(id: number | string): void {
    const sid = Number(id);
    this.semestreId.set(sid);
    this.bulletin.set(null);
    this.indicateurs.set([]);
    this.erreurBulletin.set('');
    this.chargementBulletin.set(true);
    forkJoin({
      bulletin: this.http.get<Bulletin>(`${API_URL}/resultats/mon-bulletin`, { params: { semestreId: sid } }),
      indicateurs: this.http.get<Indicateur[]>(`${API_URL}/indicateurs/mes-indicateurs`, { params: { semestreId: sid } }).pipe(catchError(() => of([] as Indicateur[]))),
    }).subscribe({
      next: ({ bulletin, indicateurs }) => {
        if (this.semestreId() !== sid) { return; }
        this.bulletin.set(bulletin); this.indicateurs.set(indicateurs); this.chargementBulletin.set(false);
      },
      error: (e: unknown) => { this.erreurBulletin.set(Auth.message(e)); this.chargementBulletin.set(false); },
    });
  }

  protected imprimer(): void { window.print(); }
  protected nombre(n?: number | null): string { return n == null ? '—' : nombreFr(n, 2); }
  protected decision(d?: string | null): string { return libelle(DECISIONS, d); }
  protected rang(r?: number | null, e?: number | null): string { return rangFr(r, e) || '—'; }
  protected readonly dateHeure = dateHeureFr;
}
