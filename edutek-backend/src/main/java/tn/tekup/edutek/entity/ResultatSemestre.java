package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "resultats_semestre")
@Getter
@Setter
@NoArgsConstructor
public class ResultatSemestre extends EntiteEtablissement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double moyenne;

    private String decision;

    @Column(name = "credits_obtenus")
    private Integer creditsObtenus;

    @Column(name = "rang_classe")
    private Integer rangClasse;

    @Column(name = "effectif_classe")
    private Integer effectifClasse;

    @Column(name = "rang_filiere")
    private Integer rangFiliere;

    @Column(name = "effectif_filiere")
    private Integer effectifFiliere;

    /** CALCULE, A_RECALCULER ou PUBLIE (visible de l'etudiant). Null = ancien resultat, non publie. */
    @Column(length = 20)
    private String statut;

    @Column(name = "date_publication")
    private java.time.LocalDateTime datePublication;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "semestre_id", nullable = false)
    private Semestre semestre;
}
