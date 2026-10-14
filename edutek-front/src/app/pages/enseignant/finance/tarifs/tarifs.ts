import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { Auth } from '../../../../core/auth';
import { API_URL } from '../../../../core/config';
import { dateFr } from '../../../../shared/format';
import { Icon } from '../../../../shared/icon/icon';
import { Modal } from '../../../../shared/modal/modal';
import { EnseignantRef, Tarif, aujourdhui, montantFr } from '../../modeles';

/** Normalise un grade pour la comparaison (comme le serveur : casse et espaces ignorés). */
const cle = (g?: string | null) => (g ?? '').trim().toLowerCase().replace(/\s+/g, ' ') || null;

/** Tarifs horaires des enseignants : tarif général et tarifs par grade, chacun avec une date d'effet. */
@Component({
  selector: 'app-tarifs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './tarifs.html',
  styleUrls: ['../../../../shared/ui.scss', '../../enseignant.scss'],
})
export class Tarifs {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  protected readonly peutModifier = inject(Auth).a('ADMIN_FINANCIER');
  protected readonly dateFr = dateFr;
  protected readonly montantFr = montantFr;

  protected readonly liste = signal<Tarif[]>([]);
  protected readonly grades = signal<string[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly fenetre = signal<null | 'creer' | 'supprimer'>(null);
  protected readonly cible = signal<Tarif | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  protected readonly formulaire = this.fb.nonNullable.group({
    montant: [null as number | null, [Validators.required, Validators.min(0.001), Validators.max(100000)]],
    dateDebut: [aujourdhui(), Validators.required],
    grade: ['', Validators.maxLength(100)],
  });

  /** Tarifs en vigueur aujourd'hui : le plus récent déjà entré en vigueur, par grade. */
  protected readonly enVigueur = computed(() => {
    const jour = aujourdhui();
    const ids = new Set<number>();
    const meilleur = new Map<string, Tarif>();
    for (const t of this.liste()) {
      if (t.dateDebut > jour) { continue; }
      const k = cle(t.grade) ?? '';
      const m = meilleur.get(k);
      if (!m || t.dateDebut > m.dateDebut) { meilleur.set(k, t); }
    }
    meilleur.forEach((t) => ids.add(t.id));
    return ids;
  });
  protected readonly general = computed(() => this.liste().find((t) => !cle(t.grade) && this.enVigueur().has(t.id)) ?? null);
  /** Grades d'enseignants sans tarif spécifique en vigueur (ils relèvent du tarif général). */
  protected readonly gradesSansTarif = computed(() => {
    const couverts = new Set(this.liste().filter((t) => this.enVigueur().has(t.id)).map((t) => cle(t.grade)));
    return this.grades().filter((g) => !couverts.has(cle(g)));
  });

  constructor() {
    this.charger();
    this.http.get<EnseignantRef[]>(`${API_URL}/enseignants`).pipe(catchError(() => of([] as EnseignantRef[]))).subscribe((l) => {
      const vus = new Map<string, string>();
      l.forEach((e) => { const k = cle(e.grade); if (k && !vus.has(k)) { vus.set(k, e.grade!.trim()); } });
      this.grades.set([...vus.values()].sort((a, b) => a.localeCompare(b, 'fr')));
    });
  }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<Tarif[]>(`${API_URL}/tarifs`).subscribe({
      next: (l) => { this.liste.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected statut(t: Tarif): { libelle: string; classe: string } {
    if (this.enVigueur().has(t.id)) { return { libelle: 'En vigueur', classe: 'vert' }; }
    if (t.dateDebut > aujourdhui()) { return { libelle: 'À venir', classe: '' }; }
    return { libelle: 'Remplacé', classe: 'gris' };
  }

  protected ouvrirCreation(grade = ''): void {
    this.formulaire.reset({ montant: null, dateDebut: aujourdhui(), grade });
    this.erreurFenetre.set('');
    this.fenetre.set('creer');
  }

  protected creer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const montant = Math.round(Number(v.montant) * 1000) / 1000;
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<Tarif>(`${API_URL}/tarifs`, { montant, dateDebut: v.dateDebut, grade: v.grade.trim() || null }).subscribe({
      next: (t) => {
        this.enCours.set(false);
        this.fermer();
        this.confirmer(`Tarif de ${montantFr(t.montant)} de l'heure enregistré${t.grade ? ' pour le grade « ' + t.grade + ' »' : ' (tarif général)'}, applicable à partir du ${dateFr(t.dateDebut)}.`);
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected demanderSuppression(t: Tarif): void { this.cible.set(t); this.erreurFenetre.set(''); this.fenetre.set('supprimer'); }

  protected supprimer(): void {
    const t = this.cible();
    if (!t) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/tarifs/${t.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer('Tarif supprimé.'); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
