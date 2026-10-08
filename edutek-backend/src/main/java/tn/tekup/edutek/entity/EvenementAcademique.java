package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** Evenement du calendrier scolaire : rentree, vacances, jour ferie, periode d'examens... */
@Entity
@Table(name = "evenements_academiques")
@Getter
@Setter
@NoArgsConstructor
public class EvenementAcademique extends EntiteEtablissement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String titre;

    @Column(nullable = false, length = 30)
    private String type;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin", nullable = false)
    private LocalDate dateFin;

    @Column(length = 1000)
    private String description;

    /** Null = concerne tout l'etablissement. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "formation_id")
    private Formation formation;
}