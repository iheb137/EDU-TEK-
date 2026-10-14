import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_URL } from './config';

export interface Session {
  token: string;
  email: string;
  nom: string;
  prenom: string;
  etablissement: string;
  roles: string[];
}

interface LoginResponse { token: string; email: string; nom: string; prenom: string; roles?: string[]; }

const CLE = 'edutek.session';

/** Décode la partie utile (payload) d'un JWT, sans vérifier la signature (le serveur s'en charge). */
function decoderJeton(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(b64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    return JSON.parse(json);
  } catch { return {}; }
}

function extraireRoles(p: Record<string, unknown>): string[] {
  const brut = p['roles'] ?? p['role'] ?? p['authorities'] ?? [];
  const liste = Array.isArray(brut) ? brut : String(brut).split(/[ ,]+/);
  return liste.map((r) => String(typeof r === 'object' && r ? (r as Record<string, unknown>)['authority'] : r).replace(/^ROLE_/, '')).filter(Boolean);
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _session = signal<Session | null>(this.lire());
  readonly session = this._session.asReadonly();
  readonly connecte = computed(() => this._session() !== null && !this.expire());
  readonly nomComplet = computed(() => {
    const s = this._session();
    return s ? `${s.prenom} ${s.nom}`.trim() || s.email : '';
  });

  roles(): string[] { return this._session()?.roles ?? []; }
  a(...roles: string[]): boolean { return roles.some((r) => this.roles().includes(r)); }
  token(): string | null { return this._session()?.token ?? null; }

  connecter(etablissement: string, email: string, motDePasse: string): Observable<LoginResponse> {
    const entetes = new HttpHeaders({ 'X-Etablissement': etablissement.trim().toLowerCase() });
    return this.http.post<LoginResponse>(`${API_URL}/auth/login`, { email: email.trim(), motDePasse }, { headers: entetes }).pipe(
      tap((r) => {
        const p = decoderJeton(r.token);
        const s: Session = {
          token: r.token, email: r.email, nom: r.nom, prenom: r.prenom,
          etablissement: String(p['etab'] ?? etablissement.trim().toLowerCase()),
          roles: (r.roles?.length ? r.roles : extraireRoles(p)).map((x) => x.replace(/^ROLE_/, '')),
        };
        this._session.set(s);
        try { sessionStorage.setItem(CLE, JSON.stringify(s)); } catch { /* stockage indisponible */ }
      }),
    );
  }

  changerMotDePasse(etablissement: string, email: string, ancien: string, nouveau: string): Observable<unknown> {
    const entetes = new HttpHeaders({ 'X-Etablissement': etablissement.trim().toLowerCase() });
    return this.http.post(`${API_URL}/auth/changer-mot-de-passe`, { email: email.trim(), ancienMotDePasse: ancien, nouveauMotDePasse: nouveau }, { headers: entetes });
  }

  deconnecter(): void {
    this._session.set(null);
    try { sessionStorage.removeItem(CLE); } catch { /* ignoré */ }
    // Rechargement complet : aucun état (compteurs, pages en cache) du compte précédent ne subsiste.
    window.location.assign('/connexion');
  }

  /** Message lisible pour une erreur HTTP de l'API (format { erreur: "..." }). */
  static message(e: unknown, defaut = 'Une erreur est survenue. Réessayez.'): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0) { return 'Serveur injoignable. Vérifiez que le backend est démarré.'; }
      const m = (e.error as { erreur?: string } | null)?.erreur;
      if (m) { return m; }
      if (e.status === 401) { return 'Identifiants invalides ou établissement inconnu.'; }
      const brut = typeof e.error === 'string' ? e.error : JSON.stringify(e.error ?? '');
      return `Erreur ${e.status} : ${brut && brut !== '""' && brut !== 'null' ? brut.slice(0, 300) : (e.statusText || 'réponse vide du serveur')}`;
    }
    return defaut;
  }

  private lire(): Session | null {
    try { const v = sessionStorage.getItem(CLE); return v ? (JSON.parse(v) as Session) : null; } catch { return null; }
  }

  private expire(): boolean {
    const t = this._session()?.token;
    const exp = t ? Number(decoderJeton(t)['exp']) : 0;
    return !!exp && exp * 1000 < Date.now();
  }
}
