package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "modeles_ia")
@Getter
@Setter
@NoArgsConstructor
public class ModeleIA {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nom;

    private String version;

    private String type;

    private String statut = "ENTRAINE";
}
