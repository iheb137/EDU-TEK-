package tn.tekup.edutek.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.EvenementAcademique;
import tn.tekup.edutek.repository.EvenementAcademiqueRepository;
import tn.tekup.edutek.repository.FormationRepository;
import tn.tekup.edutek.service.AuditService;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/** Calendrier scolaire de l'etablissement : lecture pour tous, ecriture par l'administration pedagogique. */
@RestController
@RequestMapping("/api/calendrier/evenements")
@RequiredArgsConstructor
public class EvenementAcademiqueController {

    public static final Set<String> TYPES =
            Set.of("RENTREE", "VACANCES", "FERIE", "FIN_SEMESTRE", "PERIODE_EXAMENS", "AUTRE");

    public record EvenementDto(Long id, @NotBlank String titre, @NotBlank String type, @NotNull LocalDate dateDebut,
                               LocalDate dateFin, String description, Long formationId) {
        static EvenementDto from(EvenementAcademique e) {
            return new EvenementDto(e.getId(), e.getTitre(), e.getType(), e.getDateDebut(), e.getDateFin(),
                    e.getDescription(), e.getFormation() != null ? e.getFormation().getId() : null);
        }
    }

    private final EvenementAcademiqueRepository repository;
    private final FormationRepository formationRepository;
    private final AuditService audit;

    @GetMapping
    @Transactional(readOnly = true)
    public List<EvenementDto> lister(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate du,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate au) {
        LocalDate debut = du != null ? du : LocalDate.of(1900, 1, 1);
        LocalDate fin = au != null ? au : LocalDate.of(2999, 12, 31);
        return repository.findByDateDebutLessThanEqualAndDateFinGreaterThanEqualOrderByDateDebut(fin, debut)
                .stream().map(EvenementDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public EvenementDto creer(@Valid @RequestBody EvenementDto dto) {
        EvenementAcademique e = new EvenementAcademique();
        appliquer(e, dto);
        EvenementAcademique saved = repository.save(e);
        audit.log("EVENEMENT_CALENDRIER_CREE", "EvenementAcademique", saved.getId(), saved.getTitre());
        return EvenementDto.from(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public EvenementDto modifier(@PathVariable Long id, @Valid @RequestBody EvenementDto dto) {
        EvenementAcademique e = trouver(id);
        appliquer(e, dto);
        audit.log("EVENEMENT_CALENDRIER_MODIFIE", "EvenementAcademique", id, e.getTitre());
        return EvenementDto.from(repository.save(e));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public void supprimer(@PathVariable Long id) {
        EvenementAcademique e = trouver(id);
        repository.delete(e);
        audit.log("EVENEMENT_CALENDRIER_SUPPRIME", "EvenementAcademique", id, e.getTitre());
    }

    private EvenementAcademique trouver(Long id) {
        return repository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Evenement introuvable : " + id));
    }

    private void appliquer(EvenementAcademique e, EvenementDto dto) {
        String type = dto.type().trim().toUpperCase();
        if (!TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type invalide. Valeurs : " + TYPES);
        }
        LocalDate fin = dto.dateFin() != null ? dto.dateFin() : dto.dateDebut();
        if (fin.isBefore(dto.dateDebut())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin precede la date de debut");
        }
        e.setTitre(dto.titre().trim());
        e.setType(type);
        e.setDateDebut(dto.dateDebut());
        e.setDateFin(fin);
        e.setDescription(dto.description());
        e.setFormation(dto.formationId() == null ? null : formationRepository.findById(dto.formationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Formation introuvable : " + dto.formationId())));
    }
}