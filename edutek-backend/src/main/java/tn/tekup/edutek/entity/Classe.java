package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "classes")
@Getter
@Setter
@NoArgsConstructor
public class Classe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String nom;

    @Column(name = "annee_universitaire")
    private String anneeUniversitaire;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "formation_id", nullable = false)
    private Formation formation;

    @OneToMany(mappedBy = "classe")
    private List<Etudiant> etudiants = new ArrayList<>();

    @OneToMany(mappedBy = "classe")
    private List<Enseignement> enseignements = new ArrayList<>();
}
