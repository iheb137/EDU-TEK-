package tn.tekup.edutek.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.dto.ResultatSemestreDto;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.ResultatSemestre;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.repository.ResultatSemestreRepository;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/** Calcul officiel d'un semestre (moyennes, rangs) puis publication par l'administration pedagogique. */
@Service
@RequiredArgsConstructor
public class ResultatPublicationService {

    public record LigneAvancement(Long enseignementId, String matiere, String classe, String enseignant,
                                  boolean cloture, long brouillons, long soumises) {}

    private final EnseignementRepository enseignementRepository;
    private final EtudiantRepository etudiantRepository;
    private final ResultatSemestreRepository resultatRepository;
    private final NoteRepository noteRepository;
    private final ResultatService resultatService;
    private final NotificationService notificationService;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<LigneAvancement> avancement(Long semestreId) {
        return enseignementRepository.findBySemestreId(semestreId).stream().map(e -> {
            long brouillons = noteRepository.countByEvaluationEnseignementIdAndStatut(e.getId(), "BROUILLON");
            long total = noteRepository.countByEvaluationEnseignementId(e.getId());
            return new LigneAvancement(e.getId(), e.getMatiere().getNom(), e.getClasse().getCode(),
                    e.getEnseignant().getPrenom() + " " + e.getEnseignant().getNom(),
                    e.getDateCloture() != null, brouillons, total - brouillons);
        }).toList();
    }

    /** Calcule moyennes, decisions et rangs (classe et filiere) de tous les etudiants du semestre. */
    @Transactional
    public List<ResultatSemestreDto> calculer(Semestre sem) {
        List<Enseignement> enseignements = enseignementRepository.findBySemestreId(sem.getId());
        if (enseignements.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun enseignement n'est affecte dans ce semestre");
        }
        List<String> ouverts = enseignements.stream().filter(e -> e.getDateCloture() == null)
                .map(e -> e.getMatiere().getNom() + " / " + e.getClasse().getCode()).toList();
        if (!ouverts.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Enseignements non clotures : " + ouverts);
        }
        Set<Long> classes = enseignements.stream().map(e -> e.getClasse().getId())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<ResultatSemestre> resultats = new ArrayList<>();
        for (Long classeId : classes) {
            for (Etudiant etu : etudiantRepository.findByClasseId(classeId)) {
                ResultatSemestre r = resultatService.calculerEtEnregistrer(etu, sem);
                r.setStatut("CALCULE");
                r.setDatePublication(null);
                resultats.add(r);
            }
        }
        resultats.stream().collect(Collectors.groupingBy(r -> r.getEtudiant().getClasse().getId()))
                .values().forEach(g -> attribuerRangs(g, true));
        resultats.stream().collect(Collectors.groupingBy(r ->
                        Objects.toString(r.getEtudiant().getClasse().getAnneeUniversitaire(), "")))
                .values().forEach(g -> attribuerRangs(g, false));
        resultatRepository.saveAll(resultats);
        audit.log("RESULTATS_CALCULES", "Semestre", sem.getId(), resultats.size() + " etudiant(s)");
        return resultats.stream().map(ResultatSemestreDto::from).toList();
    }

    /** Publie les resultats calcules : l'etudiant voit alors sa moyenne et ses rangs, et en est prevenu. */
    @Transactional
    public int publier(Semestre sem) {
        List<ResultatSemestre> tous = resultatRepository.findBySemestreId(sem.getId());
        if (tous.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Aucun resultat calcule pour ce semestre");
        }
        if (tous.stream().anyMatch(r -> "A_RECALCULER".equals(r.getStatut()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Des notes ont change : recalculez le semestre avant de publier");
        }
        if (enseignementRepository.findBySemestreId(sem.getId()).stream().anyMatch(e -> e.getDateCloture() == null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un enseignement du semestre n'est plus cloture");
        }
        int publies = 0;
        for (ResultatSemestre r : tous) {
            if ("PUBLIE".equals(r.getStatut())) {
                continue;
            }
            r.setStatut("PUBLIE");
            r.setDatePublication(LocalDateTime.now());
            resultatRepository.save(r);
            notificationService.notifier(r.getEtudiant(), "Resultats publies", resume(sem, r));
            publies++;
        }
        if (publies == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Resultats deja publies");
        }
        audit.log("RESULTATS_PUBLIES", "Semestre", sem.getId(), publies + " etudiant(s)");
        return publies;
    }

    private static String resume(Semestre sem, ResultatSemestre r) {
        StringBuilder sb = new StringBuilder(sem.getNom()).append(" : moyenne ").append(r.getMoyenne());
        if (r.getRangClasse() != null) {
            sb.append(", rang classe ").append(r.getRangClasse()).append("/").append(r.getEffectifClasse());
        }
        if (r.getRangFiliere() != null) {
            sb.append(", rang filiere ").append(r.getRangFiliere()).append("/").append(r.getEffectifFiliere());
        }
        return sb.append(" (").append(r.getDecision()).append(")").toString();
    }

    /** Rang 1,1,3 en cas d'egalite. Seuls les etudiants ADMIS ou AJOURNE sont classes (pas les INCOMPLET). */
    private static void attribuerRangs(List<ResultatSemestre> groupe, boolean classe) {
        List<ResultatSemestre> classes = groupe.stream()
                .filter(r -> r.getMoyenne() != null && ("ADMIS".equals(r.getDecision()) || "AJOURNE".equals(r.getDecision())))
                .sorted(Comparator.comparingDouble(ResultatSemestre::getMoyenne).reversed())
                .toList();
        for (ResultatSemestre r : groupe) {
            if (classe) {
                r.setRangClasse(null);
                r.setEffectifClasse(classes.size());
            } else {
                r.setRangFiliere(null);
                r.setEffectifFiliere(classes.size());
            }
        }
        int rang = 0;
        Double precedent = null;
        for (int i = 0; i < classes.size(); i++) {
            Double m = classes.get(i).getMoyenne();
            if (precedent == null || Double.compare(m, precedent) != 0) {
                rang = i + 1;
            }
            precedent = m;
            if (classe) {
                classes.get(i).setRangClasse(rang);
            } else {
                classes.get(i).setRangFiliere(rang);
            }
        }
    }
}