import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Auth } from '../../core/auth';
import { API_URL } from '../../core/config';
import { Audit, LIBELLE_ROLE, Page, UtilisateurAdmin } from '../../core/modeles';
import { Icon } from '../../shared/icon/icon';

/** Tableau de bord du SuperAdmin : comptes, rôles, activité récente et raccourcis. */
@Component({
  selector: 'app-accueil-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './accueil-admin.html',
  styleUrls: ['../../shared/ui.scss', './accueil-admin.scss'],
})
export class AccueilAdmin {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(Auth);

  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly total = signal(0);
  protected readonly actifs = signal(0);
  protected readonly echantillon = signal<UtilisateurAdmin[]>([]);
  protected readonly recents = signal<Audit[]>([]);

  protected readonly temporaires = computed(() => this.echantillon().filter((u) => u.mdpTemporaire).length);
  protected readonly partiel = computed(() => this.total() > this.echantillon().length);

  protected readonly parRole = computed(() => {
    const compte = new Map<string, number>();
    for (const u of this.echantillon()) { for (const r of u.roles) { compte.set(r, (compte.get(r) ?? 0) + 1); } }
    const max = Math.max(1, ...compte.values());
    return [...compte.entries()].sort((a, b) => b[1] - a[1]).map(([role, n]) => ({ role, libelle: LIBELLE_ROLE[role] ?? role, n, part: (n / max) * 100 }));
  });

  protected readonly indicateurs = computed(() => [
    { titre: 'Comptes', valeur: String(this.total()), note: `${this.actifs()} actif${this.actifs() > 1 ? 's' : ''}`, couleur: '#3d5bd6', icone: 'people' },
    { titre: 'Comptes inactifs', valeur: String(Math.max(0, this.total() - this.actifs())), note: 'désactivés par un administrateur', couleur: '#7a88a8', icone: 'power' },
    { titre: 'Mots de passe temporaires', valeur: String(this.temporaires()), note: this.partiel() ? 'sur les 100 premiers comptes' : 'à changer à la prochaine connexion', couleur: '#d98a00', icone: 'key' },
    { titre: 'Établissement', valeur: (this.auth.session()?.etablissement ?? '').toUpperCase(), note: 'espace de travail courant', couleur: '#1f9d78', icone: 'business' },
  ]);

  constructor() {
    const liste = (extra: Record<string, string | number | boolean>) => this.http.get<Page<UtilisateurAdmin>>(`${API_URL}/utilisateurs`, { params: new HttpParams({ fromObject: { size: 1, ...extra } }) });
    // Chaque appel est indépendant : un échec n'empêche pas d'afficher le reste.
    const vide = { contenu: [], page: 0, taille: 0, total: 0, pages: 0 };
    const sur = <T,>(o: import('rxjs').Observable<T>, defaut: T) => o.pipe(catchError((e: unknown) => { this.erreur.set(Auth.message(e)); return of(defaut); }));
    forkJoin({
      tous: sur(liste({}), vide as Page<UtilisateurAdmin>),
      actifs: sur(liste({ actif: true }), vide as Page<UtilisateurAdmin>),
      echantillon: sur(this.http.get<Page<UtilisateurAdmin>>(`${API_URL}/utilisateurs`, { params: { size: 100 } }), vide as Page<UtilisateurAdmin>),
      audit: sur(this.http.get<Page<Audit>>(`${API_URL}/audit`, { params: { size: 8 } }), vide as Page<Audit>),
    }).subscribe((r) => {
      this.total.set(r.tous.total); this.actifs.set(r.actifs.total);
      this.echantillon.set(r.echantillon.contenu); this.recents.set(r.audit.contenu);
      this.chargement.set(false);
    });
  }

  protected quand(iso: string): string { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  protected delai(i: number, base = 0.15): string { return (base + i * 0.09).toFixed(2) + 's'; }
}
