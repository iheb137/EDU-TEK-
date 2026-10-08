package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Regles de calcul des resultats d'une formation (parametrables, jamais de formule libre). */
@Entity
@Table(name = "regles_calcul")
@Getter
@Setter
@NoArgsConstructor
public class RegleCalcul extends EntiteEtablissement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "formation_id", nullable = false, unique = true)
    private Formation formation;

    /** Bareme : note maximale d'une evaluation. */
    @Column(name = "note_max", nullable = false)
    private Double noteMax = 20.0;

    /** Moyenne minimale pour valider une matiere et le semestre. */
    @Column(name = "seuil_admission", nullable = false)
    private Double seuilAdmission = 10.0;

    /** Moyenne de matiere en dessous de laquelle le semestre est refuse (null = aucune). */
    @Column(name = "note_eliminatoire")
    private Double noteEliminatoire;

    /** Si faux, toute matiere sous le seuil refuse le semestre meme si la moyenne generale le depasse. */
    @Column(nullable = false)
    private Boolean compensation = true;

    /** Nombre de decimales conservees pour les moyennes (0 a 3). */
    @Column(nullable = false)
    private Integer decimales = 2;
}