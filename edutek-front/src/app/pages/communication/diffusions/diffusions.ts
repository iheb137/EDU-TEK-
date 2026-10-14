import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr, nombreFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Audience, Classe, DiffusionRequete, DiffusionResultat, LIBELLE_AUDIENCE } from '../modeles';

interface Envoi { titre: string; cible: string; destinataires: number; date: string; }

const AUDIENCES: { valeur: Audience; libelle: string; detail: string; icone: string }[] = [
  { valeur: 'ETUDIANTS', libelle: 'Étudiants', detail: 'Tous les étudiants de l\'établissement', icone: 'school' },
  { valeur: 'ENSEIGNANTS', libelle: 'Enseignants', detail: 'Tous les enseignants', icone: 'briefcase' },
  { valeur: 'TOUS', libelle: 'Tout le monde', detail: 'Tous les comptes de l\'établissement', icone: 'people' },
  { valeur: 'CLASSE', libelle: 'Une classe', detail: 'Les étudiants d\'une classe', icone: 'people-circle' },
];

/** Envoi d'une notification groupée à une population ciblée (SuperAdmin, administration communication). */
@Component({
  selector: 'app-diffusions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './diffusions.html',
  styleUrls: ['../../../shared/ui.scss', './diffusions.scss'],
})
export class Diffusions {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  protected readonly audiences = AUDIENCES;
  protected readonly classes = signal<Classe[] | null>(null);
  protected readonly erreurClasses = signal('');
  protected readonly erreur = signal('');
  protected readonly confirmation = signal(false);
  protected readonly enCours = signal(false);
  protected readonly resultat = signal<Envoi | null>(null);
  protected readonly historique = signal<Envoi[]>([]);
  protected readonly nombre = (n: number) => nombreFr(n, 0);
  protected readonly date = dateHeureFr;

  protected readonly formulaire = this.fb.nonNullable.group({
    audience: ['ETUDIANTS' as Audience, Validators.required],
    classeId: [''],
    titre: ['', [Validators.required, Validators.maxLength(200)]],
    contenu: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  constructor() {
    this.http.get<Classe[]>(`${API_URL}/classes`).subscribe({
      next: (l) => this.classes.set([...(l ?? [])].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))),
      error: (e: unknown) => { this.classes.set([]); this.erreurClasses.set(Auth.message(e)); },
    });
  }

  protected choisirAudience(a: Audience): void {
    this.formulaire.controls.audience.setValue(a);
    if (a !== 'CLASSE') { this.formulaire.controls.classeId.setValue(''); }
  }

  protected estClasse(): boolean { return this.formulaire.controls.audience.value === 'CLASSE'; }
  protected classeManquante(): boolean { return this.estClasse() && !this.formulaire.controls.classeId.value; }

  protected cible(): string {
    const v = this.formulaire.getRawValue();
    if (v.audience !== 'CLASSE') { return LIBELLE_AUDIENCE[v.audience]; }
    const c = this.classes()?.find((x) => String(x.id) === String(v.classeId));
    return c ? `Classe ${c.nom}${c.anneeUniversitaire ? ' (' + c.anneeUniversitaire + ')' : ''}` : 'Une classe';
  }

  protected verifier(): void {
    this.formulaire.markAllAsTouched();
    this.erreur.set('');
    const v = this.formulaire.getRawValue();
    if (this.formulaire.invalid || this.classeManquante()) { return; }
    if (!v.titre.trim() || !v.contenu.trim()) { this.erreur.set('Le titre et le message ne peuvent pas être vides.'); return; }
    this.confirmation.set(true);
  }

  protected envoyer(): void {
    const v = this.formulaire.getRawValue();
    const corps: DiffusionRequete = { audience: v.audience, titre: v.titre.trim(), contenu: v.contenu.trim() };
    if (v.audience === 'CLASSE') { corps.classeId = Number(v.classeId); }
    const cible = this.cible();
    this.enCours.set(true);
    this.http.post<DiffusionResultat>(`${API_URL}/diffusions`, corps).subscribe({
      next: (r) => {
        const envoi: Envoi = { titre: corps.titre, cible, destinataires: Number(r?.destinataires ?? 0), date: new Date().toISOString() };
        this.enCours.set(false);
        this.confirmation.set(false);
        this.resultat.set(envoi);
        this.historique.update((h) => [envoi, ...h].slice(0, 10));
        this.formulaire.reset({ audience: v.audience, classeId: v.classeId, titre: '', contenu: '' });
        setTimeout(() => document.querySelector('.recap')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      },
      error: (e: unknown) => { this.enCours.set(false); this.confirmation.set(false); this.erreur.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { if (!this.enCours()) { this.confirmation.set(false); } }
}
