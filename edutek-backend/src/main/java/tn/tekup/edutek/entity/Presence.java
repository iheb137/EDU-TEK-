package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "presences")
@Getter
@Setter
@NoArgsConstructor
public class Presence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Boolean present = false;

    @Column(name = "date_pointage")
    private LocalDateTime datePointage = LocalDateTime.now();

    private String justification;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seance_id", nullable = false)
    private Seance seance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "etudiant_id", nullable = false)
    private Etudiant etudiant;
}
