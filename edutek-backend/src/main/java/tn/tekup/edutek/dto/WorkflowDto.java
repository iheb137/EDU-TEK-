package tn.tekup.edutek.dto;

import java.time.LocalDateTime;

public record WorkflowDto(Long id, String nom, boolean actif, LocalDateTime dateCreation,
                          String dernierStatut, LocalDateTime derniereExecution, long nbExecutions, long nbEchecs) {}