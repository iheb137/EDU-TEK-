package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "tarifs_horaires")
@Getter
@Setter
@NoArgsConstructor
public class TarifHoraire {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double montant;

    @Column(name = "date_debut")
    private LocalDate dateDebut = LocalDate.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "defini_par_id")
    private AdminFinancier definiPar;
}
