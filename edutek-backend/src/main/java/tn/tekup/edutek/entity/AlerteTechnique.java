package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "alertes_techniques")
@Getter
@Setter
@NoArgsConstructor
public class AlerteTechnique {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;

    @Column(length = 1000)
    private String message;

    private String niveau;

    private String statut = "OUVERTE";

    @Column(length = 100)
    private String source;

    @Column(name = "date_creation")
    private LocalDateTime dateCreation = LocalDateTime.now();

    @Column(name = "date_traitement")
    private LocalDateTime dateTraitement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "execution_id")
    private ExecutionWorkflow execution;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supervise_par_id")
    private SuperAdmin supervisePar;
}