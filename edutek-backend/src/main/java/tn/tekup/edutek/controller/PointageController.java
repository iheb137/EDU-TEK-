package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.AnomalieRequest;
import tn.tekup.edutek.dto.CorrectionRequest;
import tn.tekup.edutek.dto.PointageDto;
import tn.tekup.edutek.dto.PointageRequest;
import tn.tekup.edutek.dto.PointageUpdateRequest;
import tn.tekup.edutek.entity.AdminFinancier;
import tn.tekup.edutek.entity.Enseignant;
import tn.tekup.edutek.entity.Pointage;
import tn.tekup.edutek.entity.Seance;
import tn.tekup.edutek.repository.AdminFinancierRepository;
import tn.tekup.edutek.repository.LignePaiementRepository;
import tn.tekup.edutek.repository.PointageRepository;
import tn.tekup.edutek.repository.SeanceRepository;
import tn.tekup.edutek.security.AccesHelper;
import tn.tekup.edutek.service.NotificationService;
import tn.tekup.edutek.util.PaiementCalcul;
import tn.tekup.edutek.util.Periodes;
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
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/pointages")
@RequiredArgsConstructor
public class PointageController {

    private static final String ENSEIGNEMENT = "hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')";
    private static final String LECTURE_FINANCE = "hasAnyRole('SUPERADMIN','ADMIN_FINANCIER')";
    private static final String FINANCE = "hasRole('ADMIN_FINANCIER')";
    private static final List<String> STATUTS = List.of("EN_ATTENTE", "VALIDE", "CORRIGE", "ANOMALIE");
    private static final List<String> FIGES = List.of("VALIDE", "PAYE");
    private static final LocalDate MIN = LocalDate.of(1900, 1, 1);
    private static final LocalDate MAX = LocalDate.of(2999, 12, 31);

    private final PointageRepository pointageRepository;
    private final SeanceRepository seanceRepository;
    private final AdminFinancierRepository adminFinancierRepository;
    private final LignePaiementRepository lignePaiementRepository;
    private final NotificationService notificationService;
    private final AccesHelper acces;

    // ---------- Enseignant ----------

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(ENSEIGNEMENT)
    public PointageDto pointer(@Valid @RequestBody PointageRequest req, Authentication auth) {
        Seance seance = seanceRepository.findById(req.seanceId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Seance introuvable : " + req.seanceId()));
        acces.verifierProprietaire(auth, seance.getEnseignement());
        if (seance.getDate().isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Impossible de pointer une seance future");
        }
        if (pointageRepository.findBySeanceId(seance.getId()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette seance est deja pointee");
        }
        int minutes = req.minutes() != null ? req.minutes()
                : PaiementCalcul.minutes(seance.getHeureDebut(), seance.getHeureFin());
        if (minutes < 1 || minutes > 720) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duree comprise entre 1 et 720 minutes");
        }
        Pointage p = new Pointage();
        p.setSeance(seance);
        p.setMinutesDeclarees(minutes);
        p.setCommentaire(videEnNull(req.commentaire()));
        return PointageDto.from(pointageRepository.save(p));
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize(ENSEIGNEMENT)
    public PointageDto modifier(@PathVariable Long id, @Valid @RequestBody PointageUpdateRequest req,
                                Authentication auth) {
        Pointage p = trouver(id);
        acces.verifierProprietaire(auth, p.getSeance().getEnseignement());
        exigerEnAttente(p);
        if (req.minutes() != null) {
            p.setMinutesDeclarees(req.minutes());
        }
        p.setCommentaire(videEnNull(req.commentaire()));
        return PointageDto.from(p);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize(ENSEIGNEMENT)
    public void retirer(@PathVariable Long id, Authentication auth) {
        Pointage p = trouver(id);
        acces.verifierProprietaire(auth, p.getSeance().getEnseignement());
        exigerEnAttente(p);
        pointageRepository.delete(p);
    }

    @GetMapping("/mes-pointages")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ENSEIGNANT')")
    public List<PointageDto> mesPointages(@RequestParam(required = false) String periode, Authentication auth) {
        LocalDate[] bornes = bornes(periode);
        return pointageRepository
                .findBySeanceEnseignementEnseignantEmailAndSeanceDateBetweenOrderBySeanceDateDescIdDesc(
                        auth.getName(), bornes[0], bornes[1])
                .stream().map(PointageDto::from).toList();
    }

    // ---------- Finance : lecture ----------

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize(LECTURE_FINANCE)
    public List<PointageDto> lister(@RequestParam(required = false) String periode,
                                    @RequestParam(required = false) String statut,
                                    @RequestParam(required = false) Long enseignantId) {
        LocalDate[] bornes = bornes(periode);
        String s = statut == null || statut.isBlank() ? null : statut.trim().toUpperCase(Locale.ROOT);
        if (s != null && !STATUTS.contains(s)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide. Valeurs : " + String.join(", ", STATUTS));
        }
        return pointageRepository.findBySeanceDateBetweenOrderBySeanceDateDescIdDesc(bornes[0], bornes[1]).stream()
                .filter(p -> s == null || p.getStatut().equals(s))
                .filter(p -> enseignantId == null
                        || p.getSeance().getEnseignement().getEnseignant().getId().equals(enseignantId))
                .map(PointageDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public PointageDto detail(@PathVariable Long id, Authentication auth) {
        Pointage p = trouver(id);
        boolean finance = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN_FINANCIER"));
        if (!finance && !acces.estProprietaire(auth, p.getSeance().getEnseignement())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pointage introuvable : " + id);
        }
        return PointageDto.from(p);
    }

    // ---------- Finance : decisions ----------

    @PostMapping("/{id}/valider")
    @Transactional
    @PreAuthorize(FINANCE)
    public PointageDto valider(@PathVariable Long id, Authentication auth) {
        Pointage p = trouver(id);
        exigerModifiable(p);
        decider(p, "VALIDE", p.getMinutesDeclarees(), null, auth);
        notificationService.notifier(enseignantDe(p), "Pointage valide", description(p));
        return PointageDto.from(p);
    }

    @PostMapping("/{id}/corriger")
    @Transactional
    @PreAuthorize(FINANCE)
    public PointageDto corriger(@PathVariable Long id, @Valid @RequestBody CorrectionRequest req, Authentication auth) {
        Pointage p = trouver(id);
        exigerModifiable(p);
        decider(p, "CORRIGE", req.minutes(), req.commentaire().trim(), auth);
        notificationService.notifier(enseignantDe(p), "Pointage corrige",
                description(p) + " : " + req.minutes() + " min retenues. " + p.getCommentaireFinance());
        return PointageDto.from(p);
    }

    @PostMapping("/{id}/anomalie")
    @Transactional
    @PreAuthorize(FINANCE)
    public PointageDto anomalie(@PathVariable Long id, @Valid @RequestBody AnomalieRequest req, Authentication auth) {
        Pointage p = trouver(id);
        exigerModifiable(p);
        decider(p, "ANOMALIE", null, req.commentaire().trim(), auth);
        notificationService.notifier(enseignantDe(p), "Pointage en anomalie",
                description(p) + " : " + p.getCommentaireFinance());
        return PointageDto.from(p);
    }

    @PostMapping("/valider-periode")
    @Transactional
    @PreAuthorize(FINANCE)
    public Map<String, Integer> validerPeriode(@RequestParam String periode,
                                               @RequestParam(required = false) Long enseignantId,
                                               Authentication auth) {
        YearMonth ym = Periodes.analyser(periode);
        List<Pointage> enAttente = pointageRepository
                .findBySeanceDateBetweenOrderBySeanceDateDescIdDesc(ym.atDay(1), ym.atEndOfMonth()).stream()
                .filter(p -> "EN_ATTENTE".equals(p.getStatut()))
                .filter(p -> enseignantId == null
                        || p.getSeance().getEnseignement().getEnseignant().getId().equals(enseignantId))
                .toList();
        Map<Long, Integer> parEnseignant = new HashMap<>();
        Map<Long, Enseignant> enseignants = new HashMap<>();
        for (Pointage p : enAttente) {
            decider(p, "VALIDE", p.getMinutesDeclarees(), null, auth);
            Enseignant e = enseignantDe(p);
            parEnseignant.merge(e.getId(), 1, Integer::sum);
            enseignants.put(e.getId(), e);
        }
        for (Map.Entry<Long, Integer> entree : parEnseignant.entrySet()) {
            notificationService.notifier(enseignants.get(entree.getKey()), "Pointages valides",
                    entree.getValue() + " pointage(s) valide(s) pour " + ym);
        }
        return Map.of("valides", enAttente.size());
    }

    // ---------- Utilitaires ----------

    private void decider(Pointage p, String statut, Integer minutes, String commentaireFinance, Authentication auth) {
        AdminFinancier fin = adminFinancierRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur financier introuvable"));
        p.setStatut(statut);
        p.setMinutesValidees(minutes);
        p.setCommentaireFinance(commentaireFinance);
        p.setValidePar(fin);
        p.setDateValidation(LocalDateTime.now());
    }

    private Pointage trouver(Long id) {
        return pointageRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Pointage introuvable : " + id));
    }

    private void exigerEnAttente(Pointage p) {
        if (!"EN_ATTENTE".equals(p.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce pointage a deja ete traite par la finance (statut : " + p.getStatut() + ")");
        }
    }

    private void exigerModifiable(Pointage p) {
        if (lignePaiementRepository.existsByPointageIdAndEtatStatutIn(p.getId(), FIGES)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Pointage deja inclus dans un etat de paiement valide ou paye");
        }
    }

    private Enseignant enseignantDe(Pointage p) {
        return p.getSeance().getEnseignement().getEnseignant();
    }

    private String description(Pointage p) {
        return p.getSeance().getEnseignement().getMatiere().getNom() + " - " + p.getSeance().getDate();
    }

    private LocalDate[] bornes(String periode) {
        if (periode == null || periode.isBlank()) {
            return new LocalDate[]{MIN, MAX};
        }
        YearMonth ym = Periodes.analyser(periode);
        return new LocalDate[]{ym.atDay(1), ym.atEndOfMonth()};
    }

    private static String videEnNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}