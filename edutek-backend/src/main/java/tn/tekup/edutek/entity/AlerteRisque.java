package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "alertes_risque")
@Getter
@Setter
@NoArgsConstructor
public class AlerteRisque {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String niveau;

    private Double score;

    private String statut = "OUVERTE";

    @Column(name = "date_detection")
    private LocalDateTime dateDetection = LocalDateTime.now();

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false, unique = true)
    private PredictionIA prediction;

    @OneToMany(mappedBy = "alerteRisque", cascade = CascadeType.ALL)
    private List<ActionAccompagnement> actions = new ArrayList<>();
}
