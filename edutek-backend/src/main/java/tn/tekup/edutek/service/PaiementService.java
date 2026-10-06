package tn.tekup.edutek.service;

import tn.tekup.edutek.entity.Enseignant;
import tn.tekup.edutek.entity.EtatPaiement;
import tn.tekup.edutek.entity.LignePaiement;
import tn.tekup.edutek.entity.Pointage;
import tn.tekup.edutek.entity.TarifHoraire;
import tn.tekup.edutek.repository.EnseignantRepository;
import tn.tekup.edutek.repository.EtatPaiementRepository;
import tn.tekup.edutek.repository.PointageRepository;
import tn.tekup.edutek.repository.TarifHoraireRepository;
import tn.tekup.edutek.util.PaiementCalcul;
import tn.tekup.edutek.util.PaiementCalcul.Candidat;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PaiementService {

    private static final List<String> A_PAYER = List.of("VALIDE", "CORRIGE");

    public record Resultat(List<EtatPaiement> etats, List<String> avertissements) {}

    private final PointageRepository pointageRepository;
    private final EtatPaiementRepository etatRepository;
    private final TarifHoraireRepository tarifRepository;
    private final EnseignantRepository enseignantRepository;
    private final AuditService audit;

    @Transactional
    public Resultat generer(YearMonth periode, Long enseignantId) {
        LocalDate debut = periode.atDay(1);
        LocalDate fin = periode.atEndOfMonth();

        Set<Long> ids = new LinkedHashSet<>();
        if (enseignantId != null) {
            if (!enseignantRepository.existsById(enseignantId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Enseignant introuvable : " + enseignantId);
            }
            ids.add(enseignantId);
        } else {
            for (Pointage p : pointageRepository.findBySeanceDateBetweenAndStatutIn(debut, fin, A_PAYER)) {
                ids.add(p.getSeance().getEnseignement().getEnseignant().getId());
            }
        }

        List<TarifHoraire> tarifs = tarifRepository.findAll();
        Map<Long, TarifHoraire> tarifParId = new HashMap<>();
        List<Candidat> candidats = new ArrayList<>();
        for (TarifHoraire t : tarifs) {
            if (t.getMontant() == null || t.getDateDebut() == null) {
                continue;
            }
            tarifParId.put(t.getId(), t);
            candidats.add(new Candidat(t.getId(), t.getGrade(), t.getDateDebut(), BigDecimal.valueOf(t.getMontant())));
        }

        List<EtatPaiement> etats = new ArrayList<>();
        List<String> avertissements = new ArrayList<>();

        for (Long id : ids) {
            Enseignant ens = enseignantRepository.findById(id).orElseThrow();
            String nom = ens.getPrenom() + " " + ens.getNom();

            long enAttente = pointageRepository.countBySeanceEnseignementEnseignantIdAndSeanceDateBetweenAndStatut(
                    id, debut, fin, "EN_ATTENTE");
            if (enAttente > 0) {
                avertissements.add(nom + " : " + enAttente + " pointage(s) en attente non pris en compte");
            }

            List<Pointage> aPayer = pointageRepository
                    .findBySeanceEnseignementEnseignantIdAndSeanceDateBetweenAndStatutInOrderBySeanceDateAscSeanceHeureDebutAsc(
                            id, debut, fin, A_PAYER);
            if (aPayer.isEmpty()) {
                avertissements.add(nom + " : aucun pointage valide pour " + periode);
                continue;
            }

            EtatPaiement existant = etatRepository.findByEnseignantIdAndPeriode(id, periode.toString()).orElse(null);
            if (existant != null && !"BROUILLON".equals(existant.getStatut())) {
                avertissements.add(nom + " : etat deja " + existant.getStatut() + ", non regenere");
                continue;
            }

            // Calcul complet avant toute ecriture : un tarif manquant n'altere rien.
            List<LignePaiement> lignes = new ArrayList<>();
            BigDecimal total = BigDecimal.ZERO;
            int totalMinutes = 0;
            boolean tarifManquant = false;
            for (Pointage p : aPayer) {
                LocalDate date = p.getSeance().getDate();
                Optional<Candidat> tarif = PaiementCalcul.resoudreTarif(candidats, ens.getGrade(), date);
                if (tarif.isEmpty()) {
                    avertissements.add(nom + " : aucun tarif applicable au " + date
                            + (ens.getGrade() == null || ens.getGrade().isBlank() ? "" : " (grade " + ens.getGrade().trim() + ")"));
                    tarifManquant = true;
                    break;
                }
                int minutes = p.getMinutesValidees();
                BigDecimal montant = PaiementCalcul.montantLigne(minutes, tarif.get().montant());
                LignePaiement l = new LignePaiement();
                l.setPointage(p);
                l.setTarif(tarifParId.get(tarif.get().id()));
                l.setMinutes(minutes);
                l.setTarifHoraire(tarif.get().montant().doubleValue());
                l.setMontant(montant.doubleValue());
                lignes.add(l);
                total = total.add(montant);
                totalMinutes += minutes;
            }
            if (tarifManquant) {
                continue;
            }

            EtatPaiement etat;
            if (existant != null) {
                etat = existant;
                etat.getLignes().clear();
                etatRepository.flush();
            } else {
                etat = new EtatPaiement();
                etat.setEnseignant(ens);
                etat.setPeriode(periode.toString());
            }
            for (LignePaiement l : lignes) {
                l.setEtat(etat);
                etat.getLignes().add(l);
            }
            etat.setMinutes(totalMinutes);
            etat.setMontant(total.doubleValue());
            etat.setStatut("BROUILLON");
            etat.setDateGeneration(LocalDateTime.now());
            EtatPaiement saved = etatRepository.save(etat);
            etats.add(saved);
            audit.log("PAIEMENT_GENERE", "EtatPaiement", saved.getId(),
                    nom + " " + periode + " : " + totalMinutes + " min, " + total.toPlainString());
        }
        return new Resultat(etats, avertissements);
    }
}