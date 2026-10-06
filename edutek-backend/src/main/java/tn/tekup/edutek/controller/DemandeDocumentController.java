package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.DemandeDocumentDto;
import tn.tekup.edutek.dto.DemandeDocumentRequest;
import tn.tekup.edutek.dto.DocumentGenereDto;
import tn.tekup.edutek.dto.LivraisonRequest;
import tn.tekup.edutek.dto.RejetRequest;
import tn.tekup.edutek.entity.AdminSupport;
import tn.tekup.edutek.entity.DemandeDocument;
import tn.tekup.edutek.entity.DocumentGenere;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.repository.AdminSupportRepository;
import tn.tekup.edutek.repository.DemandeDocumentRepository;
import tn.tekup.edutek.repository.DocumentGenereRepository;
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

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/demandes-documents")
@RequiredArgsConstructor
public class DemandeDocumentController {

    private static final List<String> TYPES = List.of("ATTESTATION_PRESENCE", "ATTESTATION_INSCRIPTION", "RELEVE_NOTES", "AUTRE");
    private static final List<String> STATUTS = List.of("SOUMIS", "EN_TRAITEMENT", "PRET", "REJETE");
    private static final List<String> OUVERTS = List.of("SOUMIS", "EN_TRAITEMENT");

    private final DemandeDocumentRepository demandeRepository;
    private final DocumentGenereRepository documentRepository;
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
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Une demande de ce type est deja en cours de traitement");
        }
        DemandeDocument d = new DemandeDocument();
        d.setEtudiant(etu);
        d.setTypeDocument(type);
        DemandeDocument saved = demandeRepository.save(d);

        for (AdminSupport a : adminSupportRepository.findAll()) {
            if (Boolean.TRUE.equals(a.getActif())) {
                notificationService.notifier(a, "Nouvelle demande de document",
                        type + " - " + etu.getPrenom() + " " + etu.getNom() + " (" + etu.getMatricule() + ")");
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

    @GetMapping("/{id}/document")
    @Transactional(readOnly = true)
    public DocumentGenereDto document(@PathVariable Long id, Authentication auth) {
        DemandeDocument d = lirePourUtilisateur(id, auth);
        if (d.getDocumentGenere() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Aucun document disponible pour cette demande (statut : " + d.getStatut() + ")");
        }
        return DocumentGenereDto.from(d.getDocumentGenere());
    }

    @PostMapping("/{id}/prendre-en-charge")
    @Transactional
    @PreAuthorize("hasRole('ADMIN_SUPPORT')")
    public DemandeDocumentDto prendreEnCharge(@PathVariable Long id, Authentication auth) {
        DemandeDocument d = verrouiller(id);
        if (!"SOUMIS".equals(d.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Demande deja prise en charge ou cloturee (statut : " + d.getStatut() + ")");
        }
        d.setTraitePar(adminConnecte(auth));
        d.setStatut("EN_TRAITEMENT");
        notificationService.notifier(d.getEtudiant(), "Demande de document en cours de traitement",
                "Votre demande " + d.getTypeDocument() + " est prise en charge.");
        return DemandeDocumentDto.from(d);
    }

    @PostMapping("/{id}/livrer")
    @Transactional
    @PreAuthorize("hasRole('ADMIN_SUPPORT')")
    public DemandeDocumentDto livrer(@PathVariable Long id, @Valid @RequestBody LivraisonRequest req, Authentication auth) {
        DemandeDocument d = verrouiller(id);
        exigerAssigne(d, adminConnecte(auth));
        DocumentGenere doc = new DocumentGenere();
        doc.setType(d.getTypeDocument());
        doc.setUrl(req.url().trim());
        d.setDocumentGenere(documentRepository.save(doc));
        d.setStatut("PRET");
        notificationService.notifier(d.getEtudiant(), "Document disponible",
                "Votre document (" + d.getTypeDocument() + ") est pret.");
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
        notificationService.notifier(d.getEtudiant(), "Demande de document rejetee",
                "Votre demande " + d.getTypeDocument() + " a ete rejetee. Motif : " + d.getMotifRejet());
        return DemandeDocumentDto.from(d);
    }

    private void exigerAssigne(DemandeDocument d, AdminSupport admin) {
        if (!"EN_TRAITEMENT".equals(d.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "La demande doit etre en cours de traitement (statut : " + d.getStatut() + ")");
        }
        if (d.getTraitePar() == null || !d.getTraitePar().getId().equals(admin.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Cette demande est prise en charge par un autre administrateur");
        }
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