package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "pointages")
@Getter
@Setter
@NoArgsConstructor
public class Pointage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seance_id", nullable = false, unique = true)
    private Seance seance;

    @Column(nullable = false)
    private String statut = "EN_ATTENTE";

    @Column(name = "minutes_declarees", nullable = false)
    private Integer minutesDeclarees;

    @Column(name = "minutes_validees")
    private Integer minutesValidees;

    @Column(length = 500)
    private String commentaire;

    @Column(name = "commentaire_finance", length = 500)
    private String commentaireFinance;

    @Column(name = "date_pointage")
    private LocalDateTime datePointage = LocalDateTime.now();

    @Column(name = "date_validation")
    private LocalDateTime dateValidation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_par_id")
    private AdminFinancier validePar;
}