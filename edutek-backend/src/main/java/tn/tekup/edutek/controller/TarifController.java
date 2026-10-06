package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.TarifDto;
import tn.tekup.edutek.dto.TarifRequest;
import tn.tekup.edutek.entity.AdminFinancier;
import tn.tekup.edutek.entity.TarifHoraire;
import tn.tekup.edutek.repository.AdminFinancierRepository;
import tn.tekup.edutek.repository.LignePaiementRepository;
import tn.tekup.edutek.repository.TarifHoraireRepository;
import tn.tekup.edutek.util.PaiementCalcul;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/tarifs")
@RequiredArgsConstructor
public class TarifController {

    private static final String LECTURE_FINANCE = "hasAnyRole('SUPERADMIN','ADMIN_FINANCIER')";
    private static final String FINANCE = "hasRole('ADMIN_FINANCIER')";

    private final TarifHoraireRepository tarifRepository;
    private final AdminFinancierRepository adminFinancierRepository;
    private final LignePaiementRepository lignePaiementRepository;

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize(LECTURE_FINANCE)
    public List<TarifDto> lister() {
        return tarifRepository.findAllByOrderByDateDebutDescIdDesc().stream().map(TarifDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(FINANCE)
    public TarifDto creer(@Valid @RequestBody TarifRequest req, Authentication auth) {
        if (req.montant() > 100000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Montant horaire limite a 100000");
        }
        if (BigDecimal.valueOf(req.montant()).scale() > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Montant : 3 decimales maximum");
        }
        String grade = req.grade() == null || req.grade().isBlank() ? null : req.grade().trim();
        String cle = PaiementCalcul.normaliser(grade);
        for (TarifHoraire t : tarifRepository.findAll()) {
            if (req.dateDebut().equals(t.getDateDebut()) && Objects.equals(cle, PaiementCalcul.normaliser(t.getGrade()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Un tarif existe deja pour cette date d'effet" + (grade == null ? " (tarif general)" : " et ce grade"));
            }
        }
        AdminFinancier auteur = adminFinancierRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur financier introuvable"));
        TarifHoraire t = new TarifHoraire();
        t.setMontant(req.montant());
        t.setDateDebut(req.dateDebut());
        t.setGrade(grade);
        t.setDefiniPar(auteur);
        return TarifDto.from(tarifRepository.save(t));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize(FINANCE)
    public void supprimer(@PathVariable Long id) {
        TarifHoraire t = tarifRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Tarif introuvable : " + id));
        if (lignePaiementRepository.existsByTarifId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tarif utilise par des etats de paiement : suppression impossible");
        }
        tarifRepository.delete(t);
    }
}