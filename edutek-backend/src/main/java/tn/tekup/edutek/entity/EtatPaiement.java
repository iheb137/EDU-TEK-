package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "etats_paiement")
@Getter
@Setter
@NoArgsConstructor
public class EtatPaiement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double montant;

    @Column(name = "date_paiement")
    private LocalDateTime datePaiement = LocalDateTime.now();

    private String statut = "EN_ATTENTE";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enseignant_id", nullable = false)
    private Enseignant enseignant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tarif_horaire_id", nullable = false)
    private TarifHoraire tarifHoraire;
}
