package tn.tekup.edutek.service;

import tn.tekup.edutek.dto.CompteImporteDto;
import tn.tekup.edutek.dto.ErreurImportDto;
import tn.tekup.edutek.dto.ImportResultDto;
import tn.tekup.edutek.entity.Classe;
import tn.tekup.edutek.entity.Enseignant;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.ClasseRepository;
import tn.tekup.edutek.repository.EnseignantRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.RoleRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import tn.tekup.edutek.util.CsvParser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ImportComptesService {

    public static final int MAX_LIGNES = 300;

    private static final List<String> OBLIGATOIRES = List.of("type", "nom", "prenom", "email", "matricule");
    private static final List<String> OPTIONNELLES = List.of("telephone", "niveau", "classecode",
            "anneeuniversitaire", "specialite", "grade");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UtilisateurRepository utilisateurRepository;
    private final EtudiantRepository etudiantRepository;
    private final EnseignantRepository enseignantRepository;
    private final ClasseRepository classeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    private record Ligne(int numero, String type, String nom, String prenom, String email, String telephone,
                         String matricule, String niveau, Classe classe, String specialite, String grade) {}

    @Transactional
    public ImportResultDto importer(byte[] contenu, boolean simulation, boolean ignorerErreurs) {
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
        Set<String> emailsVus = new HashSet<>();
        Set<String> matriculesEtudiants = new HashSet<>();
        Set<String> matriculesEnseignants = new HashSet<>();

        for (int i = 1; i < lignes.size(); i++) {
            List<String> brut = lignes.get(i);
            List<String> problemes = new ArrayList<>();

            String typeBrut = valeur(brut, colonnes, "type");
            String type = typeBrut.toUpperCase(Locale.ROOT);
            String nom = valeur(brut, colonnes, "nom");
            String prenom = valeur(brut, colonnes, "prenom");
            String email = valeur(brut, colonnes, "email");
            String telephone = valeur(brut, colonnes, "telephone");
            String matricule = valeur(brut, colonnes, "matricule");
            String niveau = valeur(brut, colonnes, "niveau");
            String classeCode = valeur(brut, colonnes, "classecode");
            String annee = valeur(brut, colonnes, "anneeuniversitaire");
            String specialite = valeur(brut, colonnes, "specialite");
            String grade = valeur(brut, colonnes, "grade");

            if (brut.size() > entete.size()) {
                problemes.add("Trop de colonnes (" + brut.size() + " au lieu de " + entete.size()
                        + ") : un champ contient-il un separateur sans guillemets ?");
            }

            boolean etudiant = type.equals("ETUDIANT");
            boolean enseignant = type.equals("ENSEIGNANT");
            if (!etudiant && !enseignant) {
                problemes.add("Type invalide : '" + typeBrut + "' (ETUDIANT ou ENSEIGNANT attendu)");
            }

            if (nom.isEmpty()) problemes.add("Nom obligatoire");
            if (prenom.isEmpty()) problemes.add("Prenom obligatoire");
            for (String[] champ : new String[][]{{"nom", nom}, {"prenom", prenom}, {"telephone", telephone},
                    {"niveau", niveau}, {"specialite", specialite}, {"grade", grade}}) {
                if (champ[1].length() > 255) problemes.add("Champ trop long (255 maximum) : " + champ[0]);
            }

            if (email.isEmpty()) {
                problemes.add("Email obligatoire");
            } else if (email.length() > 255 || !EMAIL.matcher(email).matches()) {
                problemes.add("Email invalide : " + email);
            } else if (!emailsVus.add(email.toLowerCase(Locale.ROOT))) {
                problemes.add("Email duplique dans le fichier : " + email);
            } else if (utilisateurRepository.existsByEmailIgnoreCase(email)) {
                problemes.add("Email deja utilise : " + email);
            }

            if (matricule.isEmpty()) {
                problemes.add("Matricule obligatoire");
            } else if (matricule.length() > 255) {
                problemes.add("Matricule trop long (255 maximum)");
            } else if (etudiant) {
                if (!matriculesEtudiants.add(matricule)) {
                    problemes.add("Matricule duplique dans le fichier : " + matricule);
                } else if (etudiantRepository.findByMatricule(matricule).isPresent()) {
                    problemes.add("Matricule deja utilise : " + matricule);
                }
            } else if (enseignant) {
                if (!matriculesEnseignants.add(matricule)) {
                    problemes.add("Matricule duplique dans le fichier : " + matricule);
                } else if (enseignantRepository.findByMatricule(matricule).isPresent()) {
                    problemes.add("Matricule deja utilise : " + matricule);
                }
            }

            Classe classe = null;
            if (etudiant) {
                if (!specialite.isEmpty() || !grade.isEmpty()) {
                    problemes.add("specialite et grade ne s'appliquent pas a un etudiant");
                }
                if (!classeCode.isEmpty()) {
                    List<Classe> trouvees = annee.isEmpty()
                            ? classeRepository.findByCode(classeCode)
                            : classeRepository.findByCodeAndAnneeUniversitaire(classeCode, annee);
                    if (trouvees.isEmpty()) {
                        problemes.add("Classe introuvable : " + classeCode + (annee.isEmpty() ? "" : " (" + annee + ")"));
                    } else if (trouvees.size() > 1) {
                        problemes.add("Code de classe ambigu (" + trouvees.size() + " classes) : precisez anneeUniversitaire");
                    } else {
                        classe = trouvees.get(0);
                    }
                } else if (!annee.isEmpty()) {
                    problemes.add("anneeUniversitaire renseignee sans classeCode");
                }
            } else if (enseignant) {
                if (!niveau.isEmpty() || !classeCode.isEmpty() || !annee.isEmpty()) {
                    problemes.add("niveau, classeCode et anneeUniversitaire ne s'appliquent pas a un enseignant");
                }
            }

            if (problemes.isEmpty()) {
                valides.add(new Ligne(i, type, nom, prenom, email, telephone, matricule, niveau, classe, specialite, grade));
            } else {
                for (String p : problemes) {
                    erreurs.add(new ErreurImportDto(i, p));
                }
            }
        }

        boolean creer = !simulation && (erreurs.isEmpty() || ignorerErreurs);
        List<CompteImporteDto> comptes = new ArrayList<>();
        if (creer && !valides.isEmpty()) {
            Role roleEtudiant = roleRepository.findByNom("ETUDIANT").orElseThrow();
            Role roleEnseignant = roleRepository.findByNom("ENSEIGNANT").orElseThrow();
            int nbEtudiants = 0;
            int nbEnseignants = 0;

            for (Ligne l : valides) {
                String temporaire = genererMotDePasse();
                String hash = passwordEncoder.encode(temporaire);
                if (l.type().equals("ETUDIANT")) {
                    Etudiant e = new Etudiant();
                    remplir(e, l, hash);
                    e.setMatricule(l.matricule());
                    e.setNiveau(videEnNull(l.niveau()));
                    e.setClasse(l.classe());
                    e.getRoles().add(roleEtudiant);
                    etudiantRepository.save(e);
                    nbEtudiants++;
                } else {
                    Enseignant e = new Enseignant();
                    remplir(e, l, hash);
                    e.setMatricule(l.matricule());
                    e.setSpecialite(videEnNull(l.specialite()));
                    e.setGrade(videEnNull(l.grade()));
                    e.getRoles().add(roleEnseignant);
                    enseignantRepository.save(e);
                    nbEnseignants++;
                }
                comptes.add(new CompteImporteDto(l.email(), l.type(), temporaire));
            }
            audit.log("IMPORT_COMPTES", "Utilisateur", null, comptes.size() + " comptes crees ("
                    + nbEtudiants + " etudiants, " + nbEnseignants + " enseignants)"
                    + (erreurs.isEmpty() ? "" : ", " + erreurs.size() + " erreur(s) ignoree(s)"));
        }

        return new ImportResultDto(simulation, lignes.size() - 1, valides.size(), comptes.size(), erreurs, comptes);
    }

    private static void remplir(Utilisateur u, Ligne l, String hash) {
        u.setNom(l.nom());
        u.setPrenom(l.prenom());
        u.setEmail(l.email());
        u.setTelephone(videEnNull(l.telephone()));
        u.setMotDePasse(hash);
        u.setMdpTemporaire(true);
        u.setActif(true);
    }

    private static String valeur(List<String> ligne, Map<String, Integer> colonnes, String nom) {
        Integer index = colonnes.get(nom);
        if (index == null || index >= ligne.size()) {
            return "";
        }
        String v = ligne.get(index);
        return v == null ? "" : v.trim();
    }

    private static String videEnNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private static String genererMotDePasse() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 14; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}