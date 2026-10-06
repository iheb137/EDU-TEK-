package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.AnnuaireDto;
import tn.tekup.edutek.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/annuaire")
@RequiredArgsConstructor
public class AnnuaireController {

    private final UtilisateurRepository utilisateurRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<AnnuaireDto> rechercher(@RequestParam String q) {
        String terme = q.trim();
        if (!terme.matches("[\\p{L}' \\-]{2,50}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Recherche invalide : 2 a 50 lettres (espaces, apostrophes et tirets admis)");
        }
        return utilisateurRepository.rechercher(terme, PageRequest.of(0, 20)).stream()
                .map(AnnuaireDto::from).toList();
    }
}