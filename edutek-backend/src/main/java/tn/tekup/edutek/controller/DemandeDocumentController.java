package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.DemandeDocumentDto;
import tn.tekup.edutek.dto.DemandeDocumentRequest;
import tn.tekup.edutek.dto.PretRetraitRequest;
import tn.tekup.edutek.dto.RejetRequest;
import tn.tekup.edutek.entity.AdminSupport;
import tn.tekup.edutek.entity.DemandeDocument;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.repository.AdminSupportRepository;
import tn.tekup.edutek.repository.DemandeDocumentRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/demandes-documents")
@RequiredArgsConstructor
public class DemandeDocumentController {

    private static final List<String> TYPES = List.of("ATTESTATION_PRESENCE", "ATTESTATION_INSCRIPTION", "RELEVE_NOTES", "AUTRE");
    private static final List<String> STATUTS = List.of("SOUMIS", "EN_TRAITEMENT", "PRET", "REMIS", "REJETE");
    /** Une demande est « ouverte » tant que le papier n'a pas ete remis a l'etudiant. */
    private static final List<String> OUVERTS = List.of("SOUMIS", "EN_TRAITEMENT", "PRET");
    private static final Map<String, String> LIBELLES = Map.of(
            "ATTESTATION_PRESENCE", "attestation de présence",
            "ATTESTATION_INSCRIPTION", "attestation d'inscription",
            "RELEVE_NOTES", "relevé de notes",
            "AUTRE", "document");

    private final DemandeDocumentRepository demandeRepository;
    private final EtudiantRepository etudiantRepository;
    private final AdminSupportRepository adminSupportRepository;
    private final NotificationService notificationService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasRole('ETUDIANT')")
    public DemandeDocumentDto creer(@Valid @RequestBody DemandeDocumentRequest req, Authentication auth) {
        Etudiant etu = etudiantConnecte(auth);
        String type = req.typeDocument().trim().toUpperCase(Locale.ROOT);
        if (!TYPES.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type invalide. Valeurs : " + String.join(", ", TYPES));
        }
        if (demandeRepository.existsByEtudiantIdAndTypeDocumentAndStatutIn(etu.getId(), type, OUVERTS)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Une demande de ce type est déjà en cours (ou prête à retirer au bureau)");
        }
        DemandeDocument d = new DemandeDocument();
        d.setEtudiant(etu);
        d.setTypeDocument(type);
        DemandeDocument saved = demandeRepository.save(d);

        for (AdminSupport a : adminSupportRepository.findAll()) {
            if (Boolean.TRUE.equals(a.getActif())) {
                notificationService.notifier(a, "Nouvelle demande de document",
                        libelle(type) + " - " + etu.getPrenom() + " " + etu.getNom() + " (" + etu.getMatricule() + ")");
            }
        }
        return DemandeDocumentDto.from(saved);
    }

    @GetMapping("/mes-demandes")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<DemandeDocumentDto> mesDemandes(Authentication auth) {
        return demandeRepository.findByEtudiantEmailOrderByDateDemandeDesc(auth.getName()).stream()
                .map(DemandeDocumentDto::from).toList();
    }

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_SUPPORT')")
    public List<DemandeDocumentDto> lister(@RequestParam(required = false) String statut) {
        List<DemandeDocument> liste;
        if (statut == null) {
            liste = demandeRepository.findAll(Sort.by("dateDemande"));
        } else {
            String s = statut.trim().toUpperCase(Locale.ROOT);
            if (!STATUTS.contains(s)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide. Valeurs : " + String.join(", ", STATUTS));
            }
            liste = demandeRepository.findByStatutOrderByDateDemandeAsc(s);
        }
        return liste.stream().map(DemandeDocumentDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public DemandeDocumentDto detail(@PathVariable Long id, Authentication auth) {
        return DemandeDocumentDto.from(lirePourUtilisateur(id, auth));
    }

    @PostMapping("/{id}/prendre-en-charge")
    @Transactional
    @PreAuthorize("hasRole('ADMIN_SUPPORT')")
    public DemandeDocumentDto prendreEnCharge(@PathVariable Long id, Authentication auth) {
        DemandeDocument d = verrouiller(id);
        if (!"SOUMIS".equals(d.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Demande déjà prise en charge ou clôturée (statut : " + d.getStatut() + ")");
        }
        d.setTraitePar(adminConnecte(auth));
        d.setStatut("EN_TRAITEMENT");
        notificationService.notifier(d.getEtudiant(), "Demande de document en cours de traitement",
                "Votre demande (" + libelle(d.getTypeDocument()) + ") est prise en charge par l'administration.");
        return DemandeDocumentDto.from(d);
    }

    /** Le document papier est imprime et signe : l'etudiant est invite a passer le retirer. */
    @PostMapping("/{id}/marquer-pret")
    @Transactional
    @PreAuthorize("hasRole('ADMIN_SUPPORT')")
    public DemandeDocumentDto marquerPret(@PathVariable Long id, @Valid @RequestBody(required = false) PretRetraitRequest req,
                                          Authentication auth) {
        DemandeDocument d = verrouiller(id);
        exigerAssigne(d, adminConnecte(auth));
        String message = req == null || req.message() == null || req.message().isBlank() ? null : req.message().trim();
        d.setMessageRetrait(message);
        d.setDatePret(LocalDateTime.now());
        d.setStatut("PRET");
        notificationService.notifier(d.getEtudiant(), "Document prêt à retirer",
                "Votre document (" + libelle(d.getTypeDocument()) + ") est prêt. Présentez-vous à l'administration "
                        + "muni de votre carte d'étudiant pour le retirer." + (message == null ? "" : " " + message));
        return DemandeDocumentDto.from(d);
    }

    /** L'etudiant est passe au guichet : le document papier lui a ete remis. */
    @PostMapping("/{id}/remettre")
    @Transactional
    @PreAuthorize("hasRole('ADMIN_SUPPORT')")
    public DemandeDocumentDto remettre(@PathVariable Long id, Authentication auth) {
        DemandeDocument d = verrouiller(id);
        if (!"PRET".equals(d.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Seul un document prêt à retirer peut être remis (statut : " + d.getStatut() + ")");
        }
        d.setRemisPar(adminConnecte(auth));
        d.setDateRemise(LocalDateTime.now());
        d.setStatut("REMIS");
        notificationService.notifier(d.getEtudiant(), "Document remis",
                "Votre document (" + libelle(d.getTypeDocument()) + ") vous a été remis par l'administration.");
        return DemandeDocumentDto.from(d);
    }

    @PostMapping("/{id}/rejeter")
    @Transactional
    @PreAuthorize("hasRole('ADMIN_SUPPORT')")
    public DemandeDocumentDto rejeter(@PathVariable Long id, @Valid @RequestBody RejetRequest req, Authentication auth) {
        DemandeDocument d = verrouiller(id);
        AdminSupport admin = adminConnecte(auth);
        if ("SOUMIS".equals(d.getStatut())) {
            d.setTraitePar(admin);
        } else {
            exigerAssigne(d, admin);
        }
        d.setStatut("REJETE");
        d.setMotifRejet(req.motif().trim());
        notificationService.notifier(d.getEtudiant(), "Demande de document rejetée",
                "Votre demande (" + libelle(d.getTypeDocument()) + ") a été rejetée. Motif : " + d.getMotifRejet());
        return DemandeDocumentDto.from(d);
    }

    private void exigerAssigne(DemandeDocument d, AdminSupport admin) {
        if (!"EN_TRAITEMENT".equals(d.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La demande doit être en cours de traitement (statut : " + d.getStatut() + ")");
        }
        if (d.getTraitePar() == null || !d.getTraitePar().getId().equals(admin.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Cette demande est prise en charge par un autre agent du support");
        }
    }

    private static String libelle(String type) {
        return LIBELLES.getOrDefault(type, type);
    }

    private DemandeDocument verrouiller(Long id) {
        return demandeRepository.findByIdForUpdate(id).orElseThrow(() -> introuvable(id));
    }

    private DemandeDocument lirePourUtilisateur(Long id, Authentication auth) {
        DemandeDocument d = demandeRepository.findById(id).orElseThrow(() -> introuvable(id));
        boolean personnel = auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_SUPERADMIN") || a.getAuthority().equals("ROLE_ADMIN_SUPPORT"));
        if (!personnel && !d.getEtudiant().getEmail().equals(auth.getName())) {
            throw introuvable(id);
        }
        return d;
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
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Demande introuvable : " + id);
    }
}