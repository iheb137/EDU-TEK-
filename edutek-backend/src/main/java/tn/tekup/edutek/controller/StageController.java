package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.RejetRequest;
import tn.tekup.edutek.dto.StageDto;
import tn.tekup.edutek.dto.StageRequest;
import tn.tekup.edutek.entity.AdminCommunication;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Stage;
import tn.tekup.edutek.repository.AdminCommunicationRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.StageRepository;
import tn.tekup.edutek.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/stages")
@RequiredArgsConstructor
public class StageController {

    private static final List<String> STATUTS = List.of("PROPOSE", "VALIDE", "REJETE");

    private final StageRepository stageRepository;
    private final EtudiantRepository etudiantRepository;
    private final AdminCommunicationRepository adminCommunicationRepository;
    private final NotificationService notificationService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasRole('ETUDIANT')")
    public StageDto proposer(@Valid @RequestBody StageRequest req, Authentication auth) {
        Etudiant etu = etudiantConnecte(auth);
        verifierPeriode(req, etu.getId(), -1L);
        Stage s = new Stage();
        s.setEtudiant(etu);
        appliquer(s, req);
        Stage saved = stageRepository.save(s);

        for (AdminCommunication a : adminCommunicationRepository.findAll()) {
            if (Boolean.TRUE.equals(a.getActif())) {
                notificationService.notifier(a, "Nouvelle proposition de stage",
                        saved.getEntreprise() + " - " + etu.getPrenom() + " " + etu.getNom() + " (" + etu.getMatricule() + ")");
            }
        }
        return StageDto.from(saved);
    }

    @GetMapping("/mes-stages")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<StageDto> mesStages(Authentication auth) {
        return stageRepository.findByEtudiantEmailOrderByDateDebutDesc(auth.getName()).stream()
                .map(StageDto::from).toList();
    }

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_COMMUNICATION','ADMIN_PEDAGOGIQUE')")
    public List<StageDto> lister(@RequestParam(required = false) String statut) {
        List<Stage> liste;
        if (statut == null) {
            liste = stageRepository.findAll(Sort.by(Sort.Direction.DESC, "dateDebut"));
        } else {
            String s = statut.trim().toUpperCase(Locale.ROOT);
            if (!STATUTS.contains(s)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide. Valeurs : " + String.join(", ", STATUTS));
            }
            liste = stageRepository.findByStatutOrderByDateDebutDesc(s);
        }
        return liste.stream().map(StageDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public StageDto detail(@PathVariable Long id, Authentication auth) {
        Stage s = stageRepository.findById(id).orElseThrow(() -> introuvable(id));
        boolean personnel = auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_SUPERADMIN") || a.getAuthority().equals("ROLE_ADMIN_COMMUNICATION")
                        || a.getAuthority().equals("ROLE_ADMIN_PEDAGOGIQUE"));
        if (!personnel && !s.getEtudiant().getEmail().equals(auth.getName())) {
            throw introuvable(id);
        }
        return StageDto.from(s);
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasRole('ETUDIANT')")
    public StageDto modifier(@PathVariable Long id, @Valid @RequestBody StageRequest req, Authentication auth) {
        Stage s = verrouiller(id);
        exigerProprietaire(s, auth);
        exigerPropose(s);
        verifierPeriode(req, s.getEtudiant().getId(), s.getId());
        appliquer(s, req);
        return StageDto.from(s);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize("hasRole('ETUDIANT')")
    public void retirer(@PathVariable Long id, Authentication auth) {
        Stage s = verrouiller(id);
        exigerProprietaire(s, auth);
        exigerPropose(s);
        stageRepository.delete(s);
    }

    @PostMapping("/{id}/valider")
    @Transactional
    @PreAuthorize("hasRole('ADMIN_COMMUNICATION')")
    public StageDto valider(@PathVariable Long id, Authentication auth) {
        Stage s = verrouiller(id);
        exigerPropose(s);
        s.setValidePar(communicationConnecte(auth));
        s.setStatut("VALIDE");
        notificationService.notifier(s.getEtudiant(), "Stage valide",
                "Votre stage chez " + s.getEntreprise() + " a ete valide.");
        return StageDto.from(s);
    }

    @PostMapping("/{id}/rejeter")
    @Transactional
    @PreAuthorize("hasRole('ADMIN_COMMUNICATION')")
    public StageDto rejeter(@PathVariable Long id, @Valid @RequestBody RejetRequest req, Authentication auth) {
        Stage s = verrouiller(id);
        exigerPropose(s);
        s.setValidePar(communicationConnecte(auth));
        s.setStatut("REJETE");
        s.setMotifRejet(req.motif().trim());
        notificationService.notifier(s.getEtudiant(), "Stage rejete",
                "Votre stage chez " + s.getEntreprise() + " a ete rejete. Motif : " + s.getMotifRejet());
        return StageDto.from(s);
    }

    private void verifierPeriode(StageRequest req, Long etudiantId, Long exclureId) {
        if (!req.dateFin().isAfter(req.dateDebut())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin doit etre apres la date de debut");
        }
        if (stageRepository.compterChevauchements(etudiantId, req.dateDebut(), req.dateFin(), exclureId) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Vous avez deja un stage non rejete sur cette periode");
        }
    }

    private void appliquer(Stage s, StageRequest req) {
        s.setEntreprise(req.entreprise().trim());
        s.setSujet(req.sujet().trim());
        s.setDateDebut(req.dateDebut());
        s.setDateFin(req.dateFin());
    }

    private void exigerPropose(Stage s) {
        if (!"PROPOSE".equals(s.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce stage a deja ete traite (statut : " + s.getStatut() + ")");
        }
    }

    private void exigerProprietaire(Stage s, Authentication auth) {
        if (!s.getEtudiant().getEmail().equals(auth.getName())) {
            throw introuvable(s.getId());
        }
    }

    private Stage verrouiller(Long id) {
        return stageRepository.findByIdForUpdate(id).orElseThrow(() -> introuvable(id));
    }

    private Etudiant etudiantConnecte(Authentication auth) {
        return etudiantRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil etudiant introuvable"));
    }

    private AdminCommunication communicationConnecte(Authentication auth) {
        return adminCommunicationRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur communication introuvable"));
    }

    private ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Stage introuvable : " + id);
    }
}