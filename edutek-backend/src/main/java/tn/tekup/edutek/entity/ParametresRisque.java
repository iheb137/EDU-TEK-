package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/** Parametres du risque academique : une seule ligne (identifiant 1). */
@Entity
@Table(name = "parametres_risque")
@Getter
@Setter
@NoArgsConstructor
public class ParametresRisque {

    @Id
    private Long id;

    @Column(name = "seuil_moyen", nullable = false)
    private Double seuilMoyen = 0.40;

    @Column(name = "seuil_eleve", nullable = false)
    private Double seuilEleve = 0.70;

    @Column(name = "date_modification")
    private LocalDateTime dateModification = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modifie_par_id")
    private AdminPedagogique modifiePar;
}