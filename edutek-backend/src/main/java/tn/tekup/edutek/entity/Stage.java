package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "stages")
@Getter
@Setter
@NoArgsConstructor
public class Stage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String entreprise;

    private String sujet;

    @Column(name = "date_debut")
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    private String statut = "PROPOSE";

    @Column(name = "motif_rejet")
    private String motifRejet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_par_id")
    private AdminCommunication validePar;
}
