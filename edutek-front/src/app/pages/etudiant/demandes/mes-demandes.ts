import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { DemandeDocument, STATUT_DEMANDE, TYPES_DOCUMENT, libelle } from '../modeles';
import { confirmerPendant } from '../outils';

/** Une demande reste ouverte tant que le papier n'a pas été retiré au bureau. */
const OUVERTS = ['SOUMIS', 'EN_TRAITEMENT', 'PRET'];

/** Demandes de documents administratifs (attestations, relevés) ; le document papier se retire à l'administration. */
@Component({
  selector: 'app-mes-demandes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal],
  templateUrl: './mes-demandes.html',
  styleUrls: ['../../../shared/ui.scss', '../etudiant.scss'],
})
export class MesDemandes {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  protected readonly types = Object.entries(TYPES_DOCUMENT);
  protected readonly liste = signal<DemandeDocument[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly fenetre = signal<null | 'creer'>(null);
  protected readonly enCours = signal(false);
  protected readonly erreurFenetre = signal('');

  /** Types ayant déjà une demande en cours (l'API refuse un doublon). */
  protected readonly typesOuverts = computed(() => new Set(this.liste().filter((d) => OUVERTS.includes(d.statut)).map((d) => d.typeDocument)));
  protected readonly nbOuvertes = computed(() => this.liste().filter((d) => OUVERTS.includes(d.statut)).length);
  protected readonly aRetirer = computed(() => this.liste().filter((d) => d.statut === 'PRET'));

  protected readonly formulaire = this.fb.nonNullable.group({ typeDocument: ['', Validators.required] });

  constructor() { this.charger(); }

  protected charger(): void {
    this.http.get<DemandeDocument[]>(`${API_URL}/demandes-documents/mes-demandes`).subscribe({
      next: (l) => { this.liste.set(l); this.erreur.set(''); this.chargement.set(false); },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected ouvrirCreation(): void {
    const libre = this.types.find(([t]) => !this.typesOuverts().has(t));
    this.formulaire.reset({ typeDocument: libre?.[0] ?? '' });
    this.erreurFenetre.set('');
    this.fenetre.set('creer');
  }

  protected creer(): void {
    this.formulaire.markAllAsTouched();
    if (this.formulaire.invalid) { return; }
    const type = this.formulaire.getRawValue().typeDocument;
    this.enCours.set(true);
    this.erreurFenetre.set('');
    this.http.post<DemandeDocument>(`${API_URL}/demandes-documents`, { typeDocument: type }).subscribe({
      next: () => {
        this.enCours.set(false); this.fermer();
        confirmerPendant((m) => this.info.set(m), `Demande envoyée : ${this.type(type)}. Vous serez notifié dès que le document sera prêt à retirer.`);
        this.charger();
      },
      error: (e: unknown) => { this.enCours.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermer(): void { this.fenetre.set(null); }
  protected type(t: string): string { return libelle(TYPES_DOCUMENT, t); }
  protected statut(s: string): string { return libelle(STATUT_DEMANDE, s); }
  protected readonly dateHeure = dateHeureFr;
}
