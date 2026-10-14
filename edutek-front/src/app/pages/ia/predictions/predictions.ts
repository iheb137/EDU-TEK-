import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Facteurs } from '../commun/facteurs';
import { IaApi, semestreParDefaut } from '../ia-api';
import { NIVEAUX, facteurPrincipal, libelleNiveau, pourcentScore } from '../libelles';
import { ClasseRef, EtudiantRef, Prediction, ResultatAnalyse, SemestreRef } from '../modeles';

type Portee = 'semestre' | 'classe' | 'etudiant';
type Fenetre = null | 'analyse' | 'facteurs';
const TAILLE_PAGE = 20;

/** Historique des prédictions (filtres semestre, étudiant, niveau) et lancement d'une analyse ciblée. */
@Component({
  selector: 'app-predictions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Icon, Modal, Facteurs],
  templateUrl: './predictions.html',
  styleUrls: ['../../../shared/ui.scss', '../ia.scss', './predictions.scss'],
})
export class Predictions {
  private readonly api = inject(IaApi);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly niveaux = NIVEAUX;
  protected readonly libelleNiveau = libelleNiveau;
  protected readonly pourcent = pourcentScore;
  protected readonly dateHeure = dateHeureFr;
  protected readonly principal = facteurPrincipal;

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly semestres = signal<SemestreRef[]>([]);
  protected readonly classes = signal<ClasseRef[]>([]);
  protected readonly etudiants = signal<EtudiantRef[]>([]);
  protected readonly predictions = signal<Prediction[]>([]);

  protected readonly semestreId = signal<number | null>(null);
  protected readonly etudiantId = signal<number | null>(null);
  protected readonly niveau = signal('');
  protected readonly dernieres = signal(false);
  protected readonly page = signal(0);

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly selection = signal<Prediction | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly resultat = signal<ResultatAnalyse | null>(null);

  protected readonly formAnalyse = this.fb.nonNullable.group({
    semestreId: [0, Validators.min(1)],
    portee: ['semestre' as Portee],
    classeId: [0],
    etudiantId: [0],
  });
  protected readonly portee = signal<Portee>('semestre');

  protected readonly nomSemestre = computed(() => {
    const m = new Map(this.semestres().map((s) => [s.id, s.nom]));
    return (id: number) => m.get(id) ?? `Semestre ${id}`;
  });
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.predictions().length / TAILLE_PAGE)));
  protected readonly visibles = computed(() => {
    const p = Math.min(this.page(), this.pages() - 1);
    return this.predictions().slice(p * TAILLE_PAGE, (p + 1) * TAILLE_PAGE);
  });
  protected readonly repartition = computed(() => this.compter(this.predictions()));

  protected readonly bilan = computed(() => {
    const r = this.resultat();
    if (!r) { return null; }
    const aSuivre = r.predictions.filter((p) => p.niveau !== 'FAIBLE').sort((a, b) => b.probabilite - a.probabilite);
    return { ...this.compter(r.predictions), aSuivre };
  });

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    const sem = q.get('semestre');
    const etu = Number(q.get('etudiant'));
    if (etu > 0) { this.etudiantId.set(etu); }
    this.api.etudiants().subscribe({ next: (l) => this.etudiants.set(l), error: () => this.etudiants.set([]) });
    this.api.classes().subscribe({ next: (l) => this.classes.set(l), error: () => this.classes.set([]) });
    this.api.semestres().subscribe({
      next: (l) => {
        this.semestres.set(l);
        if (sem === 'tous') { this.semestreId.set(null); }
        else if (sem && l.some((s) => s.id === Number(sem))) { this.semestreId.set(Number(sem)); }
        else { this.semestreId.set(semestreParDefaut(l)?.id ?? null); }
        this.charger();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected charger(): void {
    this.chargement.set(true);
    this.api.predictions({ semestreId: this.semestreId(), etudiantId: this.etudiantId(), niveau: this.niveau() || null, dernieresSeulement: this.dernieres() }).subscribe({
      next: (l) => { this.predictions.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisirSemestre(v: string): void { this.semestreId.set(v === 'tous' ? null : Number(v)); this.filtreChange(); }
  protected choisirEtudiant(v: string): void { this.etudiantId.set(Number(v) || null); this.filtreChange(); }
  protected choisirNiveau(v: string): void { this.niveau.set(v); this.filtreChange(); }
  protected basculerDernieres(v: boolean): void { this.dernieres.set(v); this.filtreChange(); }
  protected aller(delta: number): void { this.page.update((p) => Math.min(this.pages() - 1, Math.max(0, p + delta))); }

  private filtreChange(): void {
    this.page.set(0);
    this.router.navigate([], { relativeTo: this.route, replaceUrl: true,
      queryParams: { semestre: this.semestreId() ?? 'tous', etudiant: this.etudiantId() } });
    this.charger();
  }

  protected nomEtudiant(id: number | null): string {
    const e = this.etudiants().find((x) => x.id === id);
    return e ? `${e.prenom} ${e.nom}` : '';
  }

  // ── Explications ──────────────────────────────────────────────────────
  protected voirFacteurs(p: Prediction): void { this.selection.set(p); this.fenetre.set('facteurs'); }

  // ── Analyse ciblée ────────────────────────────────────────────────────
  protected ouvrirAnalyse(): void {
    const etu = this.etudiantId();
    this.formAnalyse.reset({ semestreId: this.semestreId() ?? semestreParDefaut(this.semestres())?.id ?? 0, portee: etu ? 'etudiant' : 'semestre', classeId: 0, etudiantId: etu ?? 0 });
    this.portee.set(etu ? 'etudiant' : 'semestre');
    this.resultat.set(null);
    this.erreurFenetre.set('');
    this.fenetre.set('analyse');
  }

  protected choisirPortee(p: Portee): void { this.portee.set(p); this.formAnalyse.controls.portee.setValue(p); this.erreurFenetre.set(''); }

  protected lancerAnalyse(): void {
    if (this.enCours()) { return; }
    const v = this.formAnalyse.getRawValue();
    const semestreId = Number(v.semestreId);
    const classeId = Number(v.classeId);
    const etudiantId = Number(v.etudiantId);
    if (!semestreId) { this.erreurFenetre.set('Choisissez un semestre.'); return; }
    if (this.portee() === 'classe' && !classeId) { this.erreurFenetre.set('Choisissez une classe.'); return; }
    if (this.portee() === 'etudiant' && !etudiantId) { this.erreurFenetre.set('Choisissez un étudiant.'); return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.api.analyser(semestreId, {
      classeId: this.portee() === 'classe' ? classeId : null,
      etudiantId: this.portee() === 'etudiant' ? etudiantId : null,
    }).subscribe({
      next: (r) => { this.enCours.set(false); this.resultat.set(r); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void {
    const r = this.resultat();
    this.fenetre.set(null);
    this.selection.set(null);
    if (r) {
      this.info.set(`Analyse terminée : ${r.analyses} étudiant${r.analyses > 1 ? 's' : ''} analysé${r.analyses > 1 ? 's' : ''}, ${r.alertesCreees} nouvelle${r.alertesCreees > 1 ? 's' : ''} alerte${r.alertesCreees > 1 ? 's' : ''}.`);
      setTimeout(() => this.info.set(''), 4000);
      this.resultat.set(null);
    }
  }

  private compter(l: Prediction[]): { eleve: number; moyen: number; faible: number } {
    return { eleve: l.filter((p) => p.niveau === 'ELEVE').length, moyen: l.filter((p) => p.niveau === 'MOYEN').length, faible: l.filter((p) => p.niveau === 'FAIBLE').length };
  }
}
