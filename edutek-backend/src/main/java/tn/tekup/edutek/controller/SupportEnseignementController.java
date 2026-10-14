package tn.tekup.edutek.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.dto.EnseignementSupportsDto;
import tn.tekup.edutek.dto.SupportEnseignementDto;
import tn.tekup.edutek.dto.SupportLienRequest;
import tn.tekup.edutek.dto.SupportModificationRequest;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.SupportEnseignement;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.SupportEnseignementRepository;
import tn.tekup.edutek.security.AccesHelper;
import tn.tekup.edutek.service.AuditService;
import tn.tekup.edutek.service.NotificationService;
import tn.tekup.edutek.service.StockageFichiersService;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Supports de cours d'un enseignement : fichiers televerses ou liens, deposes par l'enseignant
 * (ou l'administration pedagogique) et consultes par les etudiants de la classe.
 */
@RestController
@RequiredArgsConstructor
@Validated
public class SupportEnseignementController {

    private static final String GESTION = "hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')";
    private static final String ECRITURE = "hasAnyRole('ADMIN_PEDAGOGIQUE','ENSEIGNANT')";
    private static final String LECTURE = "hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT','ETUDIANT')";

    private final SupportEnseignementRepository supportRepository;
    private final EnseignementRepository enseignementRepository;
    private final EtudiantRepository etudiantRepository;
    private final StockageFichiersService stockage;
    private final NotificationService notificationService;
    private final AccesHelper acces;
    private final AuditService audit;

    // ── Index ─────────────────────────────────────────────────────────────────

    /** Enseignements geres par l'utilisateur (tous pour l'administration) avec leurs compteurs. */
    @GetMapping("/api/supports/enseignements")
    @Transactional(readOnly = true)
    @PreAuthorize(GESTION)
    public List<EnseignementSupportsDto> enseignementsGeres(Authentication auth) {
        List<Enseignement> liste = acces.estAdminPedagogie(auth)
                ? enseignementRepository.findAll()
                : enseignementRepository.findByEnseignantEmail(auth.getName());
        return resumer(liste, false);
    }

    /** Matieres de la classe de l'etudiant connecte, avec le nombre de supports publies. */
    @GetMapping("/api/supports/mes-cours")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<EnseignementSupportsDto> mesCours(Authentication auth) {
        Etudiant etu = etudiantConnecte(auth);
        if (etu.getClasse() == null) {
            return List.of();
        }
        return resumer(enseignementRepository.findByClasseId(etu.getClasse().getId()), true);
    }

    // ── Lecture ───────────────────────────────────────────────────────────────

    @GetMapping("/api/enseignements/{id}/supports")
    @Transactional(readOnly = true)
    @PreAuthorize(LECTURE)
    public List<SupportEnseignementDto> lister(@PathVariable Long id, Authentication auth) {
        Enseignement ens = enseignement(id);
        List<SupportEnseignement> liste = verifierLecture(auth, ens)
                ? supportRepository.findByEnseignementIdOrderByDateDepotAsc(id)
                : supportRepository.findByEnseignementIdAndVisibleTrueOrderByDateDepotAsc(id);
        return liste.stream().map(SupportEnseignementDto::from).toList();
    }

    @GetMapping("/api/enseignements/{id}/supports/{supportId}/fichier")
    @Transactional(readOnly = true)
    @PreAuthorize(LECTURE)
    public ResponseEntity<Resource> telecharger(@PathVariable Long id, @PathVariable Long supportId, Authentication auth) {
        Enseignement ens = enseignement(id);
        boolean gestion = verifierLecture(auth, ens);
        SupportEnseignement s = support(id, supportId);
        if (!gestion && !Boolean.TRUE.equals(s.getVisible())) {
            throw introuvable(supportId);
        }
        if (!"FICHIER".equals(s.getNature())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce support est un lien, pas un fichier");
        }
        Resource fichier = stockage.lire(s.getCheminStockage());
        ContentDisposition cd = ContentDisposition.attachment().filename(s.getNomFichier(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, cd.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(s.getTypeMime() != null ? s.getTypeMime() : "application/octet-stream"))
                .body(fichier);
    }

    // ── Ecriture ──────────────────────────────────────────────────────────────

    @PostMapping(value = "/api/enseignements/{id}/supports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(ECRITURE)
    public SupportEnseignementDto deposerFichier(@PathVariable Long id,
                                                 @RequestParam("fichier") MultipartFile fichier,
                                                 @RequestParam("titre") @Size(max = 200) String titre,
                                                 @RequestParam(value = "chapitre", required = false) @Size(max = 120) String chapitre,
                                                 @RequestParam(value = "visible", defaultValue = "true") boolean visible,
                                                 Authentication auth) {
        Enseignement ens = enseignement(id);
        acces.verifierProprietaire(auth, ens);
        if (titre == null || titre.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le titre est obligatoire");
        }
        StockageFichiersService.FichierStocke f = stockage.enregistrer(fichier, "supports");
        SupportEnseignement s = nouveau(ens, titre, chapitre, visible, auth);
        s.setNature("FICHIER");
        s.setNomFichier(f.nomOrigine());
        s.setCheminStockage(f.chemin());
        s.setTypeMime(f.typeMime());
        s.setTailleOctets(f.taille());
        return enregistrer(s, ens, "fichier " + f.nomOrigine());
    }

    @PostMapping("/api/enseignements/{id}/supports/lien")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(ECRITURE)
    public SupportEnseignementDto ajouterLien(@PathVariable Long id, @Valid @RequestBody SupportLienRequest req,
                                              Authentication auth) {
        Enseignement ens = enseignement(id);
        acces.verifierProprietaire(auth, ens);
        SupportEnseignement s = nouveau(ens, req.titre(), req.chapitre(), req.visible() == null || req.visible(), auth);
        s.setNature("LIEN");
        s.setUrl(req.url().trim());
        return enregistrer(s, ens, "lien " + s.getUrl());
    }

    @PutMapping("/api/enseignements/{id}/supports/{supportId}")
    @Transactional
    @PreAuthorize(ECRITURE)
    public SupportEnseignementDto modifier(@PathVariable Long id, @PathVariable Long supportId,
                                           @Valid @RequestBody SupportModificationRequest req, Authentication auth) {
        Enseignement ens = enseignement(id);
        acces.verifierProprietaire(auth, ens);
        SupportEnseignement s = support(id, supportId);
        s.setTitre(req.titre().trim());
        s.setChapitre(vide(req.chapitre()));
        if ("LIEN".equals(s.getNature())) {
            if (req.url() == null || req.url().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'adresse du lien est obligatoire");
            }
            s.setUrl(req.url().trim());
        }
        if (req.visible() != null) {
            s.setVisible(req.visible());
        }
        prevenirSiNecessaire(s, ens);
        audit.log("MODIFICATION_SUPPORT", "SupportEnseignement", s.getId(), s.getTitre());
        return SupportEnseignementDto.from(s);
    }

    @DeleteMapping("/api/enseignements/{id}/supports/{supportId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize(ECRITURE)
    public void supprimer(@PathVariable Long id, @PathVariable Long supportId, Authentication auth) {
        Enseignement ens = enseignement(id);
        acces.verifierProprietaire(auth, ens);
        SupportEnseignement s = support(id, supportId);
        String chemin = s.getCheminStockage();
        supportRepository.delete(s);
        stockage.supprimer(chemin);
        audit.log("SUPPRESSION_SUPPORT", "SupportEnseignement", supportId, s.getTitre());
    }

    // ── Outils ────────────────────────────────────────────────────────────────

    private SupportEnseignement nouveau(Enseignement ens, String titre, String chapitre, boolean visible, Authentication auth) {
        SupportEnseignement s = new SupportEnseignement();
        s.setEnseignement(ens);
        s.setTitre(titre.trim());
        s.setChapitre(vide(chapitre));
        s.setVisible(visible);
        s.setDateDepot(LocalDateTime.now());
        s.setDeposePar(auth.getName());
        return s;
    }

    private SupportEnseignementDto enregistrer(SupportEnseignement s, Enseignement ens, String detail) {
        SupportEnseignement saved = supportRepository.save(s);
        prevenirSiNecessaire(saved, ens);
        audit.log("AJOUT_SUPPORT", "SupportEnseignement", saved.getId(),
                ens.getMatiere().getCode() + " / " + ens.getClasse().getNom() + " : " + detail);
        return SupportEnseignementDto.from(saved);
    }

    /** Previent les etudiants de la classe a la premiere mise en ligne du support. */
    private void prevenirSiNecessaire(SupportEnseignement s, Enseignement ens) {
        if (!Boolean.TRUE.equals(s.getVisible()) || Boolean.TRUE.equals(s.getNotifie())) {
            return;
        }
        s.setNotifie(true);
        String contenu = ens.getMatiere().getNom() + " : « " + s.getTitre() + " » est disponible dans vos cours.";
        for (Etudiant e : etudiantRepository.findByClasseId(ens.getClasse().getId())) {
            if (Boolean.TRUE.equals(e.getActif())) {
                notificationService.notifier(e, "Nouveau support de cours", contenu);
            }
        }
    }

    /** Vrai si l'utilisateur gere l'enseignement ; un etudiant doit appartenir a la classe (sinon 403). */
    private boolean verifierLecture(Authentication auth, Enseignement ens) {
        boolean etudiant = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ETUDIANT"));
        if (!etudiant) {
            acces.verifierProprietaire(auth, ens);
            return true;
        }
        Etudiant etu = etudiantConnecte(auth);
        if (etu.getClasse() == null || !etu.getClasse().getId().equals(ens.getClasse().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce cours n'est pas celui de votre classe");
        }
        return false;
    }

    private List<EnseignementSupportsDto> resumer(List<Enseignement> liste, boolean visiblesSeulement) {
        return liste.stream()
                .sorted(Comparator.comparing((Enseignement e) -> e.getMatiere().getCode(), Comparator.nullsLast(String::compareTo)))
                .map(e -> {
                    List<SupportEnseignement> s = visiblesSeulement
                            ? supportRepository.findByEnseignementIdAndVisibleTrueOrderByDateDepotAsc(e.getId())
                            : supportRepository.findByEnseignementIdOrderByDateDepotAsc(e.getId());
                    long visibles = s.stream().filter(x -> Boolean.TRUE.equals(x.getVisible())).count();
                    LocalDateTime dernier = s.stream().map(SupportEnseignement::getDateDepot)
                            .filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
                    Utilisateur ens = e.getEnseignant();
                    return new EnseignementSupportsDto(e.getId(), e.getMatiere().getCode(), e.getMatiere().getNom(),
                            e.getClasse().getId(), e.getClasse().getNom(), ens.getPrenom() + " " + ens.getNom(),
                            e.getSemestre().getId(), e.getSemestre().getNom(), s.size(), visibles, dernier);
                })
                .toList();
    }

    private Enseignement enseignement(Long id) {
        return enseignementRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Enseignement introuvable : " + id));
    }

    private SupportEnseignement support(Long ensId, Long id) {
        return supportRepository.findByIdAndEnseignementId(id, ensId).orElseThrow(() -> introuvable(id));
    }

    private Etudiant etudiantConnecte(Authentication auth) {
        return etudiantRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil étudiant introuvable"));
    }

    private static ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Support introuvable : " + id);
    }

    private static String vide(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
