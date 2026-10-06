package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "etats_paiement_mensuels",
        uniqueConstraints = @UniqueConstraint(columnNames = {"enseignant_id", "periode"}))
@Getter
@Setter
@NoArgsConstructor
public class EtatPaiement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enseignant_id", nullable = false)
    private Enseignant enseignant;

    @Column(nullable = false, length = 7)
    private String periode;

    private Integer minutes;

    private Double montant;

    @Column(nullable = false)
    private String statut = "BROUILLON";

    @Column(name = "date_generation")
    private LocalDateTime dateGeneration = LocalDateTime.now();

    @Column(name = "date_validation")
    private LocalDateTime dateValidation;

    @Column(name = "date_paiement")
    private LocalDateTime datePaiement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_par_id")
    private AdminFinancier validePar;

    @OneToMany(mappedBy = "etat", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LignePaiement> lignes = new ArrayList<>();
}