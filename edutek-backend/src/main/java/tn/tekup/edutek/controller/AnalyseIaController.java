package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.AnalyseResultDto;
import tn.tekup.edutek.dto.ModeleIaDto;
import tn.tekup.edutek.dto.ParametresRisqueDto;
import tn.tekup.edutek.dto.ParametresRisqueRequest;
import tn.tekup.edutek.dto.PredictionDto;
import tn.tekup.edutek.entity.AdminPedagogique;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.ParametresRisque;
import tn.tekup.edutek.entity.PredictionIA;
import tn.tekup.edutek.repository.AdminPedagogiqueRepository;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.ModeleIARepository;
import tn.tekup.edutek.repository.PredictionIARepository;
import tn.tekup.edutek.service.AuditService;
import tn.tekup.edutek.service.PredictionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/ia")
@RequiredArgsConstructor
public class AnalyseIaController {

    private static final String GESTION = "hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')";
    private static final String LECTURE = "hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')";
    private static final String PEDAGOGIE = "hasRole('ADMIN_PEDAGOGIQUE')";
    private static final List<String> NIVEAUX = List.of("FAIBLE", "MOYEN", "ELEVE");

    private final PredictionService predictionService;
    private final PredictionIARepository predictionRepository;
    private final ModeleIARepository modeleRepository;
    private final EnseignementRepository enseignementRepository;
    private final AdminPedagogiqueRepository adminPedagogiqueRepository;
    private final AuditService audit;

    // Pas de @Transactional ici : chaque etudiant est analyse dans sa propre transaction,
    // l'echec de l'un n'annule pas les autres.
    @PostMapping("/analyses")
    @PreAuthorize(GESTION)
    public AnalyseResultDto analyser(@RequestParam Long semestreId,
                                     @RequestParam(required = false) Long etudiantId,
                                     @RequestParam(required = false) Long classeId) {
        List<Long> ids = predictionService.cibles(semestreId, etudiantId, classeId);
        List<PredictionDto> resultats = new ArrayList<>();
        List<String> avertissements = new ArrayList<>();
        int alertes = 0;
        for (Long id : ids) {
            try {
                PredictionService.Resultat r = predictionService.analyser(id, semestreId);
                resultats.add(r.prediction());
                if (r.alerteCreee()) {
                    alertes++;
                }
            } catch (ResponseStatusException e) {
                avertissements.add("Etudiant " + id + " : " + e.getReason());
            }
        }
        audit.log("ANALYSE_IA", "PredictionIA", null, "semestre " + semestreId + " : " + resultats.size()
                + " analyse(s), " + alertes + " alerte(s) creee(s), " + avertissements.size() + " avertissement(s)");
        return new AnalyseResultDto(semestreId, resultats.size(), alertes, resultats, avertissements);
    }

    @GetMapping("/predictions")
    @Transactional(readOnly = true)
    @PreAuthorize(LECTURE)
    public List<PredictionDto> predictions(@RequestParam(required = false) Long semestreId,
                                           @RequestParam(required = false) Long etudiantId,
                                           @RequestParam(required = false) String niveau,
                                           @RequestParam(defaultValue = "false") boolean dernieresSeulement,
                                           Authentication auth) {
        String n = niveau == null || niveau.isBlank() ? null : niveau.trim().toUpperCase(Locale.ROOT);
        if (n != null && !NIVEAUX.contains(n)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Niveau invalide. Valeurs : " + String.join(", ", NIVEAUX));
        }
        Set<Long> classes = classesAutorisees(auth);
        Set<String> deja = new HashSet<>();
        List<PredictionDto> resultat = new ArrayList<>();
        for (PredictionIA p : predictionRepository.findAllByOrderByDatePredictionDescIdDesc()) {
            if (semestreId != null && (p.getSemestre() == null || !p.getSemestre().getId().equals(semestreId))) continue;
            if (etudiantId != null && !p.getEtudiant().getId().equals(etudiantId)) continue;
            if (n != null && !n.equals(p.getNiveau())) continue;
            if (classes != null && !visible(p, classes)) continue;
            if (dernieresSeulement) {
                String cle = p.getEtudiant().getId() + "|" + (p.getSemestre() != null ? p.getSemestre().getId() : 0);
                if (!deja.add(cle)) continue;
            }
            resultat.add(PredictionDto.from(p, p.getAlerteRisque() != null ? p.getAlerteRisque().getId() : null));
        }
        return resultat;
    }

    @GetMapping("/predictions/{id}")
    @Transactional(readOnly = true)
    @PreAuthorize(LECTURE)
    public PredictionDto prediction(@PathVariable Long id, Authentication auth) {
        PredictionIA p = predictionRepository.findById(id).orElseThrow(() -> introuvable(id));
        Set<Long> classes = classesAutorisees(auth);
        if (classes != null && !visible(p, classes)) {
            throw introuvable(id);
        }
        return PredictionDto.from(p, p.getAlerteRisque() != null ? p.getAlerteRisque().getId() : null);
    }

    @GetMapping("/modeles")
    @Transactional(readOnly = true)
    @PreAuthorize(GESTION)
    public List<ModeleIaDto> modeles() {
        return modeleRepository.findAllByOrderByIdDesc().stream().map(ModeleIaDto::from).toList();
    }

    @GetMapping("/parametres")
    @Transactional
    @PreAuthorize(GESTION)
    public ParametresRisqueDto parametres() {
        return ParametresRisqueDto.from(predictionService.parametres());
    }

    @PutMapping("/parametres")
    @Transactional
    @PreAuthorize(PEDAGOGIE)
    public ParametresRisqueDto modifierParametres(@Valid @RequestBody ParametresRisqueRequest req, Authentication auth) {
        double moyen = req.seuilMoyen();
        double eleve = req.seuilEleve();
        if (!(moyen > 0 && eleve < 1 && moyen < eleve)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seuils invalides : 0 < seuilMoyen < seuilEleve < 1");
        }
        AdminPedagogique auteur = adminPedagogiqueRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur pedagogique introuvable"));
        ParametresRisque p = predictionService.parametres();
        p.setSeuilMoyen(moyen);
        p.setSeuilEleve(eleve);
        p.setModifiePar(auteur);
        p.setDateModification(LocalDateTime.now());
        audit.log("SEUILS_RISQUE_MODIFIES", "ParametresRisque", 1L, moyen + " / " + eleve);
        return ParametresRisqueDto.from(p);
    }

    /** null = acces a tous les etudiants ; sinon identifiants des classes des enseignements de l'enseignant. */
    private Set<Long> classesAutorisees(Authentication auth) {
        boolean gestion = auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_SUPERADMIN") || a.getAuthority().equals("ROLE_ADMIN_PEDAGOGIQUE"));
        if (gestion) {
            return null;
        }
        Set<Long> classes = new HashSet<>();
        for (Enseignement e : enseignementRepository.findByEnseignantEmail(auth.getName())) {
            classes.add(e.getClasse().getId());
        }
        return classes;
    }

    private boolean visible(PredictionIA p, Set<Long> classes) {
        return p.getEtudiant().getClasse() != null && classes.contains(p.getEtudiant().getClasse().getId());
    }

    private ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Prediction introuvable : " + id);
    }
}