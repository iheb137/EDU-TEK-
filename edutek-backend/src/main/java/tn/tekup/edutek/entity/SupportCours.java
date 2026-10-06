package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "supports_cours")
@Getter
@Setter
@NoArgsConstructor
public class SupportCours {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String titre;

    private String type;

    private String url;

    @Column(name = "date_depot")
    private LocalDateTime dateDepot = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classe_virtuelle_id", nullable = false)
    private ClasseVirtuelle classeVirtuelle;
}
