package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "justificatifs_absence")
@Getter
@Setter
@NoArgsConstructor
public class JustificatifAbsence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin", nullable = false)
    private LocalDate dateFin;

    @Column(nullable = false, length = 30)
    private String motif;

    @Column(length = 500)
    private String commentaire;

    @Column(name = "piece_url")
    private String pieceUrl;

    @Column(nullable = false)
    private String statut = "SOUMIS";

    @Column(name = "motif_rejet")
    private String motifRejet;

    @Column(name = "date_soumission")
    private LocalDateTime dateSoumission = LocalDateTime.now();

    @Column(name = "date_decision")
    private LocalDateTime dateDecision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "traite_par_id")
    private AdminSupport traitePar;

    @Column(name = "nb_absences_justifiees")
    private Integer nbAbsencesJustifiees;
}