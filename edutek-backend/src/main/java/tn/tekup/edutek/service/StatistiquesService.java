package tn.tekup.edutek.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.entity.Note;
import tn.tekup.edutek.entity.RegleCalcul;
import tn.tekup.edutek.entity.ResultatSemestre;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.EvaluationRepository;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.repository.ResultatSemestreRepository;
import tn.tekup.edutek.security.AccesHelper;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/** Statistiques descriptives sur les notes d'une evaluation et sur les resultats d'un semestre. */
@Service
@RequiredArgsConstructor
public class StatistiquesService {

    public record Tranche(String libelle, long nombre) {}

    public record Stats(int effectif, Double moyenne, Double mediane, Double ecartType, Double min, Double max,
                        Double tauxReussite, List<Tranche> distribution) {}

    public record EvaluationStatistiques(Long evaluationId, String type, LocalDate date, int attendus, int saisies,
                                         long brouillons, boolean inclutBrouillons, Double seuilReussite,
                                         Double noteMax, Stats stats) {}

    public record ClasseStatistiques(Long classeId, String code, Stats stats, Map<String, Long> decisions) {}

    public record SemestreStatistiques(Long semestreId, String semestre, Double seuilReussite, Double noteMax,
                                       Stats filiere, Map<String, Long> decisions, List<ClasseStatistiques> classes) {}

    private final EvaluationRepository evaluationRepository;
    private final EtudiantRepository etudiantRepository;
    private final NoteRepository noteRepository;
    private final ResultatSemestreRepository resultatRepository;
    private final RegleCalculService reglesService;
    private final AccesHelper acces;

    @Transactional(readOnly = true)
    public EvaluationStatistiques evaluation(Long id, boolean inclureBrouillons, Authentication auth) {
        Evaluation ev = evaluationRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluation introuvable : " + id));
        acces.verifierProprietaire(auth, ev.getEnseignement());
        RegleCalcul regles = reglesService.pour(ev.getEnseignement().getClasse().getFormation());
        List<Note> notes = noteRepository.findByEvaluationId(id);
        long brouillons = notes.stream().filter(n -> !n.estSoumise()).count();
        List<Double> valeurs = notes.stream()
                .filter(n -> inclureBrouillons || n.estSoumise())
                .map(Note::getValeur).filter(Objects::nonNull).toList();
        int attendus = etudiantRepository.findByClasseId(ev.getEnseignement().getClasse().getId()).size();
        return new EvaluationStatistiques(ev.getId(), ev.getType(), ev.getDate(), attendus, notes.size(), brouillons,
                inclureBrouillons, regles.getSeuilAdmission(), regles.getNoteMax(),
                calculer(valeurs, regles.getSeuilAdmission(), regles.getNoteMax()));
    }

    @Transactional(readOnly = true)
    public SemestreStatistiques semestre(Semestre sem) {
        List<ResultatSemestre> resultats = resultatRepository.findBySemestreId(sem.getId());
        if (resultats.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Aucun resultat calcule pour ce semestre");
        }
        RegleCalcul regles = reglesService.pour(sem.getFormation());
        double seuil = regles.getSeuilAdmission();
        double max = regles.getNoteMax();

        Map<Long, List<ResultatSemestre>> parClasse = resultats.stream()
                .collect(Collectors.groupingBy(r -> r.getEtudiant().getClasse().getId()));
        List<ClasseStatistiques> classes = parClasse.values().stream()
                .map(g -> new ClasseStatistiques(g.get(0).getEtudiant().getClasse().getId(),
                        g.get(0).getEtudiant().getClasse().getCode(),
                        calculer(moyennes(g), seuil, max), decisions(g)))
                .sorted(Comparator.comparing(ClasseStatistiques::code))
                .toList();
        return new SemestreStatistiques(sem.getId(), sem.getNom(), seuil, max,
                calculer(moyennes(resultats), seuil, max), decisions(resultats), classes);
    }

    private static List<Double> moyennes(List<ResultatSemestre> liste) {
        return liste.stream()
                .filter(r -> r.getMoyenne() != null && ("ADMIS".equals(r.getDecision()) || "AJOURNE".equals(r.getDecision())))
                .map(ResultatSemestre::getMoyenne).toList();
    }

    private static Map<String, Long> decisions(List<ResultatSemestre> liste) {
        return liste.stream().collect(Collectors.groupingBy(
                r -> r.getDecision() != null ? r.getDecision() : "INCONNU", TreeMap::new, Collectors.counting()));
    }

    /** Statistiques sur une liste de valeurs ; taux de reussite = part des valeurs au moins egales au seuil. */
    public static Stats calculer(List<Double> valeurs, double seuil, double max) {
        double largeur = max / 5;
        long[] compte = new long[5];
        for (double v : valeurs) {
            int i = (int) Math.floor(v / largeur);
            compte[Math.max(0, Math.min(4, i))]++;
        }
        List<Tranche> distribution = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            distribution.add(new Tranche(format(i * largeur) + "-" + format((i + 1) * largeur), compte[i]));
        }
        int n = valeurs.size();
        if (n == 0) {
            return new Stats(0, null, null, null, null, null, null, distribution);
        }
        List<Double> triees = valeurs.stream().sorted().toList();
        double moyenne = valeurs.stream().mapToDouble(Double::doubleValue).sum() / n;
        double mediane = n % 2 == 1 ? triees.get(n / 2) : (triees.get(n / 2 - 1) + triees.get(n / 2)) / 2;
        double variance = valeurs.stream().mapToDouble(v -> (v - moyenne) * (v - moyenne)).sum() / n;
        long reussis = valeurs.stream().filter(v -> v >= seuil).count();
        return new Stats(n, arrondi(moyenne, 2), arrondi(mediane, 2), arrondi(Math.sqrt(variance), 2),
                triees.get(0), triees.get(n - 1), arrondi(100.0 * reussis / n, 1), distribution);
    }

    private static double arrondi(double v, int decimales) {
        double f = Math.pow(10, decimales);
        return Math.round(v * f) / f;
    }

    private static String format(double x) {
        String s = String.format(Locale.ROOT, "%.1f", x);
        return s.endsWith(".0") ? s.substring(0, s.length() - 2) : s;
    }
}