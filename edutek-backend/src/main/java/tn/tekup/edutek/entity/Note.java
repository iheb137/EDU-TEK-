package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "notes")
@Getter
@Setter
@NoArgsConstructor
public class Note extends EntiteEtablissement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double valeur;

    private String commentaire;

    /** BROUILLON (visible de l'enseignant seul) ou SOUMISE (visible de l'etudiant). Null = ancienne note, consideree soumise. */
    @Column(length = 20)
    private String statut = "BROUILLON";

    @Column(name = "date_soumission")
    private java.time.LocalDateTime dateSoumission;

    @Column(name = "saisie_par")
    private String saisiePar;

    public boolean estSoumise() {
        return statut == null || "SOUMISE".equals(statut);
    }

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluation_id", nullable = false)
    private Evaluation evaluation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;
}
