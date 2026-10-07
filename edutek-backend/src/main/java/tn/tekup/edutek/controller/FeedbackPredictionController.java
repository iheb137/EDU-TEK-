package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.FeedbackDto;
import tn.tekup.edutek.dto.FeedbackRequest;
import tn.tekup.edutek.entity.AdminPedagogique;
import tn.tekup.edutek.entity.FeedbackPrediction;
import tn.tekup.edutek.entity.PredictionIA;
import tn.tekup.edutek.repository.AdminPedagogiqueRepository;
import tn.tekup.edutek.repository.FeedbackPredictionRepository;
import tn.tekup.edutek.repository.PredictionIARepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/ia/predictions/{predictionId}/feedbacks")
@RequiredArgsConstructor
public class FeedbackPredictionController {

    private static final String GESTION = "hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')";
    private static final String PEDAGOGIE = "hasRole('ADMIN_PEDAGOGIQUE')";

    private final FeedbackPredictionRepository feedbackRepository;
    private final PredictionIARepository predictionRepository;
    private final AdminPedagogiqueRepository adminPedagogiqueRepository;

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize(GESTION)
    public List<FeedbackDto> lister(@PathVariable Long predictionId) {
        if (!predictionRepository.existsById(predictionId)) {
            throw introuvable(predictionId);
        }
        return feedbackRepository.findByPredictionIdOrderByDateAvisDescIdDesc(predictionId).stream()
                .map(FeedbackDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(PEDAGOGIE)
    public FeedbackDto donnerAvis(@PathVariable Long predictionId, @Valid @RequestBody FeedbackRequest req,
                                  Authentication auth) {
        PredictionIA prediction = predictionRepository.findById(predictionId).orElseThrow(() -> introuvable(predictionId));
        AdminPedagogique auteur = adminPedagogiqueRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur pedagogique introuvable"));
        FeedbackPrediction f = new FeedbackPrediction();
        f.setPrediction(prediction);
        f.setAuteur(auteur);
        f.setPertinent(req.pertinent());
        f.setCommentaire(req.commentaire() == null || req.commentaire().isBlank() ? null : req.commentaire().trim());
        return FeedbackDto.from(feedbackRepository.save(f));
    }

    private ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Prediction introuvable : " + id);
    }
}