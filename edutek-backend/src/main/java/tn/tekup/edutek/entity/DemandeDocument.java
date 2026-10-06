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
public class DemandeDocument {

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

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "document_genere_id")
    private DocumentGenere documentGenere;
}