import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { LIBELLE_ROLE } from '../../../core/modeles';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Permission, RoleDetail } from '../modeles';

type Fenetre = null | 'role' | 'permission' | 'supprimer-role' | 'supprimer-permission';

/** Rôles et permissions : attribution des permissions, création et suppression (SuperAdmin). */
@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './roles.html',
  styleUrls: ['../../../shared/ui.scss', './roles.scss'],
})
export class Roles {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  protected readonly libelleRole = (r: string) => LIBELLE_ROLE[r] ?? null;

  protected readonly roles = signal<RoleDetail[] | null>(null);
  protected readonly permissions = signal<Permission[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');

  protected readonly selection = signal<number | null>(null);
  protected readonly cochees = signal<string[]>([]);
  protected readonly enregistrement = signal(false);
  protected readonly erreurAttribution = signal('');

  protected readonly fenetre = signal<Fenetre>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly roleCible = signal<RoleDetail | null>(null);
  protected readonly permissionCible = signal<Permission | null>(null);
  protected readonly permsNouveauRole = signal<string[]>([]);

  protected readonly roleChoisi = computed(() => this.roles()?.find((r) => r.id === this.selection()) ?? null);
  protected readonly modifie = computed(() => {
    const r = this.roleChoisi();
    if (!r) { return false; }
    const a = [...r.permissions].sort().join('|');
    const b = [...this.cochees()].sort().join('|');
    return a !== b;
  });
  /** Pour chaque permission, les rôles qui l'utilisent (l'API refuse de supprimer une permission attribuée). */
  protected readonly usages = computed(() => {
    const m = new Map<string, string[]>();
    for (const r of this.roles() ?? []) { for (const p of r.permissions) { m.set(p, [...(m.get(p) ?? []), r.nom]); } }
    return m;
  });
  protected readonly rolesTries = computed(() => [...(this.roles() ?? [])].sort((a, b) => Number(b.systeme) - Number(a.systeme) || a.nom.localeCompare(b.nom)));

  protected readonly formRole = this.fb.nonNullable.group({
    nom: ['', [Validators.required, Validators.pattern(/^[A-Za-z][A-Za-z0-9_]{2,49}$/)]],
  });
  protected readonly formPermission = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9_]{2,59}$/)]],
    description: ['', Validators.maxLength(255)],
  });

  constructor() { this.charger(); }

  protected charger(garderSelection = true): void {
    this.chargement.set(true);
    forkJoin({
      roles: this.http.get<RoleDetail[]>(`${API_URL}/roles`),
      permissions: this.http.get<Permission[]>(`${API_URL}/permissions`),
    }).subscribe({
      next: ({ roles, permissions }) => {
        this.roles.set(roles);
        this.permissions.set([...permissions].sort((a, b) => a.code.localeCompare(b.code)));
        this.erreur.set('');
        this.chargement.set(false);
        const id = garderSelection && roles.some((r) => r.id === this.selection()) ? this.selection() : this.rolesTries()[0]?.id ?? null;
        this.choisir(id);
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  // ── Attribution ─────────────────────────────────────────────────────────
  protected choisir(id: number | null): void {
    this.selection.set(id);
    this.cochees.set([...(this.roles()?.find((r) => r.id === id)?.permissions ?? [])]);
    this.erreurAttribution.set('');
  }

  protected cocher(code: string, coche: boolean): void {
    this.cochees.update((l) => (coche ? [...new Set([...l, code])] : l.filter((c) => c !== code)));
  }
  protected toutCocher(coche: boolean): void { this.cochees.set(coche ? (this.permissions() ?? []).map((p) => p.code) : []); }
  protected annulerAttribution(): void { this.choisir(this.selection()); }

  protected enregistrerAttribution(): void {
    const r = this.roleChoisi();
    if (!r) { return; }
    this.enregistrement.set(true);
    this.erreurAttribution.set('');
    this.http.put<RoleDetail>(`${API_URL}/roles/${r.id}/permissions`, { permissions: this.cochees() }).subscribe({
      next: (maj) => {
        this.enregistrement.set(false);
        this.roles.update((l) => l?.map((x) => (x.id === r.id ? { ...x, permissions: maj?.permissions ?? this.cochees() } : x)) ?? l);
        this.choisir(r.id);
        this.confirmer(`Permissions du rôle ${r.nom} enregistrées.`);
      },
      error: (e: unknown) => { this.enregistrement.set(false); this.erreurAttribution.set(Auth.message(e)); },
    });
  }

  // ── Rôles ───────────────────────────────────────────────────────────────
  protected ouvrirRole(): void {
    this.formRole.reset({ nom: '' });
    this.permsNouveauRole.set([]);
    this.erreurFenetre.set('');
    this.fenetre.set('role');
  }
  protected cocherNouveau(code: string, coche: boolean): void {
    this.permsNouveauRole.update((l) => (coche ? [...new Set([...l, code])] : l.filter((c) => c !== code)));
  }
  protected majuscules(ctrl: 'role' | 'permission', valeur: string): void {
    const c = ctrl === 'role' ? this.formRole.controls.nom : this.formPermission.controls.code;
    const propre = valeur.toUpperCase().replace(/[\s-]+/g, '_');
    if (propre !== valeur) { c.setValue(propre); }
  }

  protected creerRole(): void {
    this.formRole.markAllAsTouched();
    if (this.formRole.invalid) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<RoleDetail>(`${API_URL}/roles`, { nom: this.formRole.controls.nom.value.trim(), permissions: this.permsNouveauRole() }).subscribe({
      next: (r) => { this.enCours.set(false); this.fermer(); this.confirmer(`Rôle créé : ${r.nom}`); this.selection.set(r.id); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected demanderSuppressionRole(r: RoleDetail): void { this.roleCible.set(r); this.erreurFenetre.set(''); this.fenetre.set('supprimer-role'); }
  protected supprimerRole(): void {
    const r = this.roleCible();
    if (!r) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.delete(`${API_URL}/roles/${r.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(`Rôle supprimé : ${r.nom}`); this.charger(false); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  // ── Permissions ─────────────────────────────────────────────────────────
  protected ouvrirPermission(): void {
    this.formPermission.reset({ code: '', description: '' });
    this.erreurFenetre.set('');
    this.fenetre.set('permission');
  }

  protected creerPermission(): void {
    this.formPermission.markAllAsTouched();
    if (this.formPermission.invalid) { return; }
    const v = this.formPermission.getRawValue();
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<Permission>(`${API_URL}/permissions`, { code: v.code.trim(), description: v.description.trim() || undefined }).subscribe({
      next: (p) => { this.enCours.set(false); this.fermer(); this.confirmer(`Permission créée : ${p.code}`); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected demanderSuppressionPermission(p: Permission): void { this.permissionCible.set(p); this.erreurFenetre.set(''); this.fenetre.set('supprimer-permission'); }
  protected supprimerPermission(): void {
    const p = this.permissionCible();
    if (!p) { return; }
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.delete(`${API_URL}/permissions/${p.id}`).subscribe({
      next: () => { this.enCours.set(false); this.fermer(); this.confirmer(`Permission supprimée : ${p.code}`); this.charger(); },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
