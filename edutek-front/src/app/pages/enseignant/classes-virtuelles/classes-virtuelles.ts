import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { ContexteEnseignant } from '../contexte';
import { ClasseVirtuelle, EnseignementVue, PLATEFORMES, Support, TYPES_SUPPORT, libellePlateforme, libelleSupport, versChampDateHeure } from '../modeles';

const URL_HTTP = /^https?:\/\/\S+$/;
type Filtre = 'avenir' | 'passees' | 'toutes';

/** Refuse une date/heure passée (champ datetime-local). */
function dansLeFutur(c: AbstractControl): ValidationErrors | null {
  const v = c.value as string;
  if (!v) { return null; }
  return new Date(v).getTime() > Date.now() ? null : { passe: true };
}

/** Classes virtuelles de l'enseignant : planification, liens de connexion et supports de cours. */
@Component({
  selector: 'app-classes-virtuelles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './classes-virtuelles.html',
  styleUrls: ['../../../shared/ui.scss', '../enseignant.scss', './classes-virtuelles.scss'],
})
export class ClassesVirtuelles {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly contexte = inject(ContexteEnseignant);
  protected readonly admin = this.contexte.estAdminPedagogie();
  protected readonly plateformes = PLATEFORMES;
  protected readonly typesSupport = TYPES_SUPPORT;
  protected readonly libellePlateforme = libellePlateforme;
  protected readonly libelleSupport = libelleSupport;
  protected readonly dateHeureFr = dateHeureFr;
  protected readonly dateFr = dateFr;

  protected readonly liste = signal<ClasseVirtuelle[]>([]);
  protected readonly enseignements = signal<EnseignementVue[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly filtre = signal<Filtre>('avenir');
  protected readonly maintenant = signal(Date.now());

  protected readonly fenetre = signal<null | 'form' | 'supprimer' | 'supports'>(null);
  protected readonly cible = signal<ClasseVirtuelle | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  // Supports de la classe virtuelle ouverte
  protected readonly supports = signal<Support[]>([]);
  protected readonly chargementSupports = signal(false);
  protected readonly supportEdite = signal<Support | null>(null);
  protected readonly supportASupprimer = signal<Support | null>(null);
  protected readonly infoSupports = signal('');

  protected readonly formulaire = this.fb.nonNullable.group({
    enseignementId: [0, [Validators.required, Validators.min(1)]],
    plateforme: ['GOOGLE_MEET', Validators.required],
    lien: ['', [Validators.required, Validators.pattern(URL_HTTP), Validators.maxLength(255)]],
    codeAcces: ['', Validators.maxLength(255)],
    dateHeure: ['', [Validators.required, dansLeFutur]],
  });
  protected readonly formSupport = this.fb.nonNullable.group({
    titre: ['', [Validators.required, Validators.maxLength(255)]],
    type: ['PDF', Validators.required],
    url: ['', [Validators.required, Validators.pattern(URL_HTTP), Validators.maxLength(255)]],
  });
  private dateInitiale = '';

  protected readonly visibles = computed(() => {
    const t = this.maintenant();
    const l = this.liste();
    if (this.filtre() === 'avenir') { return l.filter((c) => new Date(c.dateHeure).getTime() >= t).sort((a, b) => a.dateHeure.localeCompare(b.dateHeure)); }
    if (this.filtre() === 'passees') { return l.filter((c) => new Date(c.dateHeure).getTime() < t); }
    return l;
  });
  protected readonly nbAvenir = computed(() => this.liste().filter((c) => new Date(c.dateHeure).getTime() >= this.maintenant()).length);

  constructor() {
    this.charger();
    this.contexte.enseignements().subscribe({ next: (l) => this.enseignements.set(l), error: () => { /* l'erreur principale est affichée par charger() */ } });
    if (inject(ActivatedRoute).snapshot.queryParamMap.get('creer')) { this.ouvrirCreation(); }
  }

  protected charger(): void {
    this.chargement.set(true);
    this.http.get<ClasseVirtuelle[]>(`${API_URL}/classes-virtuelles`).subscribe({
      next: (l) => { this.liste.set(l); this.maintenant.set(Date.now()); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected filtrer(v: string): void { this.filtre.set(v as Filtre); }

  // ── Création / modification ─────────────────────────────────────────────
  protected ouvrirCreation(): void {
    this.cible.set(null);
    const demain = new Date(Date.now() + 24 * 3600 * 1000);
    demain.setHours(10, 0, 0, 0);
    const local = new Date(demain.getTime() - demain.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.formulaire.reset({ enseignementId: 0, plateforme: 'GOOGLE_MEET', lien: '', codeAcces: '', dateHeure: local });
    this.formulaire.controls.enseignementId.enable();
    this.dateInitiale = '';
    this.formulaire.controls.dateHeure.setValidators([Validators.required, dansLeFutur]);
    this.formulaire.controls.dateHeure.updateValueAndValidity();
    this.erreurFenetre.set('');
    this.fenetre.set('form');
  }

  protected ouvrirModification(c: ClasseVirtuelle): void {
    this.cible.set(c);
    this.dateInitiale = versChampDateHeure(c.dateHeure);
    this.formulaire.reset({ enseignementId: c.enseignementId, plateforme: c.plateforme, lien: c.lien, codeAcces: c.codeAcces ?? '', dateHeure: this.dateInitiale });
    this.formulaire.controls.enseignementId.disable();
    // Une date inchangée n'a pas à être dans le futur (règle du serveur).
    this.formulaire.controls.dateHeure.setValidators([Validators.required, (x: AbstractControl) => (x.value === this.dateInitiale ? null : dansLeFutur(x))]);
    this.formulaire.controls.dateHeure.updateValueAndValidity();
    this.erreurFenetre.set('');
    this.fenetre.set('form');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const c = this.cible();
    const corps = {
      enseignementId: Number(v.enseignementId), plateforme: v.plateforme, lien: v.lien.trim(),
      codeAcces: v.codeAcces.trim() || null,
      dateHeure: v.dateHeure === this.dateInitiale && c ? c.dateHeure : `${v.dateHeure}:00`,
    };
    this.enCours.set(true);
    this.erreurFenetre.set('');
    const req = c ? this.http.put<ClasseVirtuelle>(`${API_URL}/classes-virtuelles/${c.id}`, corps) : this.http.post<ClasseVirtuelle>(`${API_URL}/classes-virtuelles`, corps);
    req.subscribe({
      next: (r) => {
        this.enCours.set(false);
        this.fermer();
        this.confirmer(c ? 'Classe virtuelle modifiée.' : `Classe virtuelle planifiée le ${dateHeureFr(r.dateHeure)}.`);
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Suppression ─────────────────────────────────────────────────────────
  protected demanderSuppression(c: ClasseVirtuelle): void { this.cible.set(c); this.erreurFenetre.set(''); this.fenetre.set('supprimer'); }

  protected supprimer(): void {
    const c = this.cible();
    if (!c) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/classes-virtuelles/${c.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer('Classe virtuelle supprimée.'); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Supports de cours ───────────────────────────────────────────────────
  protected ouvrirSupports(c: ClasseVirtuelle): void {
    this.cible.set(c);
    this.supports.set([]);
    this.annulerSupport();
    this.supportASupprimer.set(null);
    this.erreurFenetre.set('');
    this.infoSupports.set('');
    this.fenetre.set('supports');
    this.chargerSupports();
  }

  private chargerSupports(): void {
    const c = this.cible();
    if (!c) { return; }
    this.chargementSupports.set(true);
    this.http.get<Support[]>(`${API_URL}/classes-virtuelles/${c.id}/supports`).subscribe({
      next: (l) => { this.supports.set(l); this.chargementSupports.set(false); },
      error: (e: unknown) => { this.erreurFenetre.set(Auth.message(e)); this.chargementSupports.set(false); },
    });
  }

  protected modifierSupport(s: Support): void {
    this.supportASupprimer.set(null);
    this.supportEdite.set(s);
    this.formSupport.reset({ titre: s.titre, type: s.type, url: s.url });
  }
  protected annulerSupport(): void { this.supportEdite.set(null); this.formSupport.reset({ titre: '', type: 'PDF', url: '' }); }

  protected enregistrerSupport(): void {
    this.formSupport.markAllAsTouched();
    const c = this.cible();
    if (this.formSupport.invalid || !c) { return; }
    const v = this.formSupport.getRawValue();
    const corps = { titre: v.titre.trim(), type: v.type, url: v.url.trim() };
    const s = this.supportEdite();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    const req = s ? this.http.put(`${API_URL}/classes-virtuelles/${c.id}/supports/${s.id}`, corps) : this.http.post(`${API_URL}/classes-virtuelles/${c.id}/supports`, corps);
    req.subscribe({
      next: () => { this.enCours.set(false); this.annoncer(s ? 'Support modifié.' : 'Support ajouté.'); this.annulerSupport(); this.chargerSupports(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected supprimerSupport(): void {
    const c = this.cible();
    const s = this.supportASupprimer();
    if (!c || !s) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/classes-virtuelles/${c.id}/supports/${s.id}`).subscribe({
      next: () => { this.enCours.set(false); this.supportASupprimer.set(null); if (this.supportEdite()?.id === s.id) { this.annulerSupport(); } this.annoncer('Support supprimé.'); this.chargerSupports(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Divers ──────────────────────────────────────────────────────────────
  protected estPassee(c: ClasseVirtuelle): boolean { return new Date(c.dateHeure).getTime() < this.maintenant(); }
  protected libelleEnseignement(c: ClasseVirtuelle): string {
    return c.matiereNom ? `${c.matiereNom} · ${c.classeNom ?? ''}` : (this.enseignements().find((e) => e.id === c.enseignementId)?.libelle ?? `Enseignement ${c.enseignementId}`);
  }
  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
  private annoncer(m: string): void { this.infoSupports.set(m); setTimeout(() => this.infoSupports.set(''), 4000); }
}
