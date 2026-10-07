package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.EvaluationResultDto;
import tn.tekup.edutek.dto.ModeleIaDto;
import tn.tekup.edutek.dto.ModeleRequest;
import tn.tekup.edutek.dto.StatutRequest;
import tn.tekup.edutek.entity.ModeleIA;
import tn.tekup.edutek.ia.ContratIa.ModeleInfo;
import tn.tekup.edutek.ia.ServiceIa;
import tn.tekup.edutek.repository.ModeleIARepository;
import tn.tekup.edutek.service.AuditService;
import tn.tekup.edutek.service.EvaluationModeleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/ia/modeles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class ModeleIaController {

    private static final List<String> TYPES = List.of("BASELINE", "DEEP_LEARNING", "AUTRE");
    private static final List<String> STATUTS = List.of("ENTRAINE", "EN_PRODUCTION", "ARCHIVE");
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "ENTRAINE", Set.of("EN_PRODUCTION", "ARCHIVE"),
            "EN_PRODUCTION", Set.of("ENTRAINE", "ARCHIVE"),
            "ARCHIVE", Set.of("ENTRAINE"));

    private final ModeleIARepository modeleRepository;
    private final ServiceIa serviceIa;
    private final EvaluationModeleService evaluationService;
    private final AuditService audit;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ModeleIaDto enregistrer(@Valid @RequestBody ModeleRequest req) {
        String type = req.type().trim().toUpperCase(Locale.ROOT);
        if (!TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type invalide. Valeurs : " + String.join(", ", TYPES));
        }
        String nom = req.nom().trim();
        String version = req.version().trim();
        if (modeleRepository.findByNomAndVersion(nom, version).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce modele (nom + version) est deja enregistre");
        }
        ModeleIA m = new ModeleIA();
        m.setNom(nom);
        m.setVersion(version);
        m.setType(type);
        m.setStatut("ENTRAINE");
        ModeleIA saved = modeleRepository.save(m);
        audit.log("MODELE_ENREGISTRE", "ModeleIA", saved.getId(), nom + " " + version + " (" + type + ")");
        return ModeleIaDto.from(saved);
    }

    @PutMapping("/{id}/statut")
    @Transactional
    public ModeleIaDto changerStatut(@PathVariable Long id, @Valid @RequestBody StatutRequest req) {
        ModeleIA m = modeleRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Modele introuvable : " + id));
        String nouveau = req.statut().trim().toUpperCase(Locale.ROOT);
        if (!STATUTS.contains(nouveau)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide. Valeurs : " + String.join(", ", STATUTS));
        }
        String ancien = m.getStatut();
        if ("STUB".equals(ancien)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le statut STUB (faux service) n'est pas modifiable");
        }
        if (nouveau.equals(ancien)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le modele est deja au statut " + nouveau);
        }
        if (!TRANSITIONS.getOrDefault(ancien, Set.of()).contains(nouveau)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Transition impossible : " + ancien + " vers " + nouveau);
        }
        if ("EN_PRODUCTION".equals(nouveau)) {
            for (ModeleIA autre : modeleRepository.findByStatut("EN_PRODUCTION")) {
                if (!autre.getId().equals(m.getId())) {
                    autre.setStatut("ENTRAINE");
                }
            }
            serviceIa.activer(m.getNom(), m.getVersion());
        }
        m.setStatut(nouveau);
        audit.log("MODELE_STATUT", "ModeleIA", m.getId(), ancien + " -> " + nouveau + " : " + m.getNom() + " " + m.getVersion());
        return ModeleIaDto.from(m);
    }

    @GetMapping("/evaluation")
    public EvaluationResultDto evaluation(@RequestParam Long semestreId,
                                          @RequestParam(required = false) Long classeId,
                                          @RequestParam(required = false) Double seuil) {
        return evaluationService.evaluer(semestreId, classeId, seuil);
    }

    @PostMapping("/reentrainer")
    @Transactional
    public ModeleIaDto reentrainer() {
        ModeleInfo info = serviceIa.reentrainer();
        ModeleIA modele = modeleRepository.findByNomAndVersion(info.nom(), info.version()).orElseGet(() -> {
            ModeleIA m = new ModeleIA();
            m.setNom(info.nom());
            m.setVersion(info.version());
            m.setType(info.type());
            m.setStatut("ENTRAINE");
            return modeleRepository.save(m);
        });
        audit.log("MODELE_REENTRAINE", "ModeleIA", modele.getId(), modele.getNom() + " " + modele.getVersion());
        return ModeleIaDto.from(modele);
    }
}