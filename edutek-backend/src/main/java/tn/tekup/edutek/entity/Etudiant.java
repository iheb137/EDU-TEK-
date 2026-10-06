package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "etudiants")
@Getter
@Setter
@NoArgsConstructor
public class Etudiant extends Utilisateur {

    @Column(nullable = false, unique = true)
    private String matricule;

    private String niveau;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classe_id")
    private Classe classe;

    @OneToMany(mappedBy = "etudiant")
    private List<Inscription> inscriptions = new ArrayList<>();
}
