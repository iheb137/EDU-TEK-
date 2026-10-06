package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "executions_workflow")
@Getter
@Setter
@NoArgsConstructor
public class ExecutionWorkflow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "date_execution")
    private LocalDateTime dateExecution = LocalDateTime.now();

    private String statut;

    @Column(length = 1000)
    private String resultat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_id", nullable = false)
    private WorkflowN8n workflow;

    @OneToMany(mappedBy = "execution", cascade = CascadeType.ALL)
    private List<AlerteTechnique> alertesTechniques = new ArrayList<>();
}
