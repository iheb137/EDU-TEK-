package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.JustificatifDto;
import tn.tekup.edutek.dto.JustificatifRequest;
import tn.tekup.edutek.dto.RejetRequest;
import tn.tekup.edutek.entity.AdminSupport;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.JustificatifAbsence;
import tn.tekup.edutek.entity.Presence;
import tn.tekup.edutek.repository.AdminSupportRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.JustificatifAbsenceRepository;
import tn.tekup.edutek.repository.PresenceRepository;
import tn.tekup.edutek.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/justificatifs")
@RequiredArgsConstructor
public class JustificatifController {

    private static final String LECTURE = "hasAnyRole('SUPERADMIN','ADMIN_SUPPORT')";
    private static final String SUPPORT = "hasRole('ADMIN_SUPPORT')";
    private static final String ETUDIANT = "hasRole('ETUDIANT')";
    private static final List<String> MOTIFS = List.of("MALADIE", "FAMILIAL", "ADMINISTRATIF", "AUTRE");
    private static final List<String> STATUTS = List.of("SOUMIS", "VALIDE", "REJETE");
    private static final int DUREE_MAX_JOURS = 31;

    private final JustificatifAbsenceRepository justificatifRepository;
    private final PresenceRepository presenceRepository;
    private final EtudiantRepository etudiantRepository;
    private final AdminSupportRepository adminSupportRepository;
    private final NotificationService notificationService;

    // ---------- Etudiant ----------

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(ETUDIANT)
    public JustificatifDto soumettre(@Valid @RequestBody JustificatifRequest req, Authentication auth) {
        Etudiant etu = etudiantConnecte(auth);
        String motif = motif(req.motif());
        verifierPeriode(req.dateDebut(), req.dateFin(), etu.getId(), -1L);

        JustificatifAbsence j = new JustificatifAbsence();
        j.setEtudiant(etu);
        appliquer(j, req, motif);
        JustificatifAbsence saved = justificatifRepository.save(j);

        for (AdminSupport a : adminSupportRepository.findAll()) {
            if (Boolean.TRUE.equals(a.getActif())) {
                notificationService.notifier(a, "Nouveau justificatif d'absence",
                        etu.getPrenom() + " " + etu.getNom() + " (" + etu.getMatricule() + ") : du "
                                + saved.getDateDebut() + " au " + saved.getDateFin());
            }
        }
        return JustificatifDto.from(saved);
    }

    @GetMapping("/mes-justificatifs")
    @Transactional(readOnly = true)
    @PreAuthorize(ETUDIANT)
    public List<JustificatifDto> mesJustificatifs(Authentication auth) {
        return justificatifRepository.findByEtudiantEmailOrderByDateSoumissionDesc(auth.getName()).stream()
                .map(JustificatifDto::from).toList();
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize(ETUDIANT)
    public JustificatifDto modifier(@PathVariable Long id, @Valid @RequestBody JustificatifRequest req,
                                    Authentication auth) {
        JustificatifAbsence j = verrouiller(id);
        exigerProprietaire(j, auth);
        exigerSoumis(j);
        String motif = motif(req.motif());
        verifierPeriode(req.dateDebut(), req.dateFin(), j.getEtudiant().getId(), j.getId());
        appliquer(j, req, motif);
        return JustificatifDto.from(j);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize(ETUDIANT)
    public void retirer(@PathVariable Long id, Authentication auth) {
        JustificatifAbsence j = verrouiller(id);
        exigerProprietaire(j, auth);
        exigerSoumis(j);
        justificatifRepository.delete(j);
    }

    // ---------- Personnel ----------

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize(LECTURE)
    public List<JustificatifDto> lister(@RequestParam(required = false) String statut,
                                        @RequestParam(required = false) Long etudiantId) {
        String s = statut == null || statut.isBlank() ? null : statut.trim().toUpperCase(Locale.ROOT);
        if (s != null && !STATUTS.contains(s)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide. Valeurs : " + String.join(", ", STATUTS));
        }
        return justificatifRepository.findAllByOrderByDateSoumissionDesc().stream()
                .filter(j -> s == null || j.getStatut().equals(s))
                .filter(j -> etudiantId == null || j.getEtudiant().getId().equals(etudiantId))
                .map(JustificatifDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public JustificatifDto detail(@PathVariable Long id, Authentication auth) {
        JustificatifAbsence j = justificatifRepository.findById(id).orElseThrow(() -> introuvable(id));
        boolean personnel = auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_SUPERADMIN") || a.getAuthority().equals("ROLE_ADMIN_SUPPORT"));
        if (!personnel && !j.getEtudiant().getEmail().equals(auth.getName())) {
            throw introuvable(id);
        }
        return JustificatifDto.from(j);
    }

    @PostMapping("/{id}/valider")
    @Transactional
    @PreAuthorize(SUPPORT)
    public JustificatifDto valider(@PathVariable Long id, Authentication auth) {
        JustificatifAbsence j = verrouiller(id);
        exigerSoumis(j);
        AdminSupport admin = adminConnecte(auth);

        int justifiees = 0;
        List<Presence> absences = presenceRepository.findByEtudiantIdAndPresentFalseAndSeanceDateBetween(
                j.getEtudiant().getId(), j.getDateDebut(), j.getDateFin());
        for (Presence p : absences) {
            if (p.getJustification() == null || p.getJustification().isBlank()) {
                p.setJustification("Justificatif valide #" + j.getId() + " (" + j.getMotif() + ")");
                justifiees++;
            }
        }
        j.setStatut("VALIDE");
        j.setTraitePar(admin);
        j.setDateDecision(LocalDateTime.now());
        j.setNbAbsencesJustifiees(justifiees);

        notificationService.notifier(j.getEtudiant(), "Justificatif valide",
                "Votre justificatif du " + j.getDateDebut() + " au " + j.getDateFin() + " a ete valide ("
                        + justifiees + " absence(s) justifiee(s)).");
        return JustificatifDto.from(j);
    }

    @PostMapping("/{id}/rejeter")
    @Transactional
    @PreAuthorize(SUPPORT)
    public JustificatifDto rejeter(@PathVariable Long id, @Valid @RequestBody RejetRequest req, Authentication auth) {
        JustificatifAbsence j = verrouiller(id);
        exigerSoumis(j);
        AdminSupport admin = adminConnecte(auth);
        j.setStatut("REJETE");
        j.setMotifRejet(req.motif().trim());
        j.setTraitePar(admin);
        j.setDateDecision(LocalDateTime.now());
        notificationService.notifier(j.getEtudiant(), "Justificatif rejete",
                "Votre justificatif du " + j.getDateDebut() + " au " + j.getDateFin() + " a ete rejete. Motif : "
                        + j.getMotifRejet());
        return JustificatifDto.from(j);
    }

    // ---------- Utilitaires ----------

    private void verifierPeriode(LocalDate debut, LocalDate fin, Long etudiantId, Long exclureId) {
        if (fin.isBefore(debut)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La date de fin doit etre posterieure ou egale a la date de debut");
        }
        if (fin.isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin ne peut pas etre dans le futur");
        }
        if (ChronoUnit.DAYS.between(debut, fin) + 1 > DUREE_MAX_JOURS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Periode limitee a " + DUREE_MAX_JOURS + " jours");
        }
        if (justificatifRepository.compterChevauchements(etudiantId, debut, fin, exclureId) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Un justificatif en attente ou valide couvre deja tout ou partie de cette periode");
        }
    }

    private String motif(String brut) {
        String m = brut.trim().toUpperCase(Locale.ROOT);
        if (!MOTIFS.contains(m)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Motif invalide. Valeurs : " + String.join(", ", MOTIFS));
        }
        return m;
    }

    private void appliquer(JustificatifAbsence j, JustificatifRequest req, String motif) {
        j.setDateDebut(req.dateDebut());
        j.setDateFin(req.dateFin());
        j.setMotif(motif);
        j.setCommentaire(req.commentaire() == null || req.commentaire().isBlank() ? null : req.commentaire().trim());
        j.setPieceUrl(req.pieceUrl() == null || req.pieceUrl().isBlank() ? null : req.pieceUrl().trim());
    }

    private void exigerSoumis(JustificatifAbsence j) {
        if (!"SOUMIS".equals(j.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce justificatif a deja ete traite (statut : " + j.getStatut() + ")");
        }
    }

    private void exigerProprietaire(JustificatifAbsence j, Authentication auth) {
        if (!j.getEtudiant().getEmail().equals(auth.getName())) {
            throw introuvable(j.getId());
        }
    }

    private JustificatifAbsence verrouiller(Long id) {
        return justificatifRepository.findByIdForUpdate(id).orElseThrow(() -> introuvable(id));
    }

    private Etudiant etudiantConnecte(Authentication auth) {
        return etudiantRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil etudiant introuvable"));
    }

    private AdminSupport adminConnecte(Authentication auth) {
        return adminSupportRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur support introuvable"));
    }

    private ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Justificatif introuvable : " + id);
    }
}