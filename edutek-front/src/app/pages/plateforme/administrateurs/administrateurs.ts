import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { LIBELLE_ROLE } from '../../../core/modeles';
import { Icon } from '../../../shared/icon/icon';
import { Administrateur } from '../modeles';

/** Liste des administrateurs de l'établissement ; la gestion des comptes se fait dans « Utilisateurs » (SuperAdmin). */
@Component({
  selector: 'app-administrateurs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './administrateurs.html',
  styleUrls: ['../../../shared/ui.scss', './administrateurs.scss'],
})
export class Administrateurs {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(Auth);
  protected readonly libelleRole = (r: string) => LIBELLE_ROLE[r] ?? r;

  protected readonly liste = signal<Administrateur[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly filtre = signal('');
  protected readonly role = signal('');

  protected readonly rolesPresents = computed(() => [...new Set((this.liste() ?? []).flatMap((a) => a.roles))].sort());
  protected readonly visibles = computed(() => {
    const q = this.filtre().trim().toLowerCase();
    return (this.liste() ?? [])
      .filter((a) => !this.role() || a.roles.includes(this.role()))
      .filter((a) => !q || `${a.prenom} ${a.nom} ${a.email}`.toLowerCase().includes(q));
  });
  protected readonly parRole = computed(() => {
    const m = new Map<string, number>();
    for (const a of this.liste() ?? []) { for (const r of a.roles) { m.set(r, (m.get(r) ?? 0) + 1); } }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  });

  constructor() {
    this.http.get<Administrateur[]>(`${API_URL}/admins`).subscribe({
      next: (l) => { this.liste.set([...l].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`))); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }
}
