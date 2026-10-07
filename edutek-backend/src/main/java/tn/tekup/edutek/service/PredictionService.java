package tn.tekup.edutek.service;

import tn.tekup.edutek.dto.PredictionDto;
import tn.tekup.edutek.entity.AdminPedagogique;
import tn.tekup.edutek.entity.AlerteRisque;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.FacteurExplicatif;
import tn.tekup.edutek.entity.IndicateurAcademique;
import tn.tekup.edutek.entity.ModeleIA;
import tn.tekup.edutek.entity.ParametresRisque;
import tn.tekup.edutek.entity.PredictionIA;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.ia.ContratIa.DemandePrediction;
import tn.tekup.edutek.ia.ContratIa.FacteurIa;
import tn.tekup.edutek.ia.ContratIa.PeriodeIndicateurs;
import tn.tekup.edutek.ia.ContratIa.ReponsePrediction;
import tn.tekup.edutek.ia.ServiceIa;
import tn.tekup.edutek.repository.AdminPedagogiqueRepository;
import tn.tekup.edutek.repository.AlerteRisqueRepository;
import tn.tekup.edutek.repository.ClasseRepository;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.IndicateurAcademiqueRepository;
import tn.tekup.edutek.repository.ModeleIARepository;
import tn.tekup.edutek.repository.ParametresRisqueRepository;
import tn.tekup.edutek.repository.PredictionIARepository;
import tn.tekup.edutek.repository.SemestreRepository;
import tn.tekup.edutek.util.ModeleRegles;
import tn.tekup.edutek.util.NiveauRisque;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PredictionService {

    public static final String TYPE_PREDICTION = "RISQUE_ECHEC_SEMESTRE";
    private static final List<String> ALERTES_OUVERTES = List.of("OUVERTE", "EN_COURS");

    public record Resultat(PredictionDto prediction, boolean alerteCreee) {}

    private final ServiceIa serviceIa;
    private final IndicateurService indicateurService;
    private final IndicateurAcademiqueRepository indicateurRepository;
    private final ModeleIARepository modeleRepository;
    private final PredictionIARepository predictionRepository;
    private final AlerteRisqueRepository alerteRepository;
    private final ParametresRisqueRepository parametresRepository;
    private final AdminPedagogiqueRepository adminPedagogiqueRepository;
    private final EtudiantRepository etudiantRepository;
    private final SemestreRepository semestreRepository;
    private final EnseignementRepository enseignementRepository;
    private final ClasseRepository classeRepository;
    private final NotificationService notificationService;

    @Transactional
    public ParametresRisque parametres() {
        return parametresRepository.findById(1L).orElseGet(() -> {
            ParametresRisque p = new ParametresRisque();
            p.setId(1L);
            return parametresRepository.save(p);
        });
    }

    /** Identifiants des etudiants a analyser : un etudiant, une classe, ou toutes les classes ayant cours ce semestre. */
    @Transactional(readOnly = true)
    public List<Long> cibles(Long semestreId, Long etudiantId, Long classeId) {
        if (!semestreRepository.existsById(semestreId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + semestreId);
        }
        if (etudiantId != null && classeId != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "etudiantId et classeId sont exclusifs");
        }
        if (etudiantId != null) {
            if (!etudiantRepository.existsById(etudiantId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + etudiantId);
            }
            return List.of(etudiantId);
        }
        Set<Long> classes = new LinkedHashSet<>();
        if (classeId != null) {
            if (!classeRepository.existsById(classeId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Classe introuvable : " + classeId);
            }
            classes.add(classeId);
        } else {
            for (Enseignement e : enseignementRepository.findBySemestreId(semestreId)) {
                classes.add(e.getClasse().getId());
            }
        }
        List<Long> ids = new ArrayList<>();
        for (Long c : classes) {
            for (Etudiant e : etudiantRepository.findByClasseId(c)) {
                ids.add(e.getId());
            }
        }
        return ids;
    }

    @Transactional
    public Resultat analyser(Long etudiantId, Long semestreId) {
        Etudiant etu = etudiantRepository.findById(etudiantId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + etudiantId));
        Semestre sem = semestreRepository.findById(semestreId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + semestreId));

        List<IndicateurAcademique> actuels = indicateurService.calculer(etu, sem);
        Map<String, Double> courant = new LinkedHashMap<>();
        for (IndicateurAcademique i : actuels) {
            courant.put(i.getNom(), i.getValeur());
        }

        Map<Long, List<IndicateurAcademique>> parSemestre = new LinkedHashMap<>();
        for (IndicateurAcademique i : indicateurRepository.findByEtudiantId(etudiantId)) {
            Semestre s = i.getSemestre();
            if (s.getId().equals(semestreId) || s.getDateDebut() == null || sem.getDateDebut() == null
                    || !s.getDateDebut().isBefore(sem.getDateDebut())) {
                continue;
            }
            parSemestre.computeIfAbsent(s.getId(), k -> new ArrayList<>()).add(i);
        }
        List<PeriodeIndicateurs> historique = parSemestre.values().stream().map(liste -> {
            Semestre s = liste.get(0).getSemestre();
            Map<String, Double> m = new LinkedHashMap<>();
            for (IndicateurAcademique i : liste) {
                m.put(i.getNom(), i.getValeur());
            }
            return new PeriodeIndicateurs(s.getId(), s.getDateDebut(), m);
        }).sorted(Comparator.comparing(PeriodeIndicateurs::dateDebut)).toList();

        ReponsePrediction reponse = serviceIa.predire(new DemandePrediction(etudiantId, semestreId, courant, historique));

        ModeleIA modele = modeleRepository.findByNomAndVersion(reponse.modele().nom(), reponse.modele().version())
                .orElseGet(() -> {
                    ModeleIA m = new ModeleIA();
                    m.setNom(reponse.modele().nom());
                    m.setVersion(reponse.modele().version());
                    m.setType(reponse.modele().type());
                    m.setStatut(ModeleRegles.TYPE.equals(reponse.modele().type()) ? "STUB" : "ENTRAINE");
                    return modeleRepository.save(m);
                });

        ParametresRisque params = parametres();
        String niveau = NiveauRisque.depuis(reponse.probabilite(), params.getSeuilMoyen(), params.getSeuilEleve());

        PredictionIA p = new PredictionIA();
        p.setType(TYPE_PREDICTION);
        p.setEtudiant(etu);
        p.setSemestre(sem);
        p.setModeleIA(modele);
        p.setProbabilite(reponse.probabilite());
        p.setNiveau(niveau);
        int rang = 1;
        for (FacteurIa f : reponse.facteurs()) {
            FacteurExplicatif fe = new FacteurExplicatif();
            fe.setPrediction(p);
            fe.setNom(f.nom());
            fe.setValeur(f.valeur());
            fe.setContribution(f.contribution());
            fe.setRang(rang++);
            p.getFacteurs().add(fe);
        }
        PredictionIA saved = predictionRepository.save(p);

        boolean creee = false;
        Optional<AlerteRisque> ouverte = alerteRepository
                .findFirstByPredictionEtudiantIdAndPredictionSemestreIdAndStatutInOrderByDateDetectionDesc(
                        etudiantId, semestreId, ALERTES_OUVERTES);
        AlerteRisque alerte;
        if (ouverte.isPresent()) {
            alerte = ouverte.get();
            alerte.setPrediction(saved);
            alerte.setNiveau(niveau);
            alerte.setScore(reponse.probabilite());
        } else if (!"FAIBLE".equals(niveau)) {
            alerte = new AlerteRisque();
            alerte.setPrediction(saved);
            alerte.setNiveau(niveau);
            alerte.setScore(reponse.probabilite());
            alerte = alerteRepository.save(alerte);
            creee = true;
            if ("ELEVE".equals(niveau)) {
                for (AdminPedagogique a : adminPedagogiqueRepository.findAll()) {
                    if (Boolean.TRUE.equals(a.getActif())) {
                        notificationService.notifier(a, "Alerte de risque eleve",
                                etu.getPrenom() + " " + etu.getNom() + " (" + etu.getMatricule() + ") - "
                                        + sem.getNom() + " : probabilite " + reponse.probabilite());
                    }
                }
            }
        } else {
            alerte = null;
        }
        return new Resultat(PredictionDto.from(saved, alerte != null ? alerte.getId() : null), creee);
    }
}