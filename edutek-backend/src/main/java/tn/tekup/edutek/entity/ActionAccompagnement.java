package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "actions_accompagnement")
@Getter
@Setter
@NoArgsConstructor
public class ActionAccompagnement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;

    @Column(length = 1000)
    private String description;

    private String statut = "PLANIFIEE";

    @Column(name = "date_creation")
    private LocalDateTime dateCreation = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "alerte_risque_id", nullable = false)
    private AlerteRisque alerteRisque;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cree_par_id")
    private AdminPedagogique creePar;
}
