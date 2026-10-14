import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { API_URL } from '../../../core/config';
import { dateFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { PageReferentiel, indexer, messageErreur, normaliser, parNom } from '../commun/base';
import { Confirmation } from '../commun/confirmation';
import { Etudiant, Formation, Inscription, STATUTS_INSCRIPTION, statutInscription } from '../commun/modeles';

const TAILLE = 15;

/** Inscriptions des étudiants aux formations : liste filtrable, création, changement de statut, suppression. */
@Component({
  selector: 'app-inscriptions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, Modal, Confirmation],
  templateUrl: './inscriptions.html',
  styleUrls: ['../../../shared/ui.scss', '../commun/referentiel.scss'],
})
export class Inscriptions extends PageReferentiel<'editer' | 'supprimer'> {
  protected readonly inscriptions = signal<Inscription[]>([]);
  protected readonly etudiants = signal<Etudiant[]>([]);
  protected readonly formations = signal<Formation[]>([]);
  protected readonly recherche = signal('');
  protected readonly filtreFormation = signal<number | null>(null);
  protected readonly filtreStatut = signal('');
  protected readonly numero = signal(0);
  protected readonly cible = signal<Inscription | null>(null);
  protected readonly statuts = STATUTS_INSCRIPTION;
  protected readonly statut = statutInscription;
  protected readonly date = dateFr;

  protected readonly formationsTriees = computed(() => parNom(this.formations(), (f) => f.code));
  protected readonly etudiantsTries = computed(() => parNom(this.etudiants(), (e) => `${e.nom} ${e.prenom}`));

  private readonly filtres = computed(() => {
    const es = indexer(this.etudiants()); const fs = indexer(this.formations());
    const q = normaliser(this.recherche().trim());
    const f = this.filtreFormation(); const s = this.filtreStatut();
    return this.inscriptions()
      .map((i) => ({ ...i, etudiant: es.get(i.etudiantId), formation: fs.get(i.formationId) }))
      .filter((i) => (!f || i.formationId === f) && (!s || i.statut === s)
        && (!q || normaliser(`${i.etudiant?.nom} ${i.etudiant?.prenom} ${i.etudiant?.prenom} ${i.etudiant?.nom} ${i.etudiant?.matricule}`).includes(q)))
      .sort((a, b) => `${a.etudiant?.nom} ${a.etudiant?.prenom}`.localeCompare(`${b.etudiant?.nom} ${b.etudiant?.prenom}`, 'fr'));
  });
  protected readonly total = computed(() => this.filtres().length);
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / TAILLE)));
  protected readonly lignes = computed(() => this.filtres().slice(this.numero() * TAILLE, (this.numero() + 1) * TAILLE));

  protected readonly formulaire = this.fb.group({
    etudiantId: this.fb.control<number | null>(null, Validators.required),
    formationId: this.fb.control<number | null>(null, Validators.required),
    statut: this.fb.nonNullable.control('ACTIVE', Validators.required),
    dateInscription: this.fb.nonNullable.control(''),
  });

  constructor() { super(); this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    forkJoin({
      i: this.http.get<Inscription[]>(`${API_URL}/inscriptions`),
      e: this.http.get<Etudiant[]>(`${API_URL}/etudiants`),
      f: this.http.get<Formation[]>(`${API_URL}/formations`),
    }).subscribe({
      next: (r) => {
        this.inscriptions.set(r.i); this.etudiants.set(r.e); this.formations.set(r.f);
        this.erreur.set(''); this.chargement.set(false);
        if (this.numero() >= this.pages()) { this.numero.set(this.pages() - 1); }
      },
      error: (e: unknown) => { this.erreur.set(messageErreur(e)); this.chargement.set(false); },
    });
  }

  protected chercher(v: string): void { this.recherche.set(v); this.numero.set(0); }
  protected filtrerFormation(v: string): void { this.filtreFormation.set(Number(v) || null); this.numero.set(0); }
  protected filtrerStatut(v: string): void { this.filtreStatut.set(v); this.numero.set(0); }
  protected aller(delta: number): void { this.numero.update((n) => n + delta); }

  protected nouvelle(): void {
    this.cible.set(null);
    const f = this.filtreFormation() ?? (this.formations().length === 1 ? this.formations()[0].id : null);
    this.formulaire.reset({ etudiantId: null, formationId: f, statut: 'ACTIVE', dateInscription: new Date().toISOString().slice(0, 10) });
    this.formulaire.controls.etudiantId.enable();
    this.formulaire.controls.formationId.enable();
    this.ouvrir('editer');
  }

  protected modifier(i: Inscription): void {
    this.cible.set(i);
    this.formulaire.reset({ etudiantId: i.etudiantId, formationId: i.formationId, statut: i.statut ?? 'ACTIVE', dateInscription: i.dateInscription ?? '' });
    // L'API refuse de changer l'étudiant ou la formation d'une inscription existante.
    this.formulaire.controls.etudiantId.disable();
    this.formulaire.controls.formationId.disable();
    this.ouvrir('editer');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const c = this.cible();
    const corps = { etudiantId: v.etudiantId, formationId: v.formationId, statut: v.statut, dateInscription: v.dateInscription || null };
    const req = c
      ? this.http.put<Inscription>(`${API_URL}/inscriptions/${c.id}`, { id: c.id, ...corps })
      : this.http.post<Inscription>(`${API_URL}/inscriptions`, corps);
    this.envoyer(req, () => {
      const e = this.etudiants().find((x) => x.id === v.etudiantId);
      this.fermer();
      this.confirmer(`${c ? 'Inscription modifiée' : 'Inscription enregistrée'} : ${e ? e.prenom + ' ' + e.nom : ''}`);
      this.charger();
    });
  }

  protected demanderSuppression(i: Inscription): void { this.cible.set(i); this.ouvrir('supprimer'); }

  protected messageSuppression(): string {
    const i = this.cible();
    const e = this.etudiants().find((x) => x.id === i?.etudiantId);
    const f = this.formations().find((x) => x.id === i?.formationId);
    return `Supprimer l'inscription de ${e ? e.prenom + ' ' + e.nom : 'cet étudiant'} à la formation ${f?.code ?? ''} ?`;
  }

  protected supprimer(): void {
    const i = this.cible();
    if (!i) { return; }
    this.envoyer(this.http.delete(`${API_URL}/inscriptions/${i.id}`), () => {
      this.fermer();
      this.confirmer('Inscription supprimée.');
      this.charger();
    });
  }
}
