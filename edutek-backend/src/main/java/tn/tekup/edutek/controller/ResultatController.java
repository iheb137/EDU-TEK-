package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.BulletinDto;
import tn.tekup.edutek.dto.ResultatSemestreDto;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.ResultatSemestre;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.ResultatSemestreRepository;
import tn.tekup.edutek.repository.SemestreRepository;
import tn.tekup.edutek.service.ResultatService;
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
@RequestMapping("/api/resultats")
@RequiredArgsConstructor
public class ResultatController {

    private final ResultatService resultatService;
    private final ResultatSemestreRepository resultatRepository;
    private final EtudiantRepository etudiantRepository;
    private final SemestreRepository semestreRepository;
    private final EnseignementRepository enseignementRepository;

    @PostMapping("/calculer")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public List<ResultatSemestreDto> calculer(@RequestParam Long semestreId,
                                              @RequestParam(required = false) Long etudiantId) {
        Semestre sem = semestre(semestreId);

        if (etudiantId != null) {
            Etudiant etu = etudiantRepository.findById(etudiantId).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + etudiantId));
            return List.of(ResultatSemestreDto.from(resultatService.calculerEtEnregistrer(etu, sem)));
        }

        List<Enseignement> enseignements = enseignementRepository.findBySemestreId(semestreId);
        if (enseignements.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun enseignement n'est affecte dans ce semestre");
        }
        Set<Long> classes = enseignements.stream()
                .map(e -> e.getClasse().getId())
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<ResultatSemestreDto> resultats = new ArrayList<>();
        for (Long classeId : classes) {
            for (Etudiant etu : etudiantRepository.findByClasseId(classeId)) {
                resultats.add(ResultatSemestreDto.from(resultatService.calculerEtEnregistrer(etu, sem)));
            }
        }
        return resultats;
    }

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public List<ResultatSemestreDto> lister(@RequestParam(required = false) Long semestreId) {
        List<ResultatSemestre> liste = semestreId != null
                ? resultatRepository.findBySemestreId(semestreId)
                : resultatRepository.findAll();
        return liste.stream().map(ResultatSemestreDto::from).toList();
    }

    @GetMapping("/mes-resultats")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<ResultatSemestreDto> mesResultats(Authentication auth) {
        return resultatRepository.findByEtudiantEmail(auth.getName()).stream()
                .map(ResultatSemestreDto::from).toList();
    }

    @GetMapping("/mon-bulletin")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public BulletinDto monBulletin(@RequestParam Long semestreId, Authentication auth) {
        Etudiant etu = etudiantRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable"));
        return resultatService.bulletin(etu, semestre(semestreId));
    }

    private Semestre semestre(Long id) {
        return semestreRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + id));
    }
}