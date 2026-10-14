import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Auth } from '../../core/auth';
import { API_URL } from '../../core/config';
import { Audit as EntreeAudit, Page } from '../../core/modeles';
import { Icon } from '../../shared/icon/icon';

/** Journal d'audit de l'établissement (SuperAdmin). */
@Component({
  selector: 'app-audit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './audit.html',
  styleUrls: ['../../shared/ui.scss'],
})
export class Audit {
  private readonly http = inject(HttpClient);
  protected readonly donnees = signal<Page<EntreeAudit> | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly acteur = signal('');
  protected readonly action = signal('');
  protected readonly numero = signal(0);
  private minuteur: ReturnType<typeof setTimeout> | undefined;

  constructor() { this.charger(); }

  protected charger(): void {
    this.chargement.set(true);
    let p = new HttpParams().set('page', this.numero()).set('size', 20);
    if (this.acteur().trim()) { p = p.set('acteur', this.acteur().trim()); }
    if (this.action().trim()) { p = p.set('action', this.action().trim()); }
    this.http.get<Page<EntreeAudit>>(`${API_URL}/audit`, { params: p }).subscribe({
      next: (d) => { this.donnees.set(d); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected filtrer(champ: 'acteur' | 'action', valeur: string): void {
    (champ === 'acteur' ? this.acteur : this.action).set(valeur);
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => { this.numero.set(0); this.charger(); }, 350);
  }
  protected aller(delta: number): void { this.numero.update((n) => n + delta); this.charger(); }
  protected quand(iso: string): string { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
}
