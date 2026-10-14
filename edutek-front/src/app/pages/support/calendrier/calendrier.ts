import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import {
  CalendrierItem, ClasseVirtuelle, Evenement, Formation, PLATEFORME, TYPES_EVENEMENT, TYPE_EVENEMENT,
  heureFr, isoJour, jourFr, jourLocal, nbJours, periodeFr,
} from '../modeles';

type Categorie = 'SEANCE' | 'EXAMEN' | 'CLASSE_VIRTUELLE' | 'EVENEMENT';
type Vue = 'mois' | 'liste';
type Fenetre = null | 'jour' | 'element' | 'evenement' | 'supprimer';

/** Élément affiché dans le calendrier, quelle que soit sa source. */
interface Element {
  cle: string; categorie: Categorie; titre: string; debut: string; fin: string;
  heureDebut?: string | null; heureFin?: string | null; salle?: string | null; classe?: string | null; enseignant?: string | null;
  lien?: string; plateforme?: string; codeAcces?: string | null; evenement?: Evenement;
}
interface Jour { iso: string; numero: number; horsMois: boolean; aujourdhui: boolean; weekend: boolean; elements: Element[]; }

const CATEGORIES: { valeur: Categorie; libelle: string; court: string }[] = [
  { valeur: 'SEANCE', libelle: 'Séances de cours', court: 'Séance' },
  { valeur: 'EXAMEN', libelle: 'Évaluations', court: 'Évaluation' },
  { valeur: 'CLASSE_VIRTUELLE', libelle: 'Classes virtuelles', court: 'Classe virtuelle' },
  { valeur: 'EVENEMENT', libelle: 'Événements académiques', court: 'Événement' },
];
const JOURS_SEMAINE = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const MAX_PAR_CASE = 3;

/** La date de fin ne peut pas précéder la date de début. */
function finApresDebut(g: AbstractControl): ValidationErrors | null {
  const d = g.get('dateDebut')?.value as string;
  const f = g.get('dateFin')?.value as string;
  return d && f && f < d ? { ordre: true } : null;
}

/** Calendrier personnel (séances, évaluations, classes virtuelles, événements) et gestion du calendrier académique. */
@Component({
  selector: 'app-calendrier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './calendrier.html',
  styleUrls: ['../../../shared/ui.scss', '../support.scss', './calendrier.scss'],
})
export class Calendrier {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  protected readonly peutGerer = this.auth.a('SUPERADMIN', 'ADMIN_PEDAGOGIQUE');

  protected readonly categories = CATEGORIES;
  protected readonly joursSemaine = JOURS_SEMAINE;
  protected readonly maxParCase = MAX_PAR_CASE;
  protected readonly typesEvenement = TYPES_EVENEMENT;
  protected readonly libelleType = (t: string) => TYPE_EVENEMENT[t] ?? t;
  protected readonly libellePlateforme = (p?: string) => (p ? PLATEFORME[p] ?? p : '');
  protected readonly libelleCategorie = (c: Categorie) => CATEGORIES.find((x) => x.valeur === c)?.court ?? c;
  protected readonly heure = heureFr;
  protected readonly periode = periodeFr;
  protected readonly jourCourt = jourFr;

  protected readonly vue = signal<Vue>('mois');
  protected readonly curseur = signal(this.debutMois(new Date()));
  protected readonly actives = signal<Set<Categorie>>(new Set(CATEGORIES.map((c) => c.valeur)));

  protected readonly elements = signal<Element[] | null>(null);
  private readonly evenements = signal<Evenement[] | null>(null);
  protected readonly formations = signal<Formation[]>([]);
  private readonly classesVirtuelles = signal<ClasseVirtuelle[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly jourChoisi = signal<string | null>(null);
  protected readonly choisi = signal<Element | null>(null);
  protected readonly edition = signal<Evenement | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  private requete = 0;

  protected readonly formulaire = this.fb.nonNullable.group({
    titre: ['', [Validators.required, Validators.maxLength(150)]],
    type: ['AUTRE', Validators.required],
    dateDebut: ['', Validators.required],
    dateFin: [''],
    formationId: [''],
    description: ['', Validators.maxLength(1000)],
  }, { validators: finApresDebut });

  // ── Période affichée ────────────────────────────────────────────────────
  protected readonly titrePeriode = computed(() => {
    const t = this.curseur().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
  /** Bornes de la grille : du lundi précédant le 1er au dimanche suivant la fin du mois. */
  private readonly bornes = computed(() => {
    const m = this.curseur();
    const debut = new Date(m.getFullYear(), m.getMonth(), 1);
    debut.setDate(debut.getDate() - ((debut.getDay() + 6) % 7));
    const fin = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    fin.setDate(fin.getDate() + ((7 - fin.getDay()) % 7));
    return { debut, fin };
  });
  protected readonly anneeUniversitaire = computed(() => {
    const m = this.curseur();
    const a = m.getMonth() >= 8 ? m.getFullYear() : m.getFullYear() - 1;
    return { libelle: `${a}-${a + 1}`, du: `${a}-09-01`, au: `${a + 1}-08-31` };
  });

  /** Événements de l'année universitaire affichée, dans l'ordre chronologique. */
  protected readonly annee = computed(() => {
    const l = this.evenements();
    if (!l) { return null; }
    const an = this.anneeUniversitaire();
    return l.filter((e) => e.dateDebut <= an.au && (e.dateFin ?? e.dateDebut) >= an.du).sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  });

  protected readonly filtres = computed(() => (this.elements() ?? []).filter((e) => this.actives().has(e.categorie)));
  protected readonly comptes = computed(() => {
    const c: Partial<Record<string, number>> = {};
    const m = this.curseur().getMonth();
    for (const e of this.elements() ?? []) {
      if (jourLocal(e.debut).getMonth() === m || jourLocal(e.fin).getMonth() === m) { c[e.categorie] = (c[e.categorie] ?? 0) + 1; }
    }
    return c;
  });

  private readonly parJour = computed(() => {
    const carte = new Map<string, Element[]>();
    const { debut, fin } = this.bornes();
    for (const e of this.filtres()) {
      const d = jourLocal(e.debut) < debut ? new Date(debut) : jourLocal(e.debut);
      const f = jourLocal(e.fin) > fin ? fin : jourLocal(e.fin);
      for (const j = new Date(d); j <= f; j.setDate(j.getDate() + 1)) {
        const k = isoJour(j);
        carte.set(k, [...(carte.get(k) ?? []), e]);
      }
    }
    // Les événements d'une journée entière d'abord, puis l'ordre horaire.
    for (const [k, l] of carte) {
      carte.set(k, l.sort((a, b) => (a.heureDebut ? 1 : 0) - (b.heureDebut ? 1 : 0) || (a.heureDebut ?? '').localeCompare(b.heureDebut ?? '') || a.titre.localeCompare(b.titre, 'fr')));
    }
    return carte;
  });

  protected readonly semaines = computed<Jour[][]>(() => {
    const { debut, fin } = this.bornes();
    const mois = this.curseur().getMonth();
    const auj = isoJour(new Date());
    const semaines: Jour[][] = [];
    for (const j = new Date(debut); j <= fin; j.setDate(j.getDate() + 1)) {
      if ((j.getDay() + 6) % 7 === 0) { semaines.push([]); }
      const iso = isoJour(j);
      semaines[semaines.length - 1].push({
        iso, numero: j.getDate(), horsMois: j.getMonth() !== mois, aujourdhui: iso === auj,
        weekend: j.getDay() === 0 || j.getDay() === 6, elements: this.parJour().get(iso) ?? [],
      });
    }
    return semaines;
  });

  /** Vue liste : jours du mois affiché qui comportent au moins un élément. */
  protected readonly jours = computed(() => this.semaines().flat().filter((j) => !j.horsMois && j.elements.length));
  protected readonly elementsDuJour = computed(() => this.parJour().get(this.jourChoisi() ?? '') ?? []);

  constructor() {
    this.charger();
    this.http.get<Formation[]>(`${API_URL}/formations`).pipe(catchError(() => of([] as Formation[]))).subscribe((f) => this.formations.set(f));
  }

  // ── Chargement ──────────────────────────────────────────────────────────
  protected charger(): void {
    const n = ++this.requete;
    const { debut, fin } = this.bornes();
    const du = isoJour(debut);
    const au = isoJour(fin);
    const an = this.anneeUniversitaire();
    this.chargement.set(true);
    this.erreur.set('');
    const erreurs: string[] = [];
    const sur = <T,>(o: Observable<T>, defaut: T) => o.pipe(catchError((e: unknown) => { erreurs.push(Auth.message(e)); return of(defaut); }));
    const params = new HttpParams().set('du', du).set('au', au);
    forkJoin({
      moi: sur(this.http.get<CalendrierItem[]>(`${API_URL}/calendrier/moi`, { params }), [] as CalendrierItem[]),
      // Toute l'année universitaire (liste annuelle), élargie si la grille déborde sur l'année voisine.
      evenements: sur(this.http.get<Evenement[]>(`${API_URL}/calendrier/evenements`, {
        params: new HttpParams().set('du', du < an.du ? du : an.du).set('au', au > an.au ? au : an.au),
      }), [] as Evenement[]),
      cv: this.classesVirtuelles() ? of(this.classesVirtuelles()!) : sur(this.chargerClassesVirtuelles(), [] as ClasseVirtuelle[]),
    }).subscribe((r) => {
      if (n !== this.requete) { return; }
      this.classesVirtuelles.set(r.cv);
      this.evenements.set(r.evenements);
      this.elements.set(this.fusionner(r.moi, r.evenements, r.cv, du, au));
      this.erreur.set([...new Set(erreurs)].join(' '));
      this.chargement.set(false);
    });
  }

  /** Classes virtuelles visibles par le compte (la route « mon calendrier » ne les inclut pas). */
  private chargerClassesVirtuelles(): Observable<ClasseVirtuelle[]> {
    if (this.auth.a('ETUDIANT')) { return this.http.get<ClasseVirtuelle[]>(`${API_URL}/classes-virtuelles/mes-classes`); }
    if (this.auth.a('SUPERADMIN', 'ADMIN_PEDAGOGIQUE', 'ENSEIGNANT')) { return this.http.get<ClasseVirtuelle[]>(`${API_URL}/classes-virtuelles`); }
    return of([]);
  }

  private fusionner(items: CalendrierItem[], evenements: Evenement[], cv: ClasseVirtuelle[], du: string, au: string): Element[] {
    const parId = new Map(evenements.map((e) => [e.id, e]));
    const res: Element[] = items.map((i, k) => {
      if (i.categorie === 'EVENEMENT') {
        const ev = i.refId != null ? parId.get(i.refId) : undefined;
        return {
          cle: `EV-${i.refId ?? k}`, categorie: 'EVENEMENT' as Categorie, evenement: ev,
          // Le titre renvoyé est « titre (TYPE) » : on garde le titre seul, le type est affiché à part.
          titre: ev?.titre ?? i.titre.replace(/\s*\([A-Z_]+\)$/, ''), debut: i.date, fin: i.dateFin ?? i.date,
        };
      }
      return {
        cle: `${i.categorie}-${i.refId ?? k}`, categorie: (i.categorie === 'EXAMEN' ? 'EXAMEN' : 'SEANCE') as Categorie, titre: i.titre,
        debut: i.date, fin: i.dateFin ?? i.date, heureDebut: i.heureDebut, heureFin: i.heureFin, salle: i.salle, classe: i.classe, enseignant: i.enseignant,
      };
    });
    for (const c of cv) {
      const jour = (c.dateHeure ?? '').slice(0, 10);
      if (!jour || jour < du || jour > au) { continue; }
      res.push({
        cle: `CV-${c.id}`, categorie: 'CLASSE_VIRTUELLE', titre: `Classe virtuelle : ${c.matiereNom ?? ''}`.trim(), debut: jour, fin: jour,
        heureDebut: c.dateHeure.slice(11, 19) || null, classe: c.classeNom, enseignant: c.enseignantNom, lien: c.lien, plateforme: c.plateforme, codeAcces: c.codeAcces,
      });
    }
    return res;
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  protected decaler(n: number): void {
    const m = this.curseur();
    this.curseur.set(new Date(m.getFullYear(), m.getMonth() + n, 1));
    this.charger();
  }
  protected aujourdhui(): void { this.curseur.set(this.debutMois(new Date())); this.charger(); }
  protected basculer(c: Categorie): void {
    this.actives.update((s) => { const n = new Set(s); if (n.has(c)) { n.delete(c); } else { n.add(c); } return n; });
  }
  private debutMois(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }

  protected nomJour(iso: string): string {
    const t = jourLocal(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  protected horaire(e: Element): string {
    if (!e.heureDebut) { return e.debut === e.fin ? 'Journée entière' : `${nbJours(e.debut, e.fin)} jours`; }
    return e.heureFin ? `${heureFr(e.heureDebut)} – ${heureFr(e.heureFin)}` : heureFr(e.heureDebut);
  }
  protected details(e: Element): string {
    if (e.categorie === 'EVENEMENT') { return [e.evenement ? this.libelleType(e.evenement.type) : '', this.portee(e.evenement)].filter(Boolean).join(' · '); }
    return [e.salle ? `Salle ${e.salle}` : '', e.classe, e.enseignant, e.plateforme ? this.libellePlateforme(e.plateforme) : ''].filter(Boolean).join(' · ');
  }
  protected portee(ev?: Evenement | null): string {
    if (!ev) { return ''; }
    if (!ev.formationId) { return 'Tout l\'établissement'; }
    return this.formations().find((f) => f.id === ev.formationId)?.code ?? `Formation n° ${ev.formationId}`;
  }

  // ── Boîtes de dialogue ──────────────────────────────────────────────────
  protected ouvrirJour(iso: string): void { this.jourChoisi.set(iso); this.fenetre.set('jour'); }
  protected ouvrirElement(e: Element, ev?: Event): void {
    ev?.stopPropagation();
    this.choisi.set(e);
    this.erreurFenetre.set('');
    this.fenetre.set('element');
  }

  protected nouvelEvenement(): void {
    const d = isoJour(new Date());
    this.edition.set(null);
    this.formulaire.reset({ titre: '', type: 'AUTRE', dateDebut: d, dateFin: '', formationId: '', description: '' });
    this.erreurFenetre.set('');
    this.fenetre.set('evenement');
  }

  protected modifierEvenement(ev: Evenement): void {
    this.edition.set(ev);
    this.formulaire.reset({
      titre: ev.titre, type: ev.type, dateDebut: ev.dateDebut, dateFin: ev.dateFin && ev.dateFin !== ev.dateDebut ? ev.dateFin : '',
      formationId: ev.formationId ? String(ev.formationId) : '', description: ev.description ?? '',
    });
    this.erreurFenetre.set('');
    this.fenetre.set('evenement');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps: Evenement = {
      titre: v.titre.trim(), type: v.type, dateDebut: v.dateDebut, dateFin: v.dateFin || v.dateDebut,
      description: v.description.trim() || null, formationId: v.formationId ? Number(v.formationId) : null,
    };
    const ev = this.edition();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    const appel = ev?.id
      ? this.http.put<Evenement>(`${API_URL}/calendrier/evenements/${ev.id}`, { ...corps, id: ev.id })
      : this.http.post<Evenement>(`${API_URL}/calendrier/evenements`, corps);
    appel.subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.fermer();
        this.confirmer(ev ? `Événement « ${r.titre} » modifié.` : `Événement « ${r.titre} » ajouté au calendrier.`);
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected demanderSuppression(ev: Evenement): void { this.edition.set(ev); this.erreurFenetre.set(''); this.fenetre.set('supprimer'); }

  protected supprimer(): void {
    const ev = this.edition();
    if (!ev?.id) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.delete(`${API_URL}/calendrier/evenements/${ev.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(`Événement « ${ev.titre} » supprimé.`); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;
  private confirmer(m: string): void { clearTimeout(this.minuteurInfo); this.info.set(m); this.minuteurInfo = setTimeout(() => this.info.set(''), 4000); }
}
