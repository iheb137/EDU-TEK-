package tn.tekup.edutek.service;

import tn.tekup.edutek.dto.TableauDeBordDto;
import tn.tekup.edutek.entity.ActionAccompagnement;
import tn.tekup.edutek.entity.AlerteRisque;
import tn.tekup.edutek.entity.Classe;
import tn.tekup.edutek.entity.FeedbackPrediction;
import tn.tekup.edutek.entity.PredictionIA;
import tn.tekup.edutek.repository.AlerteRisqueRepository;
import tn.tekup.edutek.repository.ClasseRepository;
import tn.tekup.edutek.repository.FeedbackPredictionRepository;
import tn.tekup.edutek.repository.PredictionIARepository;
import tn.tekup.edutek.repository.SemestreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TableauDeBordService {

    private final PredictionIARepository predictionRepository;
    private final AlerteRisqueRepository alerteRepository;
    private final FeedbackPredictionRepository feedbackRepository;
    private final SemestreRepository semestreRepository;
    private final ClasseRepository classeRepository;

    private static final class Agregat {
        String nom;
        int total;
        int eleve;
        int moyen;
        double somme;
    }

    @Transactional(readOnly = true)
    public TableauDeBordDto construire(Long semestreId, Long classeId) {
        if (!semestreRepository.existsById(semestreId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + semestreId);
        }
        if (classeId != null && !classeRepository.existsById(classeId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Classe introuvable : " + classeId);
        }

        // Derniere prediction de chaque etudiant dans le perimetre.
        Map<Long, PredictionIA> dernieres = new LinkedHashMap<>();
        for (PredictionIA p : predictionRepository.findAllByOrderByDatePredictionDescIdDesc()) {
            if (dansPerimetre(p, semestreId, classeId)) {
                dernieres.putIfAbsent(p.getEtudiant().getId(), p);
            }
        }

        int faible = 0;
        int moyen = 0;
        int eleve = 0;
        double somme = 0;
        LocalDateTime derniere = null;
        Map<String, Integer> facteurs = new HashMap<>();
        Map<Long, Agregat> classes = new LinkedHashMap<>();

        for (PredictionIA p : dernieres.values()) {
            String niveau = p.getNiveau() == null ? "" : p.getNiveau();
            if (niveau.equals("ELEVE")) {
                eleve++;
            } else if (niveau.equals("MOYEN")) {
                moyen++;
            } else if (niveau.equals("FAIBLE")) {
                faible++;
            }
            double proba = p.getProbabilite() == null ? 0 : p.getProbabilite();
            somme += proba;
            if (derniere == null || (p.getDatePrediction() != null && p.getDatePrediction().isAfter(derniere))) {
                derniere = p.getDatePrediction();
            }
            if (!niveau.equals("FAIBLE")) {
                p.getFacteurs().stream()
                        .filter(f -> f.getContribution() != null && f.getContribution() > 0)
                        .findFirst()
                        .ifPresent(f -> facteurs.merge(f.getNom(), 1, Integer::sum));
            }
            Classe c = p.getEtudiant().getClasse();
            if (c != null) {
                Agregat ag = classes.computeIfAbsent(c.getId(), k -> new Agregat());
                ag.nom = c.getNom();
                ag.total++;
                ag.somme += proba;
                if (niveau.equals("ELEVE")) {
                    ag.eleve++;
                } else if (niveau.equals("MOYEN")) {
                    ag.moyen++;
                }
            }
        }

        int ouvertes = 0;
        int enCours = 0;
        int traitees = 0;
        int classees = 0;
        int planifiees = 0;
        int actionsEnCours = 0;
        int terminees = 0;
        int annulees = 0;
        for (AlerteRisque a : alerteRepository.findAllByOrderByDateDetectionDescIdDesc()) {
            if (!dansPerimetre(a.getPrediction(), semestreId, classeId)) {
                continue;
            }
            switch (a.getStatut()) {
                case "OUVERTE" -> ouvertes++;
                case "EN_COURS" -> enCours++;
                case "TRAITEE" -> traitees++;
                case "CLASSEE" -> classees++;
                default -> { }
            }
            for (ActionAccompagnement ac : a.getActions()) {
                switch (ac.getStatut()) {
                    case "PLANIFIEE" -> planifiees++;
                    case "EN_COURS" -> actionsEnCours++;
                    case "TERMINEE" -> terminees++;
                    case "ANNULEE" -> annulees++;
                    default -> { }
                }
            }
        }

        int avisTotal = 0;
        int avisPertinents = 0;
        for (FeedbackPrediction f : feedbackRepository.findAll()) {
            if (!dansPerimetre(f.getPrediction(), semestreId, classeId)) {
                continue;
            }
            avisTotal++;
            if (Boolean.TRUE.equals(f.getPertinent())) {
                avisPertinents++;
            }
        }

        List<TableauDeBordDto.FacteurFrequent> principaux = facteurs.entrySet().stream()
                .sorted((x, y) -> {
                    int c = Integer.compare(y.getValue(), x.getValue());
                    return c != 0 ? c : x.getKey().compareTo(y.getKey());
                })
                .limit(5)
                .map(e -> new TableauDeBordDto.FacteurFrequent(e.getKey(), e.getValue()))
                .toList();

        List<TableauDeBordDto.ClasseResume> parClasse = new ArrayList<>();
        for (Map.Entry<Long, Agregat> e : classes.entrySet()) {
            Agregat ag = e.getValue();
            parClasse.add(new TableauDeBordDto.ClasseResume(e.getKey(), ag.nom, ag.total, ag.eleve, ag.moyen,
                    arrondi(ag.somme / ag.total)));
        }
        parClasse.sort(Comparator.comparing(TableauDeBordDto.ClasseResume::classeNom,
                Comparator.nullsLast(Comparator.naturalOrder())));

        return new TableauDeBordDto(semestreId, classeId, dernieres.size(),
                new TableauDeBordDto.Repartition(faible, moyen, eleve),
                dernieres.isEmpty() ? null : arrondi(somme / dernieres.size()),
                new TableauDeBordDto.AlertesParStatut(ouvertes, enCours, traitees, classees),
                new TableauDeBordDto.ActionsParStatut(planifiees, actionsEnCours, terminees, annulees),
                new TableauDeBordDto.Feedbacks(avisTotal, avisPertinents),
                principaux, parClasse, derniere);
    }

    private boolean dansPerimetre(PredictionIA p, Long semestreId, Long classeId) {
        if (p.getSemestre() == null || !p.getSemestre().getId().equals(semestreId)) {
            return false;
        }
        if (classeId == null) {
            return true;
        }
        Classe c = p.getEtudiant().getClasse();
        return c != null && c.getId().equals(classeId);
    }

    private static double arrondi(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}