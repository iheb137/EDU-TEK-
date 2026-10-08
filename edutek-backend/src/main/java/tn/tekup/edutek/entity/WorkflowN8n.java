package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "workflows_n8n")
@Getter
@Setter
@NoArgsConstructor
public class WorkflowN8n {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String nom;

    private Boolean actif = true;

    @Column(name = "date_creation")
    private LocalDateTime dateCreation = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "configure_par_id")
    private SuperAdmin configurePar;

    @OneToMany(mappedBy = "workflow", cascade = CascadeType.ALL)
    private List<ExecutionWorkflow> executions = new ArrayList<>();
}