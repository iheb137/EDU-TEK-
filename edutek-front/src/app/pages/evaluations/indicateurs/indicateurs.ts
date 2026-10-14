import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr, nombreFr, telechargerTexte } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { DonneesPedagogiques } from '../donnees';
import { Etudiant, INDICATEURS, Indicateur } from '../modeles';

interface Colonne { nom: string; libelle: string; format: 'note' | 'entier' | 'taux'; }
interface LigneInd { etudiantId: number; et?: Etudiant; valeurs: Record<string, number>; }

/** Indicateurs académiques par semestre et par étudiant : consultation et calcul. */
@Component({
  selector: 'app-indicateurs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './indicateurs.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/module.scss', './indicateurs.scss'],
})
export class Indicateurs {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly ref = inject(DonneesPedagogiques);
  protected readonly dateHeure = dateHeureFr;

  protected readonly semestre = signal<number | null>(null);
  protected readonly etudiant = signal<number | null>(null);
  protected readonly classe = signal<number | null>(null);
  protected readonly recherche = signal('');
  protected readonly donnees = signal<Indicateur[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly calcul = signal(false);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly tri = signal<{ col: string; sens: 1 | -1 }>({ col: 'nom', sens: 1 });
  protected readonly numero = signal(0);
  protected readonly taille = 20;

  protected readonly etudiantsProposes = computed(() => this.ref.etudiants().filter((e) => !this.classe() || e.classeId === this.classe()));

  /** Colonnes : indicateurs connus d'abord, puis tout autre indicateur renvoyé par l'API. */
  protected readonly colonnes = computed<Colonne[]>(() => {
    const noms = new Set((this.donnees() ?? []).map((i) => i.nom));
    const connues = INDICATEURS.filter((c) => noms.has(c.nom));
    const autres = [...noms].filter((n) => !INDICATEURS.some((c) => c.nom === n))
      .map((n) => ({ nom: n, libelle: n.charAt(0) + n.slice(1).toLowerCase().replace(/_/g, ' '), format: 'note' as const }));
    return [...connues, ...autres];
  });

  protected readonly lignes = computed<LigneInd[]>(() => {
    const parEt = new Map<number, LigneInd>();
    for (const i of this.donnees() ?? []) {
      let l = parEt.get(i.etudiantId);
      if (!l) { l = { etudiantId: i.etudiantId, et: this.ref.etudiantsParId().get(i.etudiantId), valeurs: {} }; parEt.set(i.etudiantId, l); }
      l.valeurs[i.nom] = i.valeur;
    }
    const q = this.recherche().trim().toLowerCase();
    const { col, sens } = this.tri();
    return [...parEt.values()]
      .filter((l) => !this.classe() || l.et?.classeId === this.classe())
      .filter((l) => !q || `${l.et?.nom ?? ''} ${l.et?.prenom ?? ''} ${l.et?.matricule ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (col === 'nom') { return sens * `${a.et?.nom} ${a.et?.prenom}`.localeCompare(`${b.et?.nom} ${b.et?.prenom}`); }
        return sens * ((a.valeurs[col] ?? -Infinity) - (b.valeurs[col] ?? -Infinity));
      });
  });
  protected readonly pageCourante = computed(() => this.lignes().slice(this.numero() * this.taille, (this.numero() + 1) * this.taille));
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.lignes().length / this.taille)));

  /** Moyenne de chaque indicateur sur les étudiants affichés. */
  protected readonly syntheses = computed(() => this.colonnes().map((c) => {
    const v = this.lignes().map((l) => l.valeurs[c.nom]).filter((x) => x !== undefined && x !== null);
    return { ...c, moyenne: v.length ? v.reduce((t, x) => t + x, 0) / v.length : null };
  }));
  protected readonly dernierCalcul = computed(() => (this.donnees() ?? []).reduce((m, i) => (i.dateCalcul > m ? i.dateCalcul : m), ''));

  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    this.ref.assurer().subscribe({
      next: () => {
        this.semestre.set(q.get('semestre') ? Number(q.get('semestre')) : this.ref.semestreCourant());
        this.etudiant.set(q.get('etudiant') ? Number(q.get('etudiant')) : null);
        this.charger();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  private params(): HttpParams {
    let p = new HttpParams().set('semestreId', this.semestre() ?? 0);
    if (this.etudiant()) { p = p.set('etudiantId', this.etudiant()!); }
    return p;
  }

  protected charger(): void {
    if (!this.semestre()) { this.chargement.set(false); return; }
    this.chargement.set(true);
    this.http.get<Indicateur[]>(`${API_URL}/indicateurs`, { params: this.params() }).subscribe({
      next: (d) => { this.donnees.set(d); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisir(champ: 'semestre' | 'etudiant' | 'classe', v: string): void {
    const n = v ? Number(v) : null;
    if (champ === 'semestre') { this.semestre.set(n); }
    if (champ === 'classe') { this.classe.set(n); if (this.etudiant() && !this.etudiantsProposes().some((e) => e.id === this.etudiant())) { this.etudiant.set(null); } }
    if (champ === 'etudiant') { this.etudiant.set(n); }
    this.numero.set(0);
    this.router.navigate([], { queryParams: { semestre: this.semestre(), etudiant: this.etudiant() ?? undefined }, replaceUrl: true });
    if (champ !== 'classe') { this.charger(); }
  }

  protected calculer(): void {
    this.calcul.set(true);
    this.erreur.set('');
    this.http.post<Indicateur[]>(`${API_URL}/indicateurs/calculer`, null, { params: this.params() }).subscribe({
      next: (d) => {
        this.calcul.set(false);
        const n = new Set(d.map((i) => i.etudiantId)).size;
        this.confirmer(`Indicateurs calculés pour ${n} étudiant${n > 1 ? 's' : ''}.`);
        this.charger();
      },
      error: (e: unknown) => { this.calcul.set(false); this.erreur.set(Auth.message(e)); },
    });
  }

  protected trier(col: string): void {
    this.tri.update((t) => ({ col, sens: t.col === col ? (t.sens === 1 ? -1 : 1) : (col === 'nom' ? 1 : -1) }));
  }
  protected sensTri(col: string): 'ascending' | 'descending' | 'none' {
    const t = this.tri();
    return t.col !== col ? 'none' : t.sens === 1 ? 'ascending' : 'descending';
  }
  protected aller(d: number): void { this.numero.update((n) => n + d); }

  protected formater(v: number | null | undefined, f: Colonne['format']): string {
    if (v === null || v === undefined) { return '–'; }
    if (f === 'taux') { return nombreFr(v * 100, 1) + ' %'; }
    if (f === 'entier') { return nombreFr(v, 0); }
    return nombreFr(v, 2);
  }

  protected exporter(): void {
    const cols = this.colonnes();
    const corps = this.lignes().map((l) => [l.et?.matricule ?? '', l.et?.nom ?? '', l.et?.prenom ?? '', ...cols.map((c) => (l.valeurs[c.nom] ?? '').toString().replace('.', ','))].join(';'));
    telechargerTexte(`indicateurs-semestre-${this.semestre()}.csv`, ['matricule', 'nom', 'prenom', ...cols.map((c) => c.nom.toLowerCase())].join(';') + '\n' + corps.join('\n') + '\n');
  }

  private confirmer(m: string): void {
    this.info.set(m);
    clearTimeout(this.minuteurInfo);
    this.minuteurInfo = setTimeout(() => this.info.set(''), 4000);
  }
}
