package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "enseignements")
@Getter
@Setter
@NoArgsConstructor
public class Enseignement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String groupe;

    @Column(name = "volume_horaire")
    private Integer volumeHoraire;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enseignant_id", nullable = false)
    private Enseignant enseignant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "matiere_id", nullable = false)
    private Matiere matiere;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classe_id", nullable = false)
    private Classe classe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "semestre_id", nullable = false)
    private Semestre semestre;
}
