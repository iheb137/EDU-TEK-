package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "documents_generes")
@Getter
@Setter
@NoArgsConstructor
public class DocumentGenere {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;

    private String url;

    @Column(name = "date_generation")
    private LocalDateTime dateGeneration = LocalDateTime.now();
}
