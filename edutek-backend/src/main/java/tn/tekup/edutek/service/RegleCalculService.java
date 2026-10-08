package tn.tekup.edutek.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.entity.Formation;
import tn.tekup.edutek.entity.RegleCalcul;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.repository.RegleCalculRepository;

@Service
@RequiredArgsConstructor
public class RegleCalculService {

    private final RegleCalculRepository regleRepository;
    private final NoteRepository noteRepository;

    /** Regles de la formation, ou valeurs par defaut (20, 10, compensation, 2 decimales) si non configurees. */
    public RegleCalcul pour(Formation formation) {
        return regleRepository.findByFormationId(formation.getId()).orElseGet(RegleCalcul::new);
    }

    public boolean parDefaut(Long formationId) {
        return regleRepository.findByFormationId(formationId).isEmpty();
    }

    /** Regles verrouillees des qu'une note existe dans la formation. */
    public boolean verrouillee(Long formationId) {
        return noteRepository.existsByEvaluationEnseignementClasseFormationId(formationId);
    }

    public void verifierNote(Double valeur, Evaluation evaluation) {
        Formation f = evaluation.getEnseignement().getClasse().getFormation();
        double max = pour(f).getNoteMax();
        if (valeur == null || valeur < 0 || valeur > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La note doit etre comprise entre 0 et " + max + " (bareme de la formation)");
        }
    }
}