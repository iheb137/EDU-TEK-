package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "administrateurs")
@Getter
@Setter
@NoArgsConstructor
public abstract class Administrateur extends Utilisateur {

    @Column(name = "date_prise_fonction")
    private java.time.LocalDate datePriseFonction = java.time.LocalDate.now();
}
