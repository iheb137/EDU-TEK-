package tn.tekup.edutek.service;

import tn.tekup.edutek.dto.BulletinDto;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.IndicateurAcademique;
import tn.tekup.edutek.entity.Presence;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.IndicateurAcademiqueRepository;
import tn.tekup.edutek.repository.PresenceRepository;
import tn.tekup.edutek.repository.ResultatSemestreRepository;
import tn.tekup.edutek.repository.SemestreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IndicateurService {

    private final ResultatService resultatService;
    private final ResultatSemestreRepository resultatRepository;
    private final PresenceRepository presenceRepository;
    private final SemestreRepository semestreRepository;
    private final IndicateurAcademiqueRepository indicateurRepository;

    @Transactional
    public List<IndicateurAcademique> calculer(Etudiant etu, Semestre sem) {
        BulletinDto b = resultatService.bulletin(etu, sem);
        Map<String, Double> valeurs = new LinkedHashMap<>();

        if (b.moyenne() != null) {
            valeurs.put("MOYENNE_SEMESTRE", b.moyenne());
        }
        valeurs.put("CREDITS_OBTENUS", (double) b.creditsObtenus());
        valeurs.put("NB_MATIERES_NON_VALIDEES",
                (double) b.matieres().stream().filter(l -> l.moyenne() != null && !l.valide()).count());

        List<Presence> presences = presenceRepository
                .findByEtudiantIdAndSeanceEnseignementSemestreId(etu.getId(), sem.getId());
        if (!presences.isEmpty()) {
            long absences = presences.stream().filter(p -> !Boolean.TRUE.equals(p.getPresent())).count();
            long nonJustifiees = presences.stream()
                    .filter(p -> !Boolean.TRUE.equals(p.getPresent())
                            && (p.getJustification() == null || p.getJustification().isBlank()))
                    .count();
            valeurs.put("NB_SEANCES_POINTEES", (double) presences.size());
            valeurs.put("TAUX_ABSENCE", ratio(absences, presences.size()));
            valeurs.put("TAUX_ABSENCE_NON_JUSTIFIEE", ratio(nonJustifiees, presences.size()));
        }

        if (b.moyenne() != null && sem.getDateDebut() != null) {
            semestreRepository
                    .findByFormationIdAndDateDebutBeforeOrderByDateDebutDesc(sem.getFormation().getId(), sem.getDateDebut())
                    .stream().findFirst()
                    .flatMap(prev -> resultatRepository.findByEtudiantIdAndSemestreId(etu.getId(), prev.getId()))
                    .filter(r -> r.getMoyenne() != null)
                    .ifPresent(r -> valeurs.put("TENDANCE_MOYENNE", arrondi(b.moyenne() - r.getMoyenne())));
        }

        Map<String, IndicateurAcademique> existants = indicateurRepository
                .findByEtudiantIdAndSemestreId(etu.getId(), sem.getId()).stream()
                .collect(Collectors.toMap(IndicateurAcademique::getNom, i -> i));

        LocalDateTime maintenant = LocalDateTime.now();
        List<IndicateurAcademique> resultat = new ArrayList<>();
        for (Map.Entry<String, Double> e : valeurs.entrySet()) {
            IndicateurAcademique ind = existants.remove(e.getKey());
            if (ind == null) {
                ind = new IndicateurAcademique();
                ind.setNom(e.getKey());
                ind.setEtudiant(etu);
                ind.setSemestre(sem);
            }
            ind.setValeur(e.getValue());
            ind.setDateCalcul(maintenant);
            resultat.add(indicateurRepository.save(ind));
        }
        indicateurRepository.deleteAll(existants.values());
        return resultat;
    }

    private static double ratio(long numerateur, long denominateur) {
        return Math.round(numerateur * 10000.0 / denominateur) / 10000.0;
    }

    private static double arrondi(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}