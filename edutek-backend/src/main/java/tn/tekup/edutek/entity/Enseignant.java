package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "enseignants")
@Getter
@Setter
@NoArgsConstructor
public class Enseignant extends Utilisateur {

    @Column(nullable = false)
    private String matricule;

    /** Cle d'unicite par etablissement (etablissement:matricule), remplie par un trigger SQL (db/migration-9b.sql). */
    @Column(name = "matricule_cle", insertable = false, updatable = false)
    private String matriculeCle;
    private String specialite;

    private String grade;
}
