package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.ActionDto;
import tn.tekup.edutek.dto.ActionRequest;
import tn.tekup.edutek.dto.ActionStatutRequest;
import tn.tekup.edutek.dto.AlerteDto;
import tn.tekup.edutek.dto.StatutRequest;
import tn.tekup.edutek.entity.ActionAccompagnement;
import tn.tekup.edutek.entity.AdminPedagogique;
import tn.tekup.edutek.entity.AlerteRisque;
import tn.tekup.edutek.repository.ActionAccompagnementRepository;
import tn.tekup.edutek.repository.AdminPedagogiqueRepository;
import tn.tekup.edutek.repository.AlerteRisqueRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/ia")
@RequiredArgsConstructor
public class AlerteRisqueController {

    private static final String GESTION = "hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')";
    private static final String PEDAGOGIE = "hasRole('ADMIN_PEDAGOGIQUE')";
    private static final List<String> STATUTS_ALERTE = List.of("OUVERTE", "EN_COURS", "TRAITEE", "CLASSEE");
    private static final List<String> NIVEAUX = List.of("FAIBLE", "MOYEN", "ELEVE");
    private static final List<String> TYPES_ACTION = List.of("ENTRETIEN", "TUTORAT", "ORIENTATION", "SOUTIEN_PEDAGOGIQUE", "AUTRE");
    private static final Map<String, Set<String>> TRANSITIONS_ALERTE = Map.of(
            "OUVERTE", Set.of("EN_COURS", "TRAITEE", "CLASSEE"),
            "EN_COURS", Set.of("TRAITEE", "CLASSEE"));
    private static final Map<String, Set<String>> TRANSITIONS_ACTION = Map.of(
            "PLANIFIEE", Set.of("EN_COURS", "TERMINEE", "ANNULEE"),
            "EN_COURS", Set.of("TERMINEE", "ANNULEE"));

    private final AlerteRisqueRepository alerteRepository;
    private final ActionAccompagnementRepository actionRepository;
    private final AdminPedagogiqueRepository adminPedagogiqueRepository;

    @GetMapping("/alertes")
    @Transactional(readOnly = true)
    @PreAuthorize(GESTION)
    public List<AlerteDto> lister(@RequestParam(required = false) String statut,
                                  @RequestParam(required = false) String niveau,
                                  @RequestParam(required = false) Long semestreId) {
        String s = normaliser(statut, STATUTS_ALERTE, "Statut");
        String n = normaliser(niveau, NIVEAUX, "Niveau");
        return alerteRepository.findAllByOrderByDateDetectionDescIdDesc().stream()
                .filter(a -> s == null || a.getStatut().equals(s))
                .filter(a -> n == null || a.getNiveau().equals(n))
                .filter(a -> semestreId == null || (a.getPrediction().getSemestre() != null
                        && a.getPrediction().getSemestre().getId().equals(semestreId)))
                .map(AlerteDto::from).toList();
    }

    @GetMapping("/alertes/{id}")
    @Transactional(readOnly = true)
    @PreAuthorize(GESTION)
    public AlerteDto detail(@PathVariable Long id) {
        return AlerteDto.from(alerteRepository.findById(id).orElseThrow(() -> alerteIntrouvable(id)));
    }

    @PatchMapping("/alertes/{id}/statut")
    @Transactional
    @PreAuthorize(PEDAGOGIE)
    public AlerteDto changerStatut(@PathVariable Long id, @Valid @RequestBody StatutRequest req) {
        AlerteRisque a = alerteRepository.findByIdForUpdate(id).orElseThrow(() -> alerteIntrouvable(id));
        String nouveau = normaliser(req.statut(), STATUTS_ALERTE, "Statut");
        if (nouveau.equals(a.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'alerte est deja au statut " + nouveau);
        }
        if (!TRANSITIONS_ALERTE.getOrDefault(a.getStatut(), Set.of()).contains(nouveau)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Transition impossible : " + a.getStatut() + " vers " + nouveau);
        }
        a.setStatut(nouveau);
        return AlerteDto.from(a);
    }

    @GetMapping("/alertes/{id}/actions")
    @Transactional(readOnly = true)
    @PreAuthorize(GESTION)
    public List<ActionDto> actions(@PathVariable Long id) {
        if (!alerteRepository.existsById(id)) {
            throw alerteIntrouvable(id);
        }
        return actionRepository.findByAlerteRisqueIdOrderByDateCreationDescIdDesc(id).stream().map(ActionDto::from).toList();
    }

    @PostMapping("/alertes/{id}/actions")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(PEDAGOGIE)
    public ActionDto creerAction(@PathVariable Long id, @Valid @RequestBody ActionRequest req, Authentication auth) {
        AlerteRisque a = alerteRepository.findByIdForUpdate(id).orElseThrow(() -> alerteIntrouvable(id));
        if (!"OUVERTE".equals(a.getStatut()) && !"EN_COURS".equals(a.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Alerte cloturee : action impossible");
        }
        String type = normaliser(req.type(), TYPES_ACTION, "Type");
        AdminPedagogique auteur = adminPedagogiqueRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur pedagogique introuvable"));
        ActionAccompagnement action = new ActionAccompagnement();
        action.setAlerteRisque(a);
        action.setType(type);
        action.setDescription(req.description().trim());
        action.setCreePar(auteur);
        ActionAccompagnement saved = actionRepository.save(action);
        if ("OUVERTE".equals(a.getStatut())) {
            a.setStatut("EN_COURS");
        }
        return ActionDto.from(saved);
    }

    @PatchMapping("/actions/{id}")
    @Transactional
    @PreAuthorize(PEDAGOGIE)
    public ActionDto changerStatutAction(@PathVariable Long id, @Valid @RequestBody ActionStatutRequest req) {
        ActionAccompagnement action = actionRepository.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Action introuvable : " + id));
        List<String> statuts = List.of("PLANIFIEE", "EN_COURS", "TERMINEE", "ANNULEE");
        String nouveau = normaliser(req.statut(), statuts, "Statut");
        if (nouveau.equals(action.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'action est deja au statut " + nouveau);
        }
        if (!TRANSITIONS_ACTION.getOrDefault(action.getStatut(), Set.of()).contains(nouveau)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Transition impossible : " + action.getStatut() + " vers " + nouveau);
        }
        action.setStatut(nouveau);
        if (req.description() != null && !req.description().isBlank()) {
            action.setDescription(req.description().trim());
        }
        return ActionDto.from(action);
    }

    private String normaliser(String valeur, List<String> admises, String libelle) {
        if (valeur == null || valeur.isBlank()) {
            return null;
        }
        String v = valeur.trim().toUpperCase(Locale.ROOT);
        if (!admises.contains(v)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    libelle + " invalide. Valeurs : " + String.join(", ", admises));
        }
        return v;
    }

    private ResponseStatusException alerteIntrouvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Alerte introuvable : " + id);
    }
}