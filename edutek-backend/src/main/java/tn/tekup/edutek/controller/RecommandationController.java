package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.RecommandationDto;
import tn.tekup.edutek.entity.Recommandation;
import tn.tekup.edutek.repository.RecommandationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/recommandations")
@RequiredArgsConstructor
public class RecommandationController {

    private static final String ETUDIANT = "hasRole('ETUDIANT')";

    private final RecommandationRepository recommandationRepository;

    @GetMapping("/mes-recommandations")
    @Transactional(readOnly = true)
    @PreAuthorize(ETUDIANT)
    public List<RecommandationDto> mesRecommandations(@RequestParam(required = false) Long semestreId,
                                                      Authentication auth) {
        List<Recommandation> liste = semestreId == null
                ? recommandationRepository.findByEtudiantEmailOrderByDateCreationDescIdDesc(auth.getName())
                : recommandationRepository.findByEtudiantEmailAndSemestreIdOrderByDateCreationDescIdDesc(auth.getName(), semestreId);
        return liste.stream().map(RecommandationDto::from).toList();
    }

    @PatchMapping("/{id}/lue")
    @Transactional
    @PreAuthorize(ETUDIANT)
    public RecommandationDto marquerLue(@PathVariable Long id, Authentication auth) {
        Recommandation r = recommandationRepository.findById(id).orElseThrow(() -> introuvable(id));
        if (!r.getEtudiant().getEmail().equals(auth.getName())) {
            throw introuvable(id);
        }
        r.setLue(true);
        return RecommandationDto.from(r);
    }

    private ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Recommandation introuvable : " + id);
    }
}