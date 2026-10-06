package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "indicateurs_academiques",
        uniqueConstraints = @UniqueConstraint(columnNames = {"etudiant_id", "semestre_id", "nom"}))
@Getter
@Setter
@NoArgsConstructor
public class IndicateurAcademique {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nom;

    private Double valeur;

    @Column(name = "date_calcul")
    private LocalDateTime dateCalcul = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "semestre_id", nullable = false)
    private Semestre semestre;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modele_ia_id")
    private ModeleIA modeleIA;
}