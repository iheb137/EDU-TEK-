package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "demandes_documents")
@Getter
@Setter
@NoArgsConstructor
public class DemandeDocument extends EntiteEtablissement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "type_document")
    private String typeDocument;

    @Column(name = "date_demande")
    private LocalDateTime dateDemande = LocalDateTime.now();

    private String statut = "SOUMIS";

    @Column(name = "motif_rejet")
    private String motifRejet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "traite_par_id")
    private AdminSupport traitePar;

    /** Ancien mode de livraison par lien (conserve pour les donnees existantes, plus utilise). */
    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "document_genere_id")
    private DocumentGenere documentGenere;

    /** Consigne de retrait communiquee a l'etudiant (bureau, horaires...). */
    @Column(name = "message_retrait", length = 500)
    private String messageRetrait;

    /** Date a laquelle le document papier a ete marque pret a retirer. */
    @Column(name = "date_pret")
    private LocalDateTime datePret;

    /** Date de remise du document papier a l'etudiant au guichet. */
    @Column(name = "date_remise")
    private LocalDateTime dateRemise;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "remis_par_id")
    private AdminSupport remisPar;
}