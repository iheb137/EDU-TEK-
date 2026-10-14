import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { DonneesPedagogiques } from '../donnees';
import { Seance, heureCourte } from '../modeles';

type Fenetre = null | 'formulaire' | 'supprimer';

/** Liste filtrable des séances de cours, création, modification et suppression. */
@Component({
  selector: 'app-seances-liste',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal],
  templateUrl: './seances-liste.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/module.scss'],
})
export class SeancesListe {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly ref = inject(DonneesPedagogiques);
  protected readonly admin = this.ref.estAdmin;
  protected readonly date = dateFr;
  protected readonly heure = heureCourte;

  protected readonly seances = signal<Seance[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly semestre = signal<number | null>(null);
  protected readonly classe = signal<number | null>(null);
  protected readonly enseignement = signal<number | null>(null);
  protected readonly periode = signal<'toutes' | 'passees' | 'avenir'>('toutes');
  protected readonly numero = signal(0);
  protected readonly taille = 15;

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly cible = signal<Seance | null>(null);
  protected readonly erreurHoraire = signal(false);

  protected readonly formulaire = this.fb.nonNullable.group({
    enseignementId: [0, [Validators.required, Validators.min(1)]],
    date: ['', Validators.required],
    heureDebut: ['08:30', Validators.required],
    heureFin: ['10:00', Validators.required],
    salle: [''],
  });

  private readonly aujourdhui = new Date().toISOString().slice(0, 10);

  protected readonly enseignementsFiltre = computed(() => this.ref.enseignements()
    .filter((e) => (!this.semestre() || e.semestreId === this.semestre()) && (!this.classe() || e.classeId === this.classe()))
    .sort((a, b) => this.ref.libelleEnseignement(a.id).localeCompare(this.ref.libelleEnseignement(b.id))));
  protected readonly groupesFormulaire = computed(() => this.ref.semestres().map((s) => ({
    semestre: s, enseignements: this.ref.enseignements().filter((e) => e.semestreId === s.id)
      .sort((a, b) => this.ref.libelleEnseignement(a.id).localeCompare(this.ref.libelleEnseignement(b.id))),
  })).filter((g) => g.enseignements.length));

  protected readonly filtrees = computed(() => {
    const parId = this.ref.enseignementsParId();
    const p = this.periode();
    return (this.seances() ?? []).filter((s) => {
      const e = parId.get(s.enseignementId);
      if (!e) { return false; }
      if (p === 'passees' && s.date > this.aujourdhui) { return false; }
      if (p === 'avenir' && s.date < this.aujourdhui) { return false; }
      return (!this.semestre() || e.semestreId === this.semestre()) && (!this.classe() || e.classeId === this.classe())
        && (!this.enseignement() || e.id === this.enseignement());
    }).sort((a, b) => b.date.localeCompare(a.date) || b.heureDebut.localeCompare(a.heureDebut));
  });
  protected readonly pageCourante = computed(() => this.filtrees().slice(this.numero() * this.taille, (this.numero() + 1) * this.taille));
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.filtrees().length / this.taille)));

  private minuteurInfo: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    const num = (k: string) => (q.get(k) ? Number(q.get(k)) : null);
    this.ref.assurer().subscribe({
      next: () => {
        this.semestre.set(q.has('semestre') ? num('semestre') : this.ref.semestreCourant());
        this.classe.set(num('classe'));
        this.enseignement.set(num('enseignement'));
        this.charger();
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<Seance[]>(`${API_URL}/seances`).subscribe({
      next: (l) => { this.seances.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected filtrer(champ: 'semestre' | 'classe' | 'enseignement' | 'periode', valeur: string): void {
    const v = valeur ? Number(valeur) : null;
    if (champ === 'semestre') { this.semestre.set(v); this.enseignement.set(null); }
    if (champ === 'classe') { this.classe.set(v); this.enseignement.set(null); }
    if (champ === 'enseignement') { this.enseignement.set(v); }
    if (champ === 'periode') { this.periode.set(valeur as 'toutes' | 'passees' | 'avenir'); }
    this.numero.set(0);
    this.router.navigate([], { queryParams: { semestre: this.semestre() ?? '', classe: this.classe() ?? undefined, enseignement: this.enseignement() ?? undefined }, replaceUrl: true });
  }
  protected aller(delta: number): void { this.numero.update((n) => n + delta); }

  protected ouvrirCreation(): void {
    this.cible.set(null);
    const ens = this.enseignement() ?? this.enseignementsFiltre()[0]?.id ?? 0;
    this.formulaire.reset({ enseignementId: ens, date: this.aujourdhui, heureDebut: '08:30', heureFin: '10:00', salle: '' });
    this.formulaire.controls.enseignementId.enable();
    this.erreurFenetre.set(''); this.erreurHoraire.set(false);
    this.fenetre.set('formulaire');
  }

  protected ouvrirModification(s: Seance): void {
    this.cible.set(s);
    this.formulaire.reset({ enseignementId: s.enseignementId, date: s.date, heureDebut: heureCourte(s.heureDebut), heureFin: heureCourte(s.heureFin), salle: s.salle ?? '' });
    this.formulaire.controls.enseignementId.disable();
    this.erreurFenetre.set(''); this.erreurHoraire.set(false);
    this.fenetre.set('formulaire');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    const v = this.formulaire.getRawValue();
    this.erreurHoraire.set(!!v.heureDebut && !!v.heureFin && v.heureFin <= v.heureDebut);
    if (this.formulaire.invalid || this.erreurHoraire()) { return; }
    const sec = (h: string) => (h.length === 5 ? h + ':00' : h);
    const corps = { enseignementId: Number(v.enseignementId), date: v.date, heureDebut: sec(v.heureDebut), heureFin: sec(v.heureFin), salle: v.salle.trim() || null };
    const c = this.cible();
    const req = c ? this.http.put<Seance>(`${API_URL}/seances/${c.id}`, { ...corps, id: c.id }) : this.http.post<Seance>(`${API_URL}/seances`, corps);
    this.enCours.set(true);
    this.erreurFenetre.set('');
    req.subscribe({
      next: (s) => {
        this.enCours.set(false); this.fermer();
        this.confirmer(c ? 'Séance modifiée.' : `Séance créée le ${dateFr(s.date)} · ${this.ref.libelleEnseignement(s.enseignementId)}.`);
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected demanderSuppression(s: Seance): void { this.cible.set(s); this.erreurFenetre.set(''); this.fenetre.set('supprimer'); }
  protected supprimer(): void {
    const s = this.cible();
    if (!s) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/seances/${s.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.seances.update((l) => (l ?? []).filter((x) => x.id !== s.id)); this.confirmer('Séance supprimée.'); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void {
    this.info.set(m);
    clearTimeout(this.minuteurInfo);
    this.minuteurInfo = setTimeout(() => this.info.set(''), 4000);
  }
}
