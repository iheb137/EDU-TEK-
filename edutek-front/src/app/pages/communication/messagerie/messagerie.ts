import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../../core/auth';
import { API_URL } from '../../../core/config';
import { dateHeureFr } from '../../../shared/format';
import { Icon } from '../../../shared/icon/icon';
import { Modal } from '../../../shared/modal/modal';
import { Compteurs } from '../compteurs';
import { Message, MessageRequete, Personne, dateCourte, normaliser } from '../modeles';
import { ChoixDestinataire } from './choix-destinataire';

type Onglet = 'recus' | 'envoyes';

/** Messagerie interne : boîte de réception, messages envoyés, lecture, rédaction et réponse. */
@Component({
  selector: 'app-messagerie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Modal, ChoixDestinataire],
  templateUrl: './messagerie.html',
  styleUrls: ['../../../shared/ui.scss', './messagerie.scss'],
})
export class Messagerie {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly compteurs = inject(Compteurs);

  protected readonly onglet = signal<Onglet>('recus');
  protected readonly recus = signal<Message[] | null>(null);
  protected readonly envoyes = signal<Message[] | null>(null);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal('');
  protected readonly info = signal('');
  protected readonly filtre = signal('');
  protected readonly nonLusSeulement = signal(false);

  protected readonly selection = signal<Message | null>(null);
  protected readonly lectureEnCours = signal(false);

  protected readonly redaction = signal(false);
  protected readonly destinataire = signal<Personne | null>(null);
  protected readonly erreurDestinataire = signal(false);
  protected readonly envoi = signal(false);
  protected readonly erreurFenetre = signal('');
  protected readonly formulaire = this.fb.nonNullable.group({
    objet: ['', [Validators.required, Validators.maxLength(200)]],
    contenu: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  protected readonly dateCourte = dateCourte;
  protected readonly dateLongue = dateHeureFr;

  protected readonly nonLus = computed(() => (this.recus() ?? []).filter((m) => !m.lu).length);
  protected readonly liste = computed(() => {
    const brut = (this.onglet() === 'recus' ? this.recus() : this.envoyes()) ?? [];
    const f = normaliser(this.filtre());
    return brut
      .filter((m) => !(this.onglet() === 'recus' && this.nonLusSeulement() && m.lu))
      .filter((m) => !f || normaliser(`${m.objet} ${m.contenu} ${m.expediteurNom} ${m.destinataireNom}`).includes(f))
      .sort((a, b) => (b.dateEnvoi ?? '').localeCompare(a.dateEnvoi ?? ''));
  });
  protected readonly listeChargee = computed(() => (this.onglet() === 'recus' ? this.recus() : this.envoyes()) !== null);

  constructor() {
    this.charger('recus');
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    if (q.get('ecrire')) {
      const id = Number(q.get('a'));
      const dest = id ? { id, prenom: q.get('prenom') ?? '', nom: q.get('nom') ?? '', roles: (q.get('roles') ?? '').split(',').filter(Boolean) } : null;
      this.ouvrirRedaction(dest);
      if (dest) { setTimeout(() => document.getElementById('m-objet')?.focus(), 50); }
      // On retire les paramètres de l'adresse pour ne pas rouvrir la rédaction au rechargement.
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  // ── Listes ──────────────────────────────────────────────────────────────
  protected charger(o: Onglet = this.onglet()): void {
    this.chargement.set(true);
    this.http.get<Message[]>(`${API_URL}/messages/${o}`).subscribe({
      next: (l) => {
        (o === 'recus' ? this.recus : this.envoyes).set(l ?? []);
        this.erreur.set('');
        this.chargement.set(false);
        if (o === 'recus') { this.compteurs.rafraichirMessages(); }
      },
      error: (e: unknown) => { this.erreur.set(Auth.message(e)); this.chargement.set(false); },
    });
  }

  protected changerOnglet(o: Onglet): void {
    if (o === this.onglet()) { return; }
    this.onglet.set(o);
    this.selection.set(null);
    if ((o === 'recus' ? this.recus() : this.envoyes()) === null) { this.charger(o); }
  }

  protected actualiser(): void { this.charger(); }

  // ── Lecture ─────────────────────────────────────────────────────────────
  protected lire(m: Message): void {
    this.selection.set(m);
    if (this.onglet() !== 'recus' || m.lu) { return; }
    // La lecture côté serveur (GET /messages/{id}) marque le message comme lu.
    this.lectureEnCours.set(true);
    this.http.get<Message>(`${API_URL}/messages/${m.id}`).subscribe({
      next: (complet) => {
        this.lectureEnCours.set(false);
        const lu = { ...m, ...complet, lu: true };
        this.recus.update((l) => (l ?? []).map((x) => (x.id === m.id ? lu : x)));
        if (this.selection()?.id === m.id) { this.selection.set(lu); }
        this.compteurs.rafraichirMessages();
        this.compteurs.rafraichirNotifications();
      },
      error: (e: unknown) => { this.lectureEnCours.set(false); this.erreur.set(Auth.message(e)); },
    });
  }

  protected fermerLecture(): void { this.selection.set(null); }

  // ── Rédaction ───────────────────────────────────────────────────────────
  protected ouvrirRedaction(dest: Personne | null = null, objet = '', contenu = ''): void {
    this.destinataire.set(dest);
    this.formulaire.reset({ objet, contenu });
    this.erreurDestinataire.set(false);
    this.erreurFenetre.set('');
    this.redaction.set(true);
  }

  protected repondre(m: Message): void {
    const objet = /^re\s*:/i.test(m.objet) ? m.objet : `RE : ${m.objet}`;
    const cite = m.contenu.split('\n').map((l) => `> ${l}`).join('\n');
    const contenu = `\n\nLe ${dateHeureFr(m.dateEnvoi)}, ${m.expediteurNom} a écrit :\n${cite}`;
    this.ouvrirRedaction({ id: m.expediteurId, prenom: '', nom: m.expediteurNom, roles: [] }, objet.slice(0, 200), contenu);
    setTimeout(() => { const t = document.getElementById('m-contenu') as HTMLTextAreaElement | null; t?.focus(); t?.setSelectionRange(0, 0); });
  }

  protected envoyer(): void {
    this.formulaire.markAllAsTouched();
    const dest = this.destinataire();
    this.erreurDestinataire.set(!dest);
    if (this.formulaire.invalid || !dest) { return; }
    const v = this.formulaire.getRawValue();
    const corps: MessageRequete = { destinataireId: dest.id, objet: v.objet.trim(), contenu: v.contenu.trim() };
    if (!corps.objet || !corps.contenu) { this.erreurFenetre.set('L\'objet et le message ne peuvent pas être vides.'); return; }
    this.envoi.set(true);
    this.erreurFenetre.set('');
    this.http.post<Message>(`${API_URL}/messages`, corps).subscribe({
      next: (m) => {
        this.envoi.set(false);
        this.redaction.set(false);
        this.confirmer(`Message envoyé à ${m?.destinataireNom ?? `${dest.prenom} ${dest.nom}`.trim()}.`);
        this.envoyes.update((l) => (l && m ? [m, ...l] : l));
        if (this.envoyes() === null || !m) { this.charger('envoyes'); }
      },
      error: (e: unknown) => { this.envoi.set(false); this.erreurFenetre.set(Auth.message(e)); },
    });
  }

  protected fermerRedaction(): void { if (!this.envoi()) { this.redaction.set(false); } }

  protected apercu(t: string): string { return (t ?? '').replace(/\s+/g, ' ').trim(); }
  private confirmer(m: string): void { this.info.set(m); setTimeout(() => this.info.set(''), 4000); }
}
