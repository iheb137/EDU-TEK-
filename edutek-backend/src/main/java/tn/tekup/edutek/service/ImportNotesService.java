package tn.tekup.edutek.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.dto.ErreurImportDto;
import tn.tekup.edutek.dto.ImportNotesResultDto;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.EvaluationRepository;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.util.CsvParser;

import java.util.*;

/** Import CSV des notes d'une evaluation (colonnes : matricule, valeur, commentaire optionnel). */
@Service
@RequiredArgsConstructor
public class ImportNotesService {

    public static final int MAX_LIGNES = 300;
    private static final List<String> OBLIGATOIRES = List.of("matricule", "valeur");
    private static final List<String> OPTIONNELLES = List.of("commentaire");

    private final EvaluationRepository evaluationRepository;
    private final EtudiantRepository etudiantRepository;
    private final NoteRepository noteRepository;
    private final NoteSaisieService saisie;
    private final NoteWorkflowService workflow;
    private final RegleCalculService reglesService;
    private final AuditService audit;

    private record Ligne(int numero, Etudiant etudiant, double valeur, String commentaire) {}

    @Transactional
    public ImportNotesResultDto importer(Long evaluationId, byte[] contenu, boolean simulation,
                                         boolean ignorerErreurs, Authentication auth) {
        Evaluation ev = evaluationRepository.findById(evaluationId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluation introuvable : " + evaluationId));
        boolean admin = saisie.verifierDroits(ev, auth);
        double noteMax = reglesService.pour(ev.getEnseignement().getClasse().getFormation()).getNoteMax();

        List<List<String>> lignes;
        try {
            lignes = CsvParser.analyser(CsvParser.decoder(contenu));
        } catch (CsvParser.CsvException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        if (lignes.size() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Fichier vide : une ligne d'en-tete et au moins une ligne de donnees sont attendues");
        }
        if (lignes.size() - 1 > MAX_LIGNES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trop de lignes : " + (lignes.size() - 1) + " (maximum " + MAX_LIGNES + ")");
        }

        List<String> entete = lignes.get(0);
        Map<String, Integer> colonnes = new HashMap<>();
        for (int i = 0; i < entete.size(); i++) {
            String nom = entete.get(i).trim().toLowerCase(Locale.ROOT);
            if (nom.isEmpty()) {
                continue;
            }
            if (!OBLIGATOIRES.contains(nom) && !OPTIONNELLES.contains(nom)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Colonne inconnue : " + entete.get(i).trim());
            }
            if (colonnes.put(nom, i) != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Colonne en double : " + nom);
            }
        }
        for (String obligatoire : OBLIGATOIRES) {
            if (!colonnes.containsKey(obligatoire)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Colonne obligatoire absente : " + obligatoire);
            }
        }

        List<ErreurImportDto> erreurs = new ArrayList<>();
        List<Ligne> valides = new ArrayList<>();
        Set<String> vus = new HashSet<>();
        Long classeEvaluation = ev.getEnseignement().getClasse().getId();

        for (int i = 1; i < lignes.size(); i++) {
            List<String> brut = lignes.get(i);
            List<String> problemes = new ArrayList<>();
            String matricule = valeur(brut, colonnes, "matricule");
            String valeurBrute = valeur(brut, colonnes, "valeur");
            String commentaire = valeur(brut, colonnes, "commentaire");

            if (brut.size() > entete.size()) {
                problemes.add("Trop de colonnes (" + brut.size() + " au lieu de " + entete.size()
                        + ") : un champ contient-il un separateur sans guillemets ?");
            }
            Etudiant etu = null;
            if (matricule.isEmpty()) {
                problemes.add("Matricule obligatoire");
            } else if (!vus.add(matricule)) {
                problemes.add("Matricule duplique dans le fichier : " + matricule);
            } else {
                etu = etudiantRepository.findByMatricule(matricule).orElse(null);
                if (etu == null) {
                    problemes.add("Etudiant introuvable : " + matricule);
                } else if (etu.getClasse() == null || !etu.getClasse().getId().equals(classeEvaluation)) {
                    problemes.add("L'etudiant " + matricule + " n'appartient pas a la classe de cette evaluation");
                } else if (noteRepository.existsByEvaluationIdAndEtudiantId(ev.getId(), etu.getId())) {
                    problemes.add("Une note existe deja pour " + matricule);
                }
            }
            double v = 0;
            if (valeurBrute.isEmpty()) {
                problemes.add("Valeur obligatoire");
            } else {
                try {
                    v = Double.parseDouble(valeurBrute.replace(',', '.'));
                    if (!Double.isFinite(v) || v < 0 || v > noteMax) {
                        problemes.add("Valeur hors bareme (0 a " + noteMax + ") : " + valeurBrute);
                    }
                } catch (NumberFormatException e) {
                    problemes.add("Valeur invalide : " + valeurBrute);
                }
            }
            if (commentaire.length() > 255) {
                problemes.add("Commentaire trop long (255 maximum)");
            }

            if (problemes.isEmpty()) {
                valides.add(new Ligne(i, etu, v, commentaire.isEmpty() ? null : commentaire));
            } else {
                for (String p : problemes) {
                    erreurs.add(new ErreurImportDto(i, p));
                }
            }
        }

        String statut = admin ? "SOUMISE" : "BROUILLON";
        int creees = 0;
        if (!simulation && (erreurs.isEmpty() || ignorerErreurs)) {
            for (Ligne l : valides) {
                saisie.creer(ev, l.etudiant(), l.valeur(), l.commentaire(), admin, auth.getName());
                creees++;
            }
            if (admin && creees > 0) {
                workflow.invaliderResultats(ev.getEnseignement().getSemestre().getId());
            }
            audit.log("IMPORT_NOTES", "Evaluation", ev.getId(), creees + " note(s) " + statut
                    + (erreurs.isEmpty() ? "" : ", " + erreurs.size() + " erreur(s) ignoree(s)"));
        }
        return new ImportNotesResultDto(simulation, lignes.size() - 1, valides.size(), creees, statut, erreurs);
    }

    private static String valeur(List<String> ligne, Map<String, Integer> colonnes, String nom) {
        Integer index = colonnes.get(nom);
        if (index == null || index >= ligne.size()) {
            return "";
        }
        String v = ligne.get(index);
        return v == null ? "" : v.trim();
    }
}