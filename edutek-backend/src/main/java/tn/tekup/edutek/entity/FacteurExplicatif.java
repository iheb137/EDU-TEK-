package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "facteurs_explicatifs")
@Getter
@Setter
@NoArgsConstructor
public class FacteurExplicatif {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    private PredictionIA prediction;

    @Column(nullable = false)
    private String nom;

    private Double valeur;

    private Double contribution;

    private Integer rang;
}