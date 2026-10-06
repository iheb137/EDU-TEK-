package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "matieres")
@Getter
@Setter
@NoArgsConstructor
public class Matiere {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String nom;

    private Double coefficient;

    private Integer credits;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "semestre_id", nullable = false)
    private Semestre semestre;

    @OneToMany(mappedBy = "matiere")
    private List<Enseignement> enseignements = new ArrayList<>();
}
