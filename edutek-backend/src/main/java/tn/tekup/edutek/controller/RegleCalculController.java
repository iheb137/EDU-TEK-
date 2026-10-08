package tn.tekup.edutek.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.Formation;
import tn.tekup.edutek.entity.RegleCalcul;
import tn.tekup.edutek.repository.FormationRepository;
import tn.tekup.edutek.repository.RegleCalculRepository;
import tn.tekup.edutek.service.AuditService;
import tn.tekup.edutek.service.RegleCalculService;

import java.util.Objects;

/** Regles de calcul d'une formation : lecture pour tous, modification par l'administration pedagogique. */
@RestController
@RequestMapping("/api/formations/{formationId}/regles")
@RequiredArgsConstructor
public class RegleCalculController {

    public record ReglesRequest(
            @NotNull @Positive Double noteMax,
            @NotNull @Positive Double seuilAdmission,
            @PositiveOrZero Double noteEliminatoire,
            @NotNull Boolean compensation,
            @NotNull @Min(0) @Max(3) Integer decimales) {}

    public record ReglesDto(Long formationId, Double noteMax, Double seuilAdmission, Double noteEliminatoire,
                            Boolean compensation, Integer decimales, boolean verrouillee, boolean parDefaut) {}

    private final FormationRepository formationRepository;
    private final RegleCalculRepository regleRepository;
    private final RegleCalculService service;
    private final AuditService audit;

    @GetMapping
    @Transactional(readOnly = true)
    public ReglesDto lire(@PathVariable Long formationId) {
        Formation f = formation(formationId);
        return dto(f.getId(), service.pour(f));
    }

    @PutMapping
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public ReglesDto modifier(@PathVariable Long formationId, @Valid @RequestBody ReglesRequest req) {
        Formation f = formation(formationId);
        if (req.noteMax() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bareme trop grand (1000 maximum)");
        }
        if (req.seuilAdmission() > req.noteMax()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le seuil d'admission depasse le bareme");
        }
        if (req.noteEliminatoire() != null && req.noteEliminatoire() > req.seuilAdmission()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La note eliminatoire depasse le seuil d'admission");
        }
        RegleCalcul actuelle = regleRepository.findByFormationId(formationId).orElse(null);
        RegleCalcul base = actuelle != null ? actuelle : new RegleCalcul();
        boolean identique = Objects.equals(base.getNoteMax(), req.noteMax())
                && Objects.equals(base.getSeuilAdmission(), req.seuilAdmission())
                && Objects.equals(base.getNoteEliminatoire(), req.noteEliminatoire())
                && Objects.equals(base.getCompensation(), req.compensation())
                && Objects.equals(base.getDecimales(), req.decimales());
        if (!identique && service.verrouillee(formationId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Regles verrouillees : des notes existent deja dans cette formation");
        }
        if (!identique) {
            RegleCalcul r = actuelle != null ? actuelle : new RegleCalcul();
            r.setFormation(f);
            r.setNoteMax(req.noteMax());
            r.setSeuilAdmission(req.seuilAdmission());
            r.setNoteEliminatoire(req.noteEliminatoire());
            r.setCompensation(req.compensation());
            r.setDecimales(req.decimales());
            regleRepository.save(r);
            audit.log("REGLES_CALCUL_MODIFIEES", "Formation", formationId,
                    "bareme=" + req.noteMax() + " seuil=" + req.seuilAdmission() + " eliminatoire="
                            + req.noteEliminatoire() + " compensation=" + req.compensation() + " decimales=" + req.decimales());
        }
        return dto(formationId, regleRepository.findByFormationId(formationId).orElse(base));
    }

    private ReglesDto dto(Long formationId, RegleCalcul r) {
        return new ReglesDto(formationId, r.getNoteMax(), r.getSeuilAdmission(), r.getNoteEliminatoire(),
                r.getCompensation(), r.getDecimales(), service.verrouillee(formationId), service.parDefaut(formationId));
    }

    private Formation formation(Long id) {
        return formationRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable : " + id));
    }
}