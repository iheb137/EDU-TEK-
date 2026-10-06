package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.GenerationResultDto;
import tn.tekup.edutek.dto.PaiementDto;
import tn.tekup.edutek.entity.AdminFinancier;
import tn.tekup.edutek.entity.EtatPaiement;
import tn.tekup.edutek.repository.AdminFinancierRepository;
import tn.tekup.edutek.repository.EtatPaiementRepository;
import tn.tekup.edutek.service.NotificationService;
import tn.tekup.edutek.service.PaiementService;
import tn.tekup.edutek.util.Periodes;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/paiements")
@RequiredArgsConstructor
public class PaiementController {

    private static final String LECTURE_FINANCE = "hasAnyRole('SUPERADMIN','ADMIN_FINANCIER')";
    private static final String FINANCE = "hasRole('ADMIN_FINANCIER')";
    private static final List<String> STATUTS = List.of("BROUILLON", "VALIDE", "PAYE");

    private final EtatPaiementRepository etatRepository;
    private final PaiementService paiementService;
    private final AdminFinancierRepository adminFinancierRepository;
    private final NotificationService notificationService;

    @PostMapping("/generer")
    @Transactional
    @PreAuthorize(LECTURE_FINANCE)
    public GenerationResultDto generer(@RequestParam String periode, @RequestParam(required = false) Long enseignantId) {
        YearMonth ym = Periodes.analyser(periode);
        if (ym.isAfter(YearMonth.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Periode future : generation impossible");
        }
        PaiementService.Resultat r = paiementService.generer(ym, enseignantId);
        return new GenerationResultDto(ym.toString(),
                r.etats().stream().map(e -> PaiementDto.from(e, true)).toList(), r.avertissements());
    }

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize(LECTURE_FINANCE)
    public List<PaiementDto> lister(@RequestParam(required = false) String periode,
                                    @RequestParam(required = false) String statut,
                                    @RequestParam(required = false) Long enseignantId) {
        String p = periode == null || periode.isBlank() ? "" : Periodes.analyser(periode).toString();
        String s = statut == null || statut.isBlank() ? "" : statut.trim().toUpperCase(Locale.ROOT);
        if (!s.isEmpty() && !STATUTS.contains(s)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide. Valeurs : " + String.join(", ", STATUTS));
        }
        return etatRepository.rechercher(p, s, enseignantId == null ? 0L : enseignantId).stream()
                .map(e -> PaiementDto.from(e, false)).toList();
    }

    @GetMapping("/mes-paiements")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ENSEIGNANT')")
    public List<PaiementDto> mesPaiements(Authentication auth) {
        return etatRepository.findByEnseignantEmailAndStatutInOrderByPeriodeDesc(auth.getName(), List.of("VALIDE", "PAYE"))
                .stream().map(e -> PaiementDto.from(e, true)).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public PaiementDto detail(@PathVariable Long id, Authentication auth) {
        EtatPaiement e = etatRepository.findById(id).orElseThrow(() -> introuvable(id));
        boolean finance = auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_ADMIN_FINANCIER") || a.getAuthority().equals("ROLE_SUPERADMIN"));
        boolean proprietaire = e.getEnseignant().getEmail().equals(auth.getName()) && !"BROUILLON".equals(e.getStatut());
        if (!finance && !proprietaire) {
            throw introuvable(id);
        }
        return PaiementDto.from(e, true);
    }

    @PostMapping("/{id}/valider")
    @Transactional
    @PreAuthorize(FINANCE)
    public PaiementDto valider(@PathVariable Long id, Authentication auth) {
        EtatPaiement e = verrouiller(id);
        if (!"BROUILLON".equals(e.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seul un brouillon peut etre valide (statut : " + e.getStatut() + ")");
        }
        AdminFinancier fin = adminFinancierRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur financier introuvable"));
        e.setStatut("VALIDE");
        e.setValidePar(fin);
        e.setDateValidation(LocalDateTime.now());
        notificationService.notifier(e.getEnseignant(), "Etat de paiement valide",
                "Votre etat de paiement " + e.getPeriode() + " est valide : " + e.getMontant());
        return PaiementDto.from(e, true);
    }

    @PostMapping("/{id}/payer")
    @Transactional
    @PreAuthorize(FINANCE)
    public PaiementDto payer(@PathVariable Long id) {
        EtatPaiement e = verrouiller(id);
        if (!"VALIDE".equals(e.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seul un etat valide peut etre paye (statut : " + e.getStatut() + ")");
        }
        e.setStatut("PAYE");
        e.setDatePaiement(LocalDateTime.now());
        notificationService.notifier(e.getEnseignant(), "Etat de paiement paye",
                "Votre etat de paiement " + e.getPeriode() + " a ete paye.");
        return PaiementDto.from(e, true);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize(FINANCE)
    public void supprimer(@PathVariable Long id) {
        EtatPaiement e = verrouiller(id);
        if (!"BROUILLON".equals(e.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seul un brouillon peut etre supprime (statut : " + e.getStatut() + ")");
        }
        etatRepository.delete(e);
    }

    private EtatPaiement verrouiller(Long id) {
        return etatRepository.findByIdForUpdate(id).orElseThrow(() -> introuvable(id));
    }

    private ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Etat de paiement introuvable : " + id);
    }
}