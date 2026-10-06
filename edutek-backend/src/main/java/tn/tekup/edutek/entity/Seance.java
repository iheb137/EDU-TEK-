package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "seances")
@Getter
@Setter
@NoArgsConstructor
public class Seance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate date;

    @Column(name = "heure_debut")
    private LocalTime heureDebut;

    @Column(name = "heure_fin")
    private LocalTime heureFin;

    private String salle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enseignement_id", nullable = false)
    private Enseignement enseignement;

    @OneToMany(mappedBy = "seance", cascade = CascadeType.ALL)
    private List<Presence> presences = new ArrayList<>();
}
