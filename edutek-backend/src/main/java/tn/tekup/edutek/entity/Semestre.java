package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "semestres")
@Getter
@Setter
@NoArgsConstructor
public class Semestre {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nom;

    @Column(name = "date_debut")
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "formation_id", nullable = false)
    private Formation formation;

    @OneToMany(mappedBy = "semestre", cascade = CascadeType.ALL)
    private List<Matiere> matieres = new ArrayList<>();

    @OneToMany(mappedBy = "semestre")
    private List<Enseignement> enseignements = new ArrayList<>();
}
