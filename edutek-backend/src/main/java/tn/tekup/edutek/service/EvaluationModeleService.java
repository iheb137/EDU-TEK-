package tn.tekup.edutek.service;

import tn.tekup.edutek.dto.EvaluationModeleDto;
import tn.tekup.edutek.dto.EvaluationResultDto;
import tn.tekup.edutek.dto.ModeleIaDto;
import tn.tekup.edutek.entity.Classe;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.ModeleIA;
import tn.tekup.edutek.entity.PredictionIA;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.ClasseRepository;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.PredictionIARepository;
import tn.tekup.edutek.repository.SemestreRepository;
import tn.tekup.edutek.util.MetriquesClassification;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EvaluationModeleService {

    public static final int ECHANTILLON_MIN = 30;
    private static final String AVERTISSEMENT = "Les resultats reels sont calcules a partir des notes actuelles : "
            + "cette evaluation n'est fiable que si le semestre est termine. "
            + "En dessous de " + ECHANTILLON_MIN + " etudiants, les metriques ne permettent pas de conclure.";

    private final PredictionIARepository predictionRepository;
    private final ResultatService resultatService;
    private final SemestreRepository semestreRepository;
    private final ClasseRepository classeRepository;
    private final EnseignementRepository enseignementRepository;
    private final PredictionService predictionService;

    @Transactional
    public EvaluationResultDto evaluer(Long semestreId, Long classeId, Double seuilDemande) {
        Semestre sem = semestreRepository.findById(semestreId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + semestreId));
        if (classeId != null && !classeRepository.existsById(classeId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Classe introuvable : " + classeId);
        }
        double seuil = seuilDemande != null ? seuilDemande : predictionService.parametres().getSeuilMoyen();
        if (!(seuil > 0 && seuil < 1)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seuil invalide : 0 < seuil < 1");
        }

        // Derniere prediction de chaque etudiant, pour chaque modele.
        Map<Long, Map<Long, PredictionIA>> parModele = new LinkedHashMap<>();
        for (PredictionIA p : predictionRepository.findAllByOrderByDatePredictionDescIdDesc()) {
            if (p.getSemestre() == null || !p.getSemestre().getId().equals(semestreId)) {
                continue;
            }
            if (classeId != null) {
                Classe c = p.getEtudiant().getClasse();
                if (c == null || !c.getId().equals(classeId)) {
                    continue;
                }
            }
            parModele.computeIfAbsent(p.getModeleIA().getId(), k -> new LinkedHashMap<>())
                    .putIfAbsent(p.getEtudiant().getId(), p);
        }

        Map<Long, String> decisions = new HashMap<>();
        List<EvaluationModeleDto> resultats = new ArrayList<>();
        for (Map<Long, PredictionIA> predictions : parModele.values()) {
            ModeleIA modele = predictions.values().iterator().next().getModeleIA();
            List<Double> probabilites = new ArrayList<>();
            List<Boolean> reels = new ArrayList<>();
            int exclus = 0;
            for (PredictionIA p : predictions.values()) {
                String decision = decisions.computeIfAbsent(p.getEtudiant().getId(), id -> decision(p.getEtudiant(), sem));
                if ("ADMIS".equals(decision) || "AJOURNE".equals(decision)) {
                    probabilites.add(p.getProbabilite());
                    reels.add("AJOURNE".equals(decision));
                } else {
                    exclus++;
                }
            }
            double[] pr = probabilites.stream().mapToDouble(Double::doubleValue).toArray();
            boolean[] re = new boolean[reels.size()];
            for (int i = 0; i < re.length; i++) {
                re[i] = reels.get(i);
            }
            MetriquesClassification.Resultat m = MetriquesClassification.calculer(pr, re, seuil);
            resultats.add(new EvaluationModeleDto(ModeleIaDto.from(modele), m.n(), exclus,
                    m.n() >= ECHANTILLON_MIN, m.positifsReels(), m.vp(), m.fp(), m.vn(), m.fn(),
                    m.precision(), m.rappel(), m.f1(), m.exactitude(), m.brier(), m.auc()));
        }
        resultats.sort((x, y) -> {
            int c = Double.compare(y.f1() == null ? -1 : y.f1(), x.f1() == null ? -1 : x.f1());
            return c != 0 ? c : Long.compare(y.modele().id(), x.modele().id());
        });
        return new EvaluationResultDto(semestreId, classeId, seuil, AVERTISSEMENT, resultats);
    }

    /** Decision reelle (ADMIS, AJOURNE, INCOMPLET) ; INCONNU si le bulletin ne peut pas etre calcule. */
    private String decision(Etudiant etu, Semestre sem) {
        if (etu.getClasse() == null
                || enseignementRepository.findByClasseIdAndSemestreId(etu.getClasse().getId(), sem.getId()).isEmpty()) {
            return "INCONNU";
        }
        return resultatService.bulletin(etu, sem).decision();
    }
}