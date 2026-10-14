import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { Page } from '../../../core/modeles';
import { dateFr, dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Actualite, ActualiteRequete } from '../modeles';

type Fenetre = null | 'editer' | 'supprimer';
const LONG = 420;

/** Fil des actualités de l'établissement ; publication et modification par l'administration communication. */
@Component({
  selector: 'app-actualites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './actualites.html',
  styleUrls: ['../../../shared/ui.scss', './actualites.scss'],
})
export class Actualites {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);

  protected readonly peutPublier = this.auth.a('ADMIN_COMMUNICATION');
  protected readonly peutSupprimer = this.auth.a('ADMIN_COMMUNICATION', 'SUPERADMIN');

  protected readonly donnees = signal<Page<Actualite> | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly recherche = signal('');
  protected readonly numero = signal(0);
  protected readonly taille = 8;
  protected readonly deplies = signal<ReadonlySet<number>>(new Set());

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly cible = signal<Actualite | null>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected notifier = true;

  protected readonly formulaire = this.fb.nonNullable.group({
    titre: ['', [Validators.required, Validators.maxLength(200)]],
    contenu: ['', [Validators.required, Validators.maxLength(10000)]],
    lienDocument: ['', [Validators.pattern(/^https?:\/\/\S+$/i), Validators.maxLength(500)]],
  });

  protected readonly date = dateFr;
  protected readonly dateHeure = dateHeureFr;
  private minuteur: ReturnType<typeof setTimeout> | undefined;

  constructor() { this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    let p = new HttpParams().set('page', this.numero()).set('size', this.taille);
    if (this.recherche().trim()) { p = p.set('q', this.recherche().trim()); }
    this.http.get<Page<Actualite>>(`${API_URL}/actualites`, { params: p }).subscribe({
      next: (d) => { this.donnees.set(d); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected chercher(v: string): void {
    this.recherche.set(v);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => { this.numero.set(0); this.charger(); }, 350);
  }

  protected aller(d: number): void { this.numero.update((n) => n + d); this.charger(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  protected estLong(a: Actualite): boolean { return (a.contenu ?? '').length > LONG || (a.contenu ?? '').split('\n').length > 7; }
  protected deplie(a: Actualite): boolean { return this.deplies().has(a.id); }
  protected basculer(a: Actualite): void {
    this.deplies.update((s) => { const n = new Set(s); if (n.has(a.id)) { n.delete(a.id); } else { n.add(a.id); } return n; });
  }
  protected lienSur(l?: string | null): boolean { return !!l && /^https?:\/\//i.test(l); }

  // ── Publication / modification ──────────────────────────────────────────
  protected ouvrirPublication(): void {
    this.cible.set(null);
    this.formulaire.reset({ titre: '', contenu: '', lienDocument: '' });
    this.notifier = true;
    this.erreurFenetre.set('');
    this.fenetre.set('editer');
  }

  protected ouvrirModification(a: Actualite): void {
    this.cible.set(a);
    this.formulaire.reset({ titre: a.titre, contenu: a.contenu, lienDocument: a.lienDocument ?? '' });
    this.erreurFenetre.set('');
    this.fenetre.set('editer');
  }

  protected enregistrer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const v = this.formulaire.getRawValue();
    const corps: ActualiteRequete = { titre: v.titre.trim(), contenu: v.contenu.trim(), lienDocument: v.lienDocument.trim() || undefined };
    if (!corps.titre || !corps.contenu) { this.erreurFenetre.set('Le titre et le contenu ne peuvent pas être vides.'); return; }
    const a = this.cible();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    const requete = a
      ? this.http.put<Actualite>(`${API_URL}/actualites/${a.id}`, corps)
      : this.http.post<Actualite>(`${API_URL}/actualites`, corps, { params: new HttpParams().set('notifier', this.notifier) });
    requete.subscribe({
      next: () => {
        this.enCours.set(false);
        this.fenetre.set(null);
        this.confirmer(a ? 'Actualité modifiée.' : this.notifier ? 'Actualité publiée. Les utilisateurs ont été notifiés.' : 'Actualité publiée.');
        if (!a) { this.numero.set(0); }
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Suppression ─────────────────────────────────────────────────────────
  protected demanderSuppression(a: Actualite): void { this.cible.set(a); this.erreurFenetre.set(''); this.fenetre.set('supprimer'); }

  protected supprimer(): void {
    const a = this.cible();
    if (!a) { return; }
    this.enCours.set(true);
    this.http.delete(`${API_URL}/actualites/${a.id}`).subscribe({
      next: () => {
        this.enCours.set(false);
        this.fenetre.set(null);
        this.confirmer(`Actualité supprimée : ${a.titre}`);
        const d = this.donnees();
        if (d && d.contenu.length === 1 && this.numero() > 0) { this.numero.update((n) => n - 1); }
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { if (!this.enCours()) { this.fenetre.set(null); } }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
