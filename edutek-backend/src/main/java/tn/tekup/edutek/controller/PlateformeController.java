package tn.tekup.edutek.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.config.EtablissementFilter;
import tn.tekup.edutek.entity.Etablissement;
import tn.tekup.edutek.repository.EtablissementRepository;
import tn.tekup.edutek.service.AuditService;
import tn.tekup.edutek.service.EtablissementService;
import tn.tekup.edutek.util.EtablissementContexte;

import java.time.LocalDateTime;
import java.util.List;

/** Gestion des etablissements : reservee au SuperAdmin de l'etablissement "plateforme". */
@RestController
@RequestMapping("/api/plateforme/etablissements")
@PreAuthorize("hasRole('SUPERADMIN')")
@RequiredArgsConstructor
public class PlateformeController {

    public record EtablissementRequest(
            @NotBlank @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,39}$",
                    message = "Code : 2 a 40 caracteres, minuscules, chiffres et tirets") String code,
            @NotBlank @Size(max = 200) String nom,
            @NotBlank @Email String adminEmail,
            @NotBlank @Size(min = 8, max = 64) String adminMotDePasse) {}

    public record ActifRequest(@NotNull Boolean actif) {}

    public record EtablissementDto(Long id, String code, String nom, boolean actif, LocalDateTime dateCreation) {
        static EtablissementDto from(Etablissement e) {
            return new EtablissementDto(e.getId(), e.getCode(), e.getNom(),
                    Boolean.TRUE.equals(e.getActif()), e.getDateCreation());
        }
    }

    private final EtablissementRepository etablissementRepository;
    private final EtablissementService etablissementService;
    private final EtablissementFilter etablissementFilter;
    private final AuditService audit;

    @GetMapping
    public List<EtablissementDto> lister() {
        verifierPlateforme();
        return etablissementRepository.findAll().stream()
                .map(EtablissementDto::from)
                .sorted((a, b) -> a.code().compareTo(b.code()))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EtablissementDto creer(@Valid @RequestBody EtablissementRequest req) {
        verifierPlateforme();
        if (etablissementRepository.existsByCode(req.code())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Etablissement deja existant : " + req.code());
        }
        if (etablissementRepository.emailExisteGlobalement(req.adminEmail().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email deja utilise : " + req.adminEmail());
        }
        Etablissement e = etablissementService.assurer(req.code(), req.nom().trim(),
                req.adminEmail(), req.adminMotDePasse(), true);
        audit.log("ETABLISSEMENT_CREE", "Etablissement", e.getId(), req.code());
        return EtablissementDto.from(e);
    }

    @PatchMapping("/{code}/actif")
    public EtablissementDto changerActif(@PathVariable String code, @Valid @RequestBody ActifRequest req) {
        verifierPlateforme();
        if (EtablissementContexte.PLATEFORME.equals(code)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'etablissement plateforme ne peut pas etre desactive");
        }
        Etablissement e = etablissementRepository.findByCode(code).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Etablissement introuvable : " + code));
        e.setActif(req.actif());
        etablissementRepository.save(e);
        etablissementFilter.oublier(code);
        audit.log(req.actif() ? "ETABLISSEMENT_ACTIVE" : "ETABLISSEMENT_DESACTIVE", "Etablissement", e.getId(), code);
        return EtablissementDto.from(e);
    }

    private void verifierPlateforme() {
        if (!EtablissementContexte.PLATEFORME.equals(EtablissementContexte.courant())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Reserve a l'administration de la plateforme");
        }
    }
}