package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "classes_virtuelles")
@Getter
@Setter
@NoArgsConstructor
public class ClasseVirtuelle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String plateforme;

    private String lien;

    @Column(name = "code_acces")
    private String codeAcces;

    @Column(name = "date_heure")
    private LocalDateTime dateHeure;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enseignement_id", nullable = false)
    private Enseignement enseignement;

    @OneToMany(mappedBy = "classeVirtuelle", cascade = CascadeType.ALL)
    private List<SupportCours> supportsCours = new ArrayList<>();
}
