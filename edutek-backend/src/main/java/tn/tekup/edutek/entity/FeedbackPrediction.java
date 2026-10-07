package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "feedbacks_prediction")
@Getter
@Setter
@NoArgsConstructor
public class FeedbackPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    private PredictionIA prediction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auteur_id", nullable = false)
    private AdminPedagogique auteur;

    @Column(nullable = false)
    private Boolean pertinent;

    @Column(length = 500)
    private String commentaire;

    @Column(name = "date_avis")
    private LocalDateTime dateAvis = LocalDateTime.now();
}