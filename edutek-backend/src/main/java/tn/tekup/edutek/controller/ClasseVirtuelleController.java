package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.ClasseVirtuelleDto;
import tn.tekup.edutek.dto.ClasseVirtuelleRequest;
import tn.tekup.edutek.dto.SupportCoursDto;
import tn.tekup.edutek.dto.SupportCoursRequest;
import tn.tekup.edutek.entity.ClasseVirtuelle;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.SupportCours;
import tn.tekup.edutek.repository.ClasseVirtuelleRepository;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.SupportCoursRepository;
import tn.tekup.edutek.security.AccesHelper;
import tn.tekup.edutek.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/classes-virtuelles")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT','ETUDIANT')")
public class ClasseVirtuelleController {

    private static final String ECRIRE = "hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')";
    private static final List<String> PLATEFORMES = List.of("GOOGLE_MEET", "ZOOM", "TEAMS", "AUTRE");
    private static final List<String> TYPES_SUPPORT = List.of("PDF", "VIDEO", "DOCUMENT", "LIEN", "AUTRE");
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final ClasseVirtuelleRepository classeVirtuelleRepository;
    private final SupportCoursRepository supportRepository;
    private final EnseignementRepository enseignementRepository;
    private final EtudiantRepository etudiantRepository;
    private final NotificationService notificationService;
    private final AccesHelper acces;

    // ---------- Classes virtuelles ----------

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize(ECRIRE)
    public List<ClasseVirtuelleDto> lister(Authentication auth) {
        List<ClasseVirtuelle> liste = acces.estAdminPedagogie(auth)
                ? classeVirtuelleRepository.findAllByOrderByDateHeureDesc()
                : classeVirtuelleRepository.findByEnseignementEnseignantEmailOrderByDateHeureDesc(auth.getName());
        return liste.stream().map(ClasseVirtuelleDto::from).toList();
    }

    @GetMapping("/mes-classes")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<ClasseVirtuelleDto> mesClasses(@RequestParam(defaultValue = "false") boolean avenir,
                                               Authentication auth) {
        Etudiant etu = etudiantConnecte(auth);
        if (etu.getClasse() == null) {
            return List.of();
        }
        LocalDateTime maintenant = LocalDateTime.now();
        return classeVirtuelleRepository.findByEnseignementClasseIdOrderByDateHeureDesc(etu.getClasse().getId()).stream()
                .filter(cv -> !avenir || cv.getDateHeure() == null || cv.getDateHeure().isAfter(maintenant))
                .map(ClasseVirtuelleDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ClasseVirtuelleDto detail(@PathVariable Long id, Authentication auth) {
        return ClasseVirtuelleDto.from(lire(id, auth));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(ECRIRE)
    public ClasseVirtuelleDto creer(@Valid @RequestBody ClasseVirtuelleRequest req, Authentication auth) {
        Enseignement ens = enseignementRepository.findById(req.enseignementId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Enseignement introuvable : " + req.enseignementId()));
        acces.verifierProprietaire(auth, ens);
        String plateforme = plateforme(req.plateforme());
        exigerFutur(req.dateHeure());

        ClasseVirtuelle cv = new ClasseVirtuelle();
        cv.setEnseignement(ens);
        cv.setPlateforme(plateforme);
        cv.setLien(req.lien().trim());
        cv.setCodeAcces(videEnNull(req.codeAcces()));
        cv.setDateHeure(req.dateHeure());
        ClasseVirtuelle saved = classeVirtuelleRepository.save(cv);

        notifierEtudiants(saved, "Nouvelle classe virtuelle", libelle(saved));
        return ClasseVirtuelleDto.from(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize(ECRIRE)
    public ClasseVirtuelleDto modifier(@PathVariable Long id, @Valid @RequestBody ClasseVirtuelleRequest req,
                                       Authentication auth) {
        ClasseVirtuelle cv = trouver(id);
        acces.verifierProprietaire(auth, cv.getEnseignement());
        if (!cv.getEnseignement().getId().equals(req.enseignementId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "L'enseignement d'une classe virtuelle n'est pas modifiable");
        }
        String plateforme = plateforme(req.plateforme());
        boolean dateChangee = cv.getDateHeure() == null || !cv.getDateHeure().equals(req.dateHeure());
        if (dateChangee) {
            exigerFutur(req.dateHeure());
        }
        cv.setPlateforme(plateforme);
        cv.setLien(req.lien().trim());
        cv.setCodeAcces(videEnNull(req.codeAcces()));
        cv.setDateHeure(req.dateHeure());
        if (dateChangee) {
            notifierEtudiants(cv, "Classe virtuelle reprogrammee", libelle(cv));
        }
        return ClasseVirtuelleDto.from(cv);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize(ECRIRE)
    public void supprimer(@PathVariable Long id, Authentication auth) {
        ClasseVirtuelle cv = trouver(id);
        acces.verifierProprietaire(auth, cv.getEnseignement());
        classeVirtuelleRepository.delete(cv);
    }

    // ---------- Supports de cours ----------

    @GetMapping("/{id}/supports")
    @Transactional(readOnly = true)
    public List<SupportCoursDto> supports(@PathVariable Long id, Authentication auth) {
        ClasseVirtuelle cv = lire(id, auth);
        return supportRepository.findByClasseVirtuelleIdOrderByDateDepotDesc(cv.getId()).stream()
                .map(SupportCoursDto::from).toList();
    }

    @PostMapping("/{id}/supports")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(ECRIRE)
    public SupportCoursDto ajouterSupport(@PathVariable Long id, @Valid @RequestBody SupportCoursRequest req,
                                          Authentication auth) {
        ClasseVirtuelle cv = trouver(id);
        acces.verifierProprietaire(auth, cv.getEnseignement());
        SupportCours s = new SupportCours();
        s.setClasseVirtuelle(cv);
        remplirSupport(s, req);
        SupportCours saved = supportRepository.save(s);
        notifierEtudiants(cv, "Nouveau support de cours", saved.getTitre() + " - " + libelle(cv));
        return SupportCoursDto.from(saved);
    }

    @PutMapping("/{id}/supports/{supportId}")
    @Transactional
    @PreAuthorize(ECRIRE)
    public SupportCoursDto modifierSupport(@PathVariable Long id, @PathVariable Long supportId,
                                           @Valid @RequestBody SupportCoursRequest req, Authentication auth) {
        ClasseVirtuelle cv = trouver(id);
        acces.verifierProprietaire(auth, cv.getEnseignement());
        SupportCours s = supportRepository.findByIdAndClasseVirtuelleId(supportId, id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Support introuvable : " + supportId));
        remplirSupport(s, req);
        return SupportCoursDto.from(s);
    }

    @DeleteMapping("/{id}/supports/{supportId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize(ECRIRE)
    public void supprimerSupport(@PathVariable Long id, @PathVariable Long supportId, Authentication auth) {
        ClasseVirtuelle cv = trouver(id);
        acces.verifierProprietaire(auth, cv.getEnseignement());
        SupportCours s = supportRepository.findByIdAndClasseVirtuelleId(supportId, id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Support introuvable : " + supportId));
        supportRepository.delete(s);
    }

    // ---------- Utilitaires ----------

    private ClasseVirtuelle trouver(Long id) {
        return classeVirtuelleRepository.findById(id).orElseThrow(() -> introuvable(id));
    }

    private ClasseVirtuelle lire(Long id, Authentication auth) {
        ClasseVirtuelle cv = trouver(id);
        if (peutLire(cv, auth)) {
            return cv;
        }
        throw introuvable(id);
    }

    private boolean peutLire(ClasseVirtuelle cv, Authentication auth) {
        if (acces.estProprietaire(auth, cv.getEnseignement())) {
            return true;
        }
        Etudiant etu = etudiantRepository.findByEmail(auth.getName()).orElse(null);
        return etu != null && etu.getClasse() != null
                && etu.getClasse().getId().equals(cv.getEnseignement().getClasse().getId());
    }

    private Etudiant etudiantConnecte(Authentication auth) {
        return etudiantRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil etudiant introuvable"));
    }

    private ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Classe virtuelle introuvable : " + id);
    }

    private String plateforme(String brute) {
        String p = brute.trim().toUpperCase(Locale.ROOT);
        if (!PLATEFORMES.contains(p)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Plateforme invalide. Valeurs : " + String.join(", ", PLATEFORMES));
        }
        return p;
    }

    private void exigerFutur(LocalDateTime dateHeure) {
        if (!dateHeure.isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date et l'heure doivent etre dans le futur");
        }
    }

    private void remplirSupport(SupportCours s, SupportCoursRequest req) {
        String type = req.type().trim().toUpperCase(Locale.ROOT);
        if (!TYPES_SUPPORT.contains(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Type invalide. Valeurs : " + String.join(", ", TYPES_SUPPORT));
        }
        s.setTitre(req.titre().trim());
        s.setType(type);
        s.setUrl(req.url().trim());
    }

    private String libelle(ClasseVirtuelle cv) {
        return cv.getEnseignement().getMatiere().getNom() + " - " + FORMAT.format(cv.getDateHeure());
    }

    private void notifierEtudiants(ClasseVirtuelle cv, String titre, String contenu) {
        Long classeId = cv.getEnseignement().getClasse().getId();
        for (Etudiant e : etudiantRepository.findByClasseId(classeId)) {
            if (Boolean.TRUE.equals(e.getActif())) {
                notificationService.notifier(e, titre, contenu);
            }
        }
    }

    private static String videEnNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}