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
public class ResultatSemestre {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double moyenne;

    private String decision;

    @Column(name = "credits_obtenus")
    private Integer creditsObtenus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "semestre_id", nullable = false)
    private Semestre semestre;
}
