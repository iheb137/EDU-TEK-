package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "evaluations")
@Getter
@Setter
@NoArgsConstructor
public class Evaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;

    private LocalDate date;

    private Double coefficient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enseignement_id", nullable = false)
    private Enseignement enseignement;

    @OneToMany(mappedBy = "evaluation", cascade = CascadeType.ALL)
    private List<Note> notes = new ArrayList<>();
}
