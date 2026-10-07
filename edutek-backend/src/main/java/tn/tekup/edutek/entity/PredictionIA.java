package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "predictions_ia")
@Getter
@Setter
@NoArgsConstructor
public class PredictionIA {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;

    private Double probabilite;

    private String niveau;

    @Column(name = "date_prediction")
    private LocalDateTime datePrediction = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "semestre_id")
    private Semestre semestre;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modele_ia_id", nullable = false)
    private ModeleIA modeleIA;

    @OneToOne(mappedBy = "prediction", cascade = CascadeType.ALL)
    private AlerteRisque alerteRisque;

    @OneToMany(mappedBy = "prediction", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("rang ASC")
    private List<FacteurExplicatif> facteurs = new ArrayList<>();
}