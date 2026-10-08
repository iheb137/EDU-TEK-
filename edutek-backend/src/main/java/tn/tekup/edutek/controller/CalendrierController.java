package tn.tekup.edutek.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.*;
import tn.tekup.edutek.repository.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Calendrier personnel : evenements scolaires + emploi du temps + examens, selon le role de l'appelant. */
@RestController
@RequestMapping("/api/calendrier")
@RequiredArgsConstructor
public class CalendrierController {

    public record CalendrierItem(String categorie, String titre, LocalDate date, LocalDate dateFin,
                                 LocalTime heureDebut, LocalTime heureFin, String salle, String classe,
                                 String enseignant, Long refId) {}

    private final EvenementAcademiqueRepository evenementRepository;
    private final SeanceRepository seanceRepository;
    private final EvaluationRepository evaluationRepository;
    private final EtudiantRepository etudiantRepository;

    @GetMapping("/moi")
    @Transactional(readOnly = true)
    public List<CalendrierItem> moi(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate du,
                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate au,
                                    Authentication auth) {
        LocalDate debut = du != null ? du : LocalDate.now();
        LocalDate fin = au != null ? au : debut.plusDays(30);
        if (fin.isBefore(debut)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin precede la date de debut");
        }
        if (debut.plusDays(366).isBefore(fin)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Periode limitee a un an");
        }
        boolean etudiant = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ETUDIANT"));
        boolean enseignant = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ENSEIGNANT"));

        List<EvenementAcademique> evenements = evenementRepository
                .findByDateDebutLessThanEqualAndDateFinGreaterThanEqualOrderByDateDebut(fin, debut);
        List<Seance> seances;
        List<Evaluation> examens;

        if (etudiant) {
            Etudiant etu = etudiantRepository.findByEmail(auth.getName()).orElse(null);
            Classe classe = etu != null ? etu.getClasse() : null;
            Long formationId = classe != null ? classe.getFormation().getId() : null;
            evenements = evenements.stream().filter(e -> e.getFormation() == null
                    || (formationId != null && e.getFormation().getId().equals(formationId))).toList();
            if (classe != null) {
                seances = seanceRepository.findByEnseignementClasseIdAndDateBetween(classe.getId(), debut, fin);
                examens = evaluationRepository.findByEnseignementClasseIdAndDateBetween(classe.getId(), debut, fin);
            } else {
                seances = List.of();
                examens = List.of();
            }
        } else if (enseignant) {
            seances = seanceRepository.findByEnseignementEnseignantEmailAndDateBetween(auth.getName(), debut, fin);
            examens = evaluationRepository.findByEnseignementEnseignantEmailAndDateBetween(auth.getName(), debut, fin);
        } else {
            seances = seanceRepository.findByDateBetween(debut, fin);
            examens = evaluationRepository.findByDateBetween(debut, fin);
        }

        List<CalendrierItem> items = new ArrayList<>();
        for (EvenementAcademique e : evenements) {
            items.add(new CalendrierItem("EVENEMENT", e.getTitre() + " (" + e.getType() + ")", e.getDateDebut(),
                    e.getDateFin(), null, null, null, null, null, e.getId()));
        }
        for (Seance s : seances) {
            Enseignement ens = s.getEnseignement();
            items.add(new CalendrierItem("SEANCE", "Cours : " + ens.getMatiere().getNom(), s.getDate(), s.getDate(),
                    s.getHeureDebut(), s.getHeureFin(), s.getSalle(), ens.getClasse().getCode(), nom(ens), s.getId()));
        }
        for (Evaluation ev : examens) {
            Enseignement ens = ev.getEnseignement();
            LocalTime finExamen = ev.getHeureDebut() != null && ev.getDureeMinutes() != null
                    ? ev.getHeureDebut().plusMinutes(ev.getDureeMinutes()) : null;
            String type = ev.getType() != null ? ev.getType() : "Evaluation";
            items.add(new CalendrierItem("EXAMEN", type + " : " + ens.getMatiere().getNom(), ev.getDate(), ev.getDate(),
                    ev.getHeureDebut(), finExamen, ev.getSalle(), ens.getClasse().getCode(), nom(ens), ev.getId()));
        }
        items.sort(Comparator.comparing(CalendrierItem::date)
                .thenComparing(CalendrierItem::heureDebut, Comparator.nullsLast(Comparator.naturalOrder())));
        return items;
    }

    private static String nom(Enseignement ens) {
        return ens.getEnseignant().getPrenom() + " " + ens.getEnseignant().getNom();
    }
}