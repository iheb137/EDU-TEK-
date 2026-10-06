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

    @Column(nullable = false, unique = true)
    private String matricule;

    private String specialite;

    private String grade;
}
