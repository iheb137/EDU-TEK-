package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.IndicateurDto;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.IndicateurAcademique;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.IndicateurAcademiqueRepository;
import tn.tekup.edutek.repository.SemestreRepository;
import tn.tekup.edutek.service.IndicateurService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/indicateurs")
@RequiredArgsConstructor
public class IndicateurController {

    private final IndicateurService indicateurService;
    private final IndicateurAcademiqueRepository indicateurRepository;
    private final EtudiantRepository etudiantRepository;
    private final SemestreRepository semestreRepository;
    private final EnseignementRepository enseignementRepository;

    @PostMapping("/calculer")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public List<IndicateurDto> calculer(@RequestParam Long semestreId,
                                        @RequestParam(required = false) Long etudiantId) {
        Semestre sem = semestreRepository.findById(semestreId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + semestreId));

        List<Etudiant> etudiants = new ArrayList<>();
        if (etudiantId != null) {
            etudiants.add(etudiantRepository.findById(etudiantId).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + etudiantId)));
        } else {
            List<Enseignement> enseignements = enseignementRepository.findBySemestreId(semestreId);
            if (enseignements.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun enseignement n'est affecte dans ce semestre");
            }
            Set<Long> classes = enseignements.stream()
                    .map(e -> e.getClasse().getId())
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            for (Long classeId : classes) {
                etudiants.addAll(etudiantRepository.findByClasseId(classeId));
            }
        }

        List<IndicateurDto> resultat = new ArrayList<>();
        for (Etudiant etu : etudiants) {
            for (IndicateurAcademique i : indicateurService.calculer(etu, sem)) {
                resultat.add(IndicateurDto.from(i));
            }
        }
        return resultat;
    }

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public List<IndicateurDto> lister(@RequestParam Long semestreId,
                                      @RequestParam(required = false) Long etudiantId) {
        List<IndicateurAcademique> liste = etudiantId != null
                ? indicateurRepository.findByEtudiantIdAndSemestreId(etudiantId, semestreId)
                : indicateurRepository.findBySemestreId(semestreId);
        return liste.stream().map(IndicateurDto::from).toList();
    }

    @GetMapping("/mes-indicateurs")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<IndicateurDto> mesIndicateurs(@RequestParam Long semestreId, Authentication auth) {
        return indicateurRepository.findByEtudiantEmailAndSemestreId(auth.getName(), semestreId).stream()
                .map(IndicateurDto::from).toList();
    }
}