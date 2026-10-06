package tn.tekup.edutek.service;

import tn.tekup.edutek.dto.BulletinDto;
import tn.tekup.edutek.dto.LigneMatiereDto;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.entity.Matiere;
import tn.tekup.edutek.entity.Note;
import tn.tekup.edutek.entity.ResultatSemestre;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.EvaluationRepository;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.repository.ResultatSemestreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResultatService {

    private static final double SEUIL = 10.0;

    private final EnseignementRepository enseignementRepository;
    private final EvaluationRepository evaluationRepository;
    private final NoteRepository noteRepository;
    private final ResultatSemestreRepository resultatRepository;

    @Transactional(readOnly = true)
    public BulletinDto bulletin(Etudiant etu, Semestre sem) {
        if (etu.getClasse() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'etudiant n'est affecte a aucune classe");
        }
        List<Enseignement> enseignements = enseignementRepository
                .findByClasseIdAndSemestreId(etu.getClasse().getId(), sem.getId());
        if (enseignements.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Aucun enseignement pour la classe de cet etudiant dans ce semestre");
        }

        // Une matiere peut avoir plusieurs enseignements (cours, TP...) : on les regroupe
        Map<Long, List<Enseignement>> parMatiere = new LinkedHashMap<>();
        for (Enseignement e : enseignements) {
            parMatiere.computeIfAbsent(e.getMatiere().getId(), k -> new ArrayList<>()).add(e);
        }

        List<LigneMatiereDto> lignes = new ArrayList<>();
        double sommePonderee = 0;
        double sommeCoefMatieres = 0;
        int credits = 0;
        boolean incomplet = false;

        for (List<Enseignement> groupe : parMatiere.values()) {
            Matiere m = groupe.get(0).getMatiere();
            double totalNotes = 0;
            double totalCoefEval = 0;

            for (Enseignement ens : groupe) {
                Map<Long, Note> notesParEval = noteRepository
                        .findByEtudiantIdAndEvaluationEnseignementId(etu.getId(), ens.getId()).stream()
                        .collect(Collectors.toMap(x -> x.getEvaluation().getId(), x -> x, (a, b) -> a));

                for (Evaluation ev : evaluationRepository.findByEnseignementId(ens.getId())) {
                    Note note = notesParEval.get(ev.getId());
                    if (note == null || note.getValeur() == null) {
                        continue;
                    }
                    double coefEval = ev.getCoefficient() != null ? ev.getCoefficient() : 1.0;
                    totalNotes += note.getValeur() * coefEval;
                    totalCoefEval += coefEval;
                }
            }

            double coefMatiere = m.getCoefficient() != null ? m.getCoefficient() : 1.0;
            int creditsMatiere = m.getCredits() != null ? m.getCredits() : 0;
            Double moyenneMatiere = totalCoefEval > 0 ? arrondi(totalNotes / totalCoefEval) : null;
            boolean valide = moyenneMatiere != null && moyenneMatiere >= SEUIL;

            if (moyenneMatiere == null) {
                incomplet = true;
            } else {
                sommePonderee += moyenneMatiere * coefMatiere;
                sommeCoefMatieres += coefMatiere;
                if (valide) {
                    credits += creditsMatiere;
                }
            }
            lignes.add(new LigneMatiereDto(m.getId(), m.getCode(), m.getNom(),
                    coefMatiere, creditsMatiere, moyenneMatiere, valide));
        }

        Double moyenne = sommeCoefMatieres > 0 ? arrondi(sommePonderee / sommeCoefMatieres) : null;
        String decision = (incomplet || moyenne == null)
                ? "INCOMPLET"
                : (moyenne >= SEUIL ? "ADMIS" : "AJOURNE");

        return new BulletinDto(sem.getId(), sem.getNom(), etu.getId(), moyenne, credits, decision, lignes);
    }

    @Transactional
    public ResultatSemestre calculerEtEnregistrer(Etudiant etu, Semestre sem) {
        BulletinDto b = bulletin(etu, sem);
        ResultatSemestre r = resultatRepository.findByEtudiantIdAndSemestreId(etu.getId(), sem.getId())
                .orElseGet(ResultatSemestre::new);
        r.setEtudiant(etu);
        r.setSemestre(sem);
        r.setMoyenne(b.moyenne());
        r.setDecision(b.decision());
        r.setCreditsObtenus(b.creditsObtenus());
        return resultatRepository.save(r);
    }

    private static double arrondi(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}