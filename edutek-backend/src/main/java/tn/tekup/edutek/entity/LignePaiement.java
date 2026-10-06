package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "lignes_paiement", uniqueConstraints = @UniqueConstraint(columnNames = {"pointage_id"}))
@Getter
@Setter
@NoArgsConstructor
public class LignePaiement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etat_id", nullable = false)
    private EtatPaiement etat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pointage_id", nullable = false)
    private Pointage pointage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tarif_id", nullable = false)
    private TarifHoraire tarif;

    @Column(nullable = false)
    private Integer minutes;

    @Column(name = "tarif_horaire", nullable = false)
    private Double tarifHoraire;

    @Column(nullable = false)
    private Double montant;
}