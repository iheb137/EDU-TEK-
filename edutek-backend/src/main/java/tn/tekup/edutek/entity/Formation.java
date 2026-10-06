package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "formations")
@Getter
@Setter
@NoArgsConstructor
public class Formation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String nom;

    private String niveau;

    @OneToMany(mappedBy = "formation", cascade = CascadeType.ALL)
    private List<Classe> classes = new ArrayList<>();

    @OneToMany(mappedBy = "formation", cascade = CascadeType.ALL)
    private List<Semestre> semestres = new ArrayList<>();

    @OneToMany(mappedBy = "formation")
    private List<Inscription> inscriptions = new ArrayList<>();
}
