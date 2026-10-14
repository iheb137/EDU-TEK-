import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import {
  EnseignementSupports, FORMATS_ACCEPTES, SupportCours, TAILLE_MAX_MO, formatFichier, grouperParChapitre,
  messageErreurBlob, tailleFr, telechargerSupport,
} from './supports-modeles';

type Fenetre = null | 'fichier' | 'lien' | 'modifier' | 'supprimer';
const URL_VALIDE = /^https?:\/\/\S+$/i;

/** Supports de cours d'un enseignement : dépôt de fichiers, liens, chapitres, visibilité. */
@Component({
  selector: 'app-supports-cours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Modal],
  templateUrl: './supports-cours.html',
  styleUrls: ['../../../shared/ui.scss', '../enseignant.scss', './supports-cours.scss'],
})
export class SupportsCours {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly peutEcrire = this.auth.a('ENSEIGNANT') || this.auth.a('ADMIN_PEDAGOGIQUE');
  protected readonly admin = this.auth.a('ADMIN_PEDAGOGIQUE') || this.auth.a('SUPERADMIN');
  protected readonly formats = FORMATS_ACCEPTES;
  protected readonly tailleMax = TAILLE_MAX_MO;
  protected readonly quand = dateHeureFr;
  protected readonly taille = tailleFr;
  protected readonly format = formatFichier;

  protected readonly enseignements = signal<EnseignementSupports[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly recherche = signal('');
  protected readonly selection = signal<number | null>(null);

  protected readonly supports = signal<SupportCours[]>([]);
  protected readonly chargementSupports = signal(false);
  protected readonly telechargement = signal<number | null>(null);

  // Boîtes de dialogue
  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly cible = signal<SupportCours | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly essai = signal(false);
  protected readonly fichier = signal<File | null>(null);
  protected readonly titre = signal('');
  protected readonly chapitre = signal('');
  protected readonly url = signal('');
  protected readonly visible = signal(true);

  protected readonly filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.enseignements().filter((e) => !q || `${e.matiereNom} ${e.matiereCode} ${e.classeNom} ${e.enseignantNom}`.toLowerCase().includes(q));
  });
  protected readonly courant = computed(() => this.enseignements().find((e) => e.enseignementId === this.selection()) ?? null);
  protected readonly groupes = computed(() => grouperParChapitre(this.supports()));
  protected readonly chapitres = computed(() => [...new Set(this.supports().map((s) => s.chapitre?.trim()).filter((c): c is string => !!c))]);

  // Validation des formulaires
  protected readonly erreurTitre = computed(() => !this.titre().trim() ? 'Le titre est obligatoire.' : this.titre().length > 200 ? '200 caractères maximum.' : '');
  protected readonly erreurFichier = computed(() => {
    const f = this.fichier();
    if (!f) { return 'Choisissez un fichier.'; }
    if (f.size > TAILLE_MAX_MO * 1024 * 1024) { return `Fichier trop volumineux : ${TAILLE_MAX_MO} Mo maximum.`; }
    const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
    return FORMATS_ACCEPTES.split(',').includes(ext) ? '' : 'Format non accepté.';
  });
  protected readonly erreurUrl = computed(() => URL_VALIDE.test(this.url().trim()) ? '' : 'Saisissez une adresse complète commençant par http:// ou https://.');

  constructor() {
    const id = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('enseignement'));
    this.http.get<EnseignementSupports[]>(`${API_URL}/supports/enseignements`).subscribe({
      next: (l) => {
        // Semestre le plus récent d'abord, puis par matière.
        const tries = [...l].sort((a, b) => b.semestreId - a.semestreId || a.matiereNom.localeCompare(b.matiereNom, 'fr'));
        this.enseignements.set(tries);
        this.chargement.set(false);
        const initial = tries.find((e) => e.enseignementId === id) ?? tries[0];
        if (initial) { this.choisir(initial.enseignementId, false); }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected choisir(id: number, memoriser = true): void {
    this.selection.set(id);
    if (memoriser) { this.router.navigate([], { queryParams: { enseignement: id }, replaceUrl: true }); }
    this.chargerSupports();
  }

  private chargerSupports(): void {
    const id = this.selection();
    if (!id) { return; }
    this.chargementSupports.set(true);
    this.http.get<SupportCours[]>(`${API_URL}/enseignements/${id}/supports`).subscribe({
      next: (l) => {
        this.supports.set(l);
        this.chargementSupports.set(false);
        // Met à jour les compteurs de la liste de gauche.
        this.enseignements.update((ens) => ens.map((e) => e.enseignementId === id
          ? { ...e, supports: l.length, visibles: l.filter((s) => s.visible).length } : e));
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargementSupports.set(false); },
    });
  }

  // ── Boîtes de dialogue ───────────────────────────────────────────────────
  protected ouvrir(f: Exclude<Fenetre, null>, s: SupportCours | null = null): void {
    this.cible.set(s);
    this.erreurFenetre.set('');
    this.essai.set(false);
    this.fichier.set(null);
    this.titre.set(s?.titre ?? '');
    this.chapitre.set(s?.chapitre ?? '');
    this.url.set(s?.url ?? '');
    this.visible.set(s?.visible ?? true);
    this.fenetre.set(f);
  }

  protected choisirFichier(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.fichier.set(f);
    // Titre proposé d'après le nom du fichier, modifiable.
    if (f && !this.titre().trim()) { this.titre.set(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()); }
  }

  protected deposerFichier(): void {
    this.essai.set(true);
    const id = this.selection();
    const f = this.fichier();
    if (!id || !f || this.erreurFichier() || this.erreurTitre()) { return; }
    const donnees = new FormData();
    donnees.append('fichier', f);
    donnees.append('titre', this.titre().trim());
    if (this.chapitre().trim()) { donnees.append('chapitre', this.chapitre().trim()); }
    donnees.append('visible', String(this.visible()));
    this.envoyer(this.http.post<SupportCours>(`${API_URL}/enseignements/${id}/supports`, donnees),
      this.visible() ? `« ${this.titre().trim()} » est en ligne : les étudiants de la classe sont prévenus.` : `« ${this.titre().trim()} » est déposé (masqué aux étudiants).`);
  }

  protected ajouterLien(): void {
    this.essai.set(true);
    const id = this.selection();
    if (!id || this.erreurTitre() || this.erreurUrl()) { return; }
    this.envoyer(this.http.post<SupportCours>(`${API_URL}/enseignements/${id}/supports/lien`, this.corps()),
      `Lien « ${this.titre().trim()} » ajouté.`);
  }

  protected modifier(): void {
    this.essai.set(true);
    const s = this.cible();
    if (!s || this.erreurTitre() || (s.nature === 'LIEN' && this.erreurUrl())) { return; }
    this.envoyer(this.http.put<SupportCours>(`${API_URL}/enseignements/${s.enseignementId}/supports/${s.id}`, this.corps()),
      `« ${this.titre().trim()} » modifié.`);
  }

  protected supprimer(): void {
    const s = this.cible();
    if (!s) { return; }
    this.envoyer(this.http.delete<void>(`${API_URL}/enseignements/${s.enseignementId}/supports/${s.id}`), `« ${s.titre} » supprimé.`);
  }

  /** Bascule masqué / visible directement depuis la liste. */
  protected basculer(s: SupportCours): void {
    this.erreur.set('');
    this.http.put<SupportCours>(`${API_URL}/enseignements/${s.enseignementId}/supports/${s.id}`,
      { titre: s.titre, chapitre: s.chapitre ?? null, url: s.url ?? null, visible: !s.visible }).subscribe({
      next: () => { this.confirmer(s.visible ? `« ${s.titre} » est masqué aux étudiants.` : `« ${s.titre} » est visible des étudiants.`); this.chargerSupports(); },
      error: (e: unknown) => this.erreur.set(Auth.message(e)),
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

  private corps() {
    return { titre: this.titre().trim(), chapitre: this.chapitre().trim() || null, url: this.url().trim() || null, visible: this.visible() };
  }

  private envoyer(requete: import('rxjs').Observable<unknown>, message: string): void {
    this.enCours.set(true);
    this.erreurFenetre.set('');
    requete.subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(message); this.chargerSupports(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private minuteur: ReturnType<typeof setTimeout> | undefined;
  private confirmer(m: string): void { clearTimeout(this.minuteur); this.info.set(m); this.minuteur = setTimeout(() => this.info.set(''), 4000); }
}
