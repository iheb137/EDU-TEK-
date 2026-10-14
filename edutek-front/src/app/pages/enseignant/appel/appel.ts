import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';

interface Enseignement { id: number; matiereId: number; classeId: number; semestreId: number; groupe?: string; }
interface Seance { id: number; date: string; heureDebut: string; heureFin: string; salle?: string; enseignementId: number; }
interface Classe { id: number; nom: string; code: string; }
interface Matiere { id: number; nom: string; code: string; }
interface Etudiant { id: number; classeId?: number; }
interface Semestre { id: number; nom: string; dateDebut?: string; dateFin?: string; }
interface LigneSeance { seance: Seance; matiere: string; classe: string; classeId: number; effectif: number; pointes: number | null; }

/** « Faire l'appel » : l'enseignant retrouve la feuille de présence de sa classe ; enregistrer l'appel vaut pointage. */
@Component({
  selector: 'app-appel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule, Icon],
  templateUrl: './appel.html',
  styleUrls: ['../../../shared/ui.scss', './appel.scss'],
})
export class Appel {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly enseignements = signal<Enseignement[]>([]);
  protected readonly seances = signal<Seance[]>([]);
  private readonly classes = signal<Map<number, Classe>>(new Map());
  private readonly matieres = signal<Map<number, Matiere>>(new Map());
  private readonly effectifs = signal<Map<number, number>>(new Map());
  private readonly comptes = signal<Map<number, number>>(new Map());
  protected readonly classeChoisie = signal<number | null>(null);
  protected readonly creation = signal(false);
  /** Semestre en cours : seuls ses enseignements servent à créer une séance du jour. */
  protected readonly semestreCourant = signal<Semestre | null>(null);
  private readonly ensCourants = computed(() => {
    const s = this.semestreCourant();
    const l = s ? this.enseignements().filter((e) => e.semestreId === s.id) : this.enseignements();
    return l.length ? l : this.enseignements();
  });

  /** Date du jour en heure locale (AAAA-MM-JJ). */
  protected readonly auj = Appel.jourLocal(new Date());
  protected readonly dateFr = dateFr;

  protected readonly formulaire = this.fb.nonNullable.group({
    enseignementId: [0, [Validators.required, Validators.min(1)]],
    heureDebut: [this.heure(0), Validators.required],
    heureFin: [this.heure(90), Validators.required],
    salle: [''],
  });

  /** Classes de l'enseignant (onglets). */
  protected readonly mesClasses = computed(() => {
    const ids = [...new Set(this.ensCourants().map((e) => e.classeId))];
    return ids.map((id) => this.classes().get(id)).filter((c): c is Classe => !!c).sort((a, b) => a.nom.localeCompare(b.nom));
  });

  private readonly lignes = computed<LigneSeance[]>(() => {
    const parId = new Map(this.enseignements().map((e) => [e.id, e]));
    return this.seances().map((s) => {
      const e = parId.get(s.enseignementId);
      return {
        seance: s,
        matiere: e ? this.matieres().get(e.matiereId)?.nom ?? 'Matière' : 'Enseignement',
        classe: e ? this.classes().get(e.classeId)?.nom ?? '' : '',
        classeId: e?.classeId ?? 0,
        effectif: e ? this.effectifs().get(e.classeId) ?? 0 : 0,
        pointes: this.comptes().has(s.id) ? this.comptes().get(s.id)! : null,
      };
    }).filter((l) => this.classeChoisie() === null || l.classeId === this.classeChoisie());
  });

  protected readonly duJour = computed(() => this.lignes().filter((l) => l.seance.date === this.auj).sort((a, b) => a.seance.heureDebut.localeCompare(b.seance.heureDebut)));
  /** Séances passées des 30 derniers jours dont l'appel n'est pas (complètement) fait. */
  protected readonly enRetard = computed(() => {
    const limite = Appel.jourLocal(new Date(Date.now() - 30 * 86400000));
    return this.lignes().filter((l) => l.seance.date < this.auj && l.seance.date >= limite && l.pointes !== null && l.pointes < l.effectif)
      .sort((a, b) => b.seance.date.localeCompare(a.seance.date));
  });
  protected readonly aVenir = computed(() => this.lignes().filter((l) => l.seance.date > this.auj).sort((a, b) => a.seance.date.localeCompare(b.seance.date)).slice(0, 6));

  protected readonly optionsEnseignement = computed(() => this.ensCourants()
    .filter((e) => this.classeChoisie() === null || e.classeId === this.classeChoisie())
    .map((e) => ({ id: e.id, libelle: `${this.matieres().get(e.matiereId)?.nom ?? 'Matière'} · ${this.classes().get(e.classeId)?.nom ?? ''}` }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle)));

  constructor() { this.charger(); }

  private charger(): void {
    this.chargement.set(true);
    forkJoin({
      ens: this.http.get<Enseignement[]>(`${API_URL}/enseignements`),
      seances: this.http.get<Seance[]>(`${API_URL}/seances`),
      classes: this.http.get<Classe[]>(`${API_URL}/classes`),
      matieres: this.http.get<Matiere[]>(`${API_URL}/matieres`),
      etudiants: this.http.get<Etudiant[]>(`${API_URL}/etudiants`).pipe(catchError(() => of([] as Etudiant[]))),
      semestres: this.http.get<Semestre[]>(`${API_URL}/semestres`).pipe(catchError(() => of([] as Semestre[]))),
    }).subscribe({
      next: (r) => {
        const mesIds = new Set(r.ens.map((e) => e.id));
        this.enseignements.set(r.ens);
        this.seances.set(r.seances.filter((s) => mesIds.has(s.enseignementId)));
        this.classes.set(new Map(r.classes.map((c) => [c.id, c])));
        this.matieres.set(new Map(r.matieres.map((m) => [m.id, m])));
        const eff = new Map<number, number>();
        for (const e of r.etudiants) { if (e.classeId) { eff.set(e.classeId, (eff.get(e.classeId) ?? 0) + 1); } }
        this.effectifs.set(eff);
        this.semestreCourant.set(r.semestres.find((x) => (x.dateDebut ?? '') <= this.auj && (!x.dateFin || x.dateFin >= this.auj)) ?? null);
        this.chargement.set(false);
        this.chargerComptes();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  /** Nombre d'élèves déjà pointés pour les séances du jour et des 30 derniers jours. */
  private chargerComptes(): void {
    const limite = Appel.jourLocal(new Date(Date.now() - 30 * 86400000));
    const cibles = this.seances().filter((s) => s.date <= this.auj && s.date >= limite);
    if (!cibles.length) { return; }
    forkJoin(cibles.map((s) => this.http.get<unknown[]>(`${API_URL}/seances/${s.id}/presences`).pipe(
      map((l) => [s.id, l.length] as const), catchError(() => of([s.id, 0] as const)),
    ))).subscribe((res) => this.comptes.set(new Map(res)));
  }

  protected choisirClasse(id: number | null): void {
    this.classeChoisie.set(id);
    this.formulaire.controls.enseignementId.setValue(0);
  }

  protected ouvrir(l: LigneSeance): void { this.router.navigate(['/seances', l.seance.id]); }

  /** Crée la séance de maintenant puis ouvre directement sa feuille d'appel. */
  protected demarrer(): void {
    this.formulaire.markAllAsTouched();
    const v = this.formulaire.getRawValue();
    if (this.formulaire.invalid) { this.erreur.set('Choisissez l\'enseignement de la séance.'); return; }
    if (v.heureFin <= v.heureDebut) { this.erreur.set('L\'heure de fin doit suivre l\'heure de début.'); return; }
    this.creation.set(true);
    this.erreur.set('');
    this.http.post<Seance>(`${API_URL}/seances`, {
      date: this.auj, heureDebut: v.heureDebut.length === 5 ? v.heureDebut + ':00' : v.heureDebut,
      heureFin: v.heureFin.length === 5 ? v.heureFin + ':00' : v.heureFin, salle: v.salle.trim() || null, enseignementId: Number(v.enseignementId),
    }).subscribe({
      next: (s) => { this.creation.set(false); this.router.navigate(['/seances', s.id]); },
      error: (e: unknown) => { this.creation.set(false); this.erreur.set(Auth.message(e)); },
    });
  }

  protected etat(l: LigneSeance): { texte: string; classe: string } {
    if (l.pointes === null) { return { texte: '…', classe: 'gris' }; }
    if (l.pointes === 0) { return { texte: 'Appel à faire', classe: 'orange' }; }
    if (l.effectif && l.pointes < l.effectif) { return { texte: `Appel incomplet · ${l.pointes}/${l.effectif}`, classe: 'orange' }; }
    return { texte: `Appel fait · ${l.pointes}${l.effectif ? '/' + l.effectif : ''}`, classe: 'vert' };
  }

  protected horaire(s: Seance): string { return `${s.heureDebut.slice(0, 5).replace(':', ' h ')} – ${s.heureFin.slice(0, 5).replace(':', ' h ')}`; }

  private static jourLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private heure(decalageMinutes: number): string {
    const maintenant = new Date();
    const d = new Date(maintenant.getTime() + decalageMinutes * 60000);
    // Une séance ne déborde pas sur le lendemain.
    if (d.toDateString() !== maintenant.toDateString()) { return '23:59'; }
    d.setMinutes(Math.floor(d.getMinutes() / 15) * 15);
    return d.toTimeString().slice(0, 5);
  }
}
