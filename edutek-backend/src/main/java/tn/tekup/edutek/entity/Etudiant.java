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

    @Column(nullable = false)
    private String matricule;

    /** Cle d'unicite par etablissement (etablissement:matricule), remplie par un trigger SQL (db/migration-9b.sql). */
    @Column(name = "matricule_cle", insertable = false, updatable = false)
    private String matriculeCle;
    private String niveau;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classe_id")
    private Classe classe;

    @OneToMany(mappedBy = "etudiant")
    private List<Inscription> inscriptions = new ArrayList<>();
}
