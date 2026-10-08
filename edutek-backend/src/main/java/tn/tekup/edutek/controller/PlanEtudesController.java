package tn.tekup.edutek.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.Formation;
import tn.tekup.edutek.entity.Matiere;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.FormationRepository;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/** Plan d'etudes d'une formation : semestres et matieres (coefficients, credits). */
@RestController
@RequestMapping("/api/formations/{formationId}/plan-etudes")
@RequiredArgsConstructor
public class PlanEtudesController {

    public record MatiereLigne(Long id, String code, String nom, Double coefficient, Integer credits) {}

    public record SemestrePlan(Long id, String nom, LocalDate dateDebut, LocalDate dateFin, int totalCredits,
                               List<MatiereLigne> matieres) {}

    public record PlanEtudes(Long formationId, String code, String nom, String niveau, int totalCredits,
                             List<SemestrePlan> semestres) {}

    private final FormationRepository formationRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public PlanEtudes plan(@PathVariable Long formationId) {
        Formation f = formationRepository.findById(formationId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable : " + formationId));
        List<SemestrePlan> semestres = f.getSemestres().stream()
                .sorted(Comparator.comparing(Semestre::getDateDebut, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Semestre::getId))
                .map(s -> {
                    List<MatiereLigne> matieres = s.getMatieres().stream()
                            .sorted(Comparator.comparing(Matiere::getCode))
                            .map(m -> new MatiereLigne(m.getId(), m.getCode(), m.getNom(), m.getCoefficient(),
                                    m.getCredits() != null ? m.getCredits() : 0))
                            .toList();
                    int total = matieres.stream().mapToInt(MatiereLigne::credits).sum();
                    return new SemestrePlan(s.getId(), s.getNom(), s.getDateDebut(), s.getDateFin(), total, matieres);
                }).toList();
        int total = semestres.stream().mapToInt(SemestrePlan::totalCredits).sum();
        return new PlanEtudes(f.getId(), f.getCode(), f.getNom(), f.getNiveau(), total, semestres);
    }
}