package tn.tekup.edutek.util;

import java.util.Locale;
import java.util.Map;

/** Textes de la documentation OpenAPI (Swagger) : description des tags et des operations principales. */
public final class DocumentationApi {

    private static final Map<String, String> TAGS = Map.ofEntries(
            Map.entry("Authentification", "Connexion, jeton JWT et changement de mot de passe. Seules opérations publiques de l'API."),
            Map.entry("Formations", "Programmes d'études d'un établissement. Le code d'une formation est unique par établissement."),
            Map.entry("Semestres", "Semestres d'une formation et leurs dates."),
            Map.entry("Classes", "Groupes d'étudiants rattachés à une formation et à une année universitaire."),
            Map.entry("Matières", "Matières enseignées, avec leurs coefficients."),
            Map.entry("Étudiants", "Comptes étudiants. Le matricule est unique par établissement, l'e-mail est unique sur toute la plateforme."),
            Map.entry("Enseignants", "Comptes enseignants. Le matricule est unique par établissement."),
            Map.entry("Administrateurs", "Comptes d'administration de l'établissement."),
            Map.entry("Enseignements", "Affectation d'un enseignant à une matière et à une classe pour un semestre."),
            Map.entry("Inscriptions", "Inscriptions des étudiants aux classes."),
            Map.entry("Évaluations", "Examens et contrôles : date, heure, durée, salle et mode anonyme."),
            Map.entry("Notes", "Notes des étudiants. L'enseignant saisit des brouillons ; une note soumise ne se corrige que par l'administrateur pédagogique, avec un motif, et la correction est journalisée."),
            Map.entry("Séances", "Séances de cours planifiées."),
            Map.entry("Présences", "Présences et absences des étudiants aux séances."),
            Map.entry("Résultats de semestre", "Moyennes, décisions et bulletins. L'étudiant ne voit ses résultats qu'après publication par l'administrateur pédagogique."),
            Map.entry("Indicateurs académiques", "Indicateurs de suivi calculés à partir des notes et des présences."),
            Map.entry("Messagerie", "Messages entre utilisateurs de l'établissement."),
            Map.entry("Notifications", "Notifications reçues par l'utilisateur connecté."),
            Map.entry("Annuaire", "Recherche de personnes dans l'établissement."),
            Map.entry("Demandes de documents", "Demandes de documents administratifs par les étudiants et leur traitement."),
            Map.entry("Stages", "Suivi des stages des étudiants."),
            Map.entry("Rôles", "Rôles de l'établissement. Les rôles système sont fixes et pilotent l'accès aux routes."),
            Map.entry("Permissions", "Permissions enregistrées pour l'établissement. L'accès aux routes repose sur les rôles système."),
            Map.entry("Comptes utilisateurs", "Administration des comptes : activation, désactivation, réinitialisation du mot de passe."),
            Map.entry("Journal d'audit", "Traçabilité des actions sensibles de l'établissement (consultation et purge, réservées au SuperAdmin)."),
            Map.entry("Import de comptes", "Création de comptes en masse à partir d'un fichier CSV."),
            Map.entry("Classes virtuelles", "Classes en ligne et leurs supports."),
            Map.entry("Actualités", "Actualités publiées par l'établissement."),
            Map.entry("Diffusions", "Messages diffusés à des groupes d'utilisateurs."),
            Map.entry("Pointages", "Pointages du personnel."),
            Map.entry("Tarifs", "Tarifs de scolarité."),
            Map.entry("Paiements", "Paiements et reçus des étudiants."),
            Map.entry("Justificatifs d'absence", "Justificatifs déposés par les étudiants et leur validation."),
            Map.entry("IA : analyses et prédictions", "Prédictions de réussite et analyses produites par le service d'intelligence artificielle."),
            Map.entry("IA : alertes et accompagnement", "Alertes de risque et suivi des actions d'accompagnement."),
            Map.entry("IA : tableau de bord", "Vue synthétique des prédictions et des alertes."),
            Map.entry("IA : avis sur les prédictions", "Retours des utilisateurs sur la pertinence des prédictions."),
            Map.entry("Recommandations de l'étudiant", "Recommandations personnalisées de l'étudiant connecté."),
            Map.entry("IA : cycle de vie des modèles", "Modèles d'IA : activation, réentraînement et historique."),
            Map.entry("n8n : points d'entrée des workflows", "Points d'entrée appelés par les workflows n8n d'automatisation."),
            Map.entry("Supervision technique", "État de santé et exécutions des services techniques."),
            Map.entry("Règles de calcul", "Règles de calcul des résultats d'une formation : note maximale, seuil d'admission, note éliminatoire, compensation, décimales. Verrouillées dès qu'une note existe dans la formation."),
            Map.entry("Calendrier académique", "Rentrée, vacances, jours fériés, fins de semestre et périodes d'examens, par établissement ou par formation."),
            Map.entry("Plan d'études", "Structure d'une formation : semestres et matières."),
            Map.entry("Notes : saisie, soumission, clôture", "Circuit de saisie : brouillon, soumission d'une évaluation, clôture de la saisie d'un enseignement et suivi d'avancement."),
            Map.entry("Résultats : calcul et publication", "Calcul des moyennes, rangs par classe et par filière, puis publication des résultats aux étudiants."),
            Map.entry("Plateforme : établissements", "Gestion des établissements (multi-établissement). Réservée au SuperAdmin de la plateforme."),
            Map.entry("Notes : import CSV", "Import en masse des notes d'une évaluation, avec mode simulation."),
            Map.entry("Statistiques", "Statistiques d'une évaluation ou d'un semestre : moyenne, médiane, écart-type, taux de réussite, distribution."));

    private static final Map<String, String[]> OPERATIONS = Map.ofEntries(
            op("Auth.login", "Se connecter",
                    "Authentifie l'utilisateur et renvoie un jeton JWT (24 h) qui porte l'établissement. "
                    + "Corps : `{\"email\": \"prenom.nom@tekup.tn\", \"motDePasse\": \"...\"}`. "
                    + "L'en-tête `X-Etablissement` choisit l'établissement (par défaut `tekup`). "
                    + "Si le mot de passe est temporaire, la réponse est 403 avec le code `MOT_DE_PASSE_A_CHANGER` : "
                    + "appeler `/api/auth/changer-mot-de-passe` puis se reconnecter. Les échecs répétés sont temporairement bloqués."),
            op("Auth.changerMotDePasse", "Changer son mot de passe",
                    "Corps : `{\"email\": \"...\", \"ancienMotDePasse\": \"...\", \"nouveauMotDePasse\": \"...\"}`. "
                    + "Lève l'obligation de changement des comptes à mot de passe temporaire."),
            op("RegleCalcul.lire", "Lire les règles de calcul d'une formation",
                    "Renvoie les règles en vigueur (valeurs par défaut si aucune règle n'a été définie) et indique si elles sont verrouillées."),
            op("RegleCalcul.modifier", "Modifier les règles de calcul d'une formation",
                    "Définit note maximale, seuil d'admission, note éliminatoire (optionnelle), compensation et nombre de décimales. "
                    + "Refusé (409) dès qu'une note existe dans la formation."),
            op("EvenementAcademique.lister", "Lister les événements du calendrier",
                    "Filtres optionnels `du` et `au` (format AAAA-MM-JJ). Visible par tous les utilisateurs de l'établissement."),
            op("EvenementAcademique.creer", "Créer un événement du calendrier",
                    "Types : RENTREE, VACANCES, FERIE, FIN_SEMESTRE, PERIODE_EXAMENS, AUTRE. La formation est facultative (sinon événement valable pour tout l'établissement)."),
            op("EvenementAcademique.modifier", "Modifier un événement du calendrier", "Remplace les champs de l'événement."),
            op("EvenementAcademique.supprimer", "Supprimer un événement du calendrier", "Suppression définitive de l'événement, sans effet sur les séances ni sur les évaluations. Réservée à l'administrateur pédagogique ; la suppression d'un événement inexistant renvoie 404."),
            op("Calendrier.moi", "Mon calendrier",
                    "Fusionne pour l'utilisateur connecté les événements académiques, les séances et les évaluations de sa période (`du`, `au`)."),
            op("PlanEtudes.plan", "Consulter le plan d'études d'une formation", "Semestres de la formation et matières de chaque semestre."),
            op("NotesWorkflow.soumettre", "Soumettre les notes d'une évaluation",
                    "Passe les brouillons de l'évaluation à l'état SOUMISE et notifie les étudiants. Après soumission, l'enseignant ne peut plus rien modifier."),
            op("NotesWorkflow.cloturer", "Clôturer la saisie d'un enseignement",
                    "Verrouille la saisie. Condition préalable au calcul des résultats du semestre."),
            op("NotesWorkflow.rouvrir", "Rouvrir un enseignement clôturé",
                    "Réservée à l'administrateur pédagogique ; les résultats déjà calculés passent à recalculer."),
            op("NotesWorkflow.avancement", "Avancement de la saisie d'un enseignement", "Nombre de notes saisies, soumises et manquantes par évaluation."),
            op("PublicationResultats.avancement", "Avancement de la clôture d'un semestre", "Enseignements clôturés ou non, par classe."),
            op("PublicationResultats.calculer", "Calculer les résultats et les rangs d'un semestre",
                    "Refusé (409) tant qu'un enseignement n'est pas clôturé. Calcule moyennes, décisions et rangs (classe et filière)."),
            op("PublicationResultats.publier", "Publier les résultats d'un semestre", "Rend les résultats visibles aux étudiants et les notifie."),
            op("Plateforme.lister", "Lister les établissements", "Réservé au SuperAdmin de la plateforme (établissement `plateforme`)."),
            op("Plateforme.creer", "Créer un établissement",
                    "Crée l'établissement et son administrateur avec un mot de passe temporaire. Corps : `code`, `nom`, `adminEmail`, `adminMotDePasse`."),
            op("Plateforme.changerActif", "Activer ou désactiver un établissement", "Un établissement inactif ne peut plus se connecter (401)."),
            op("ImportNotes.importer", "Importer les notes d'une évaluation (CSV)",
                    "Fichier `fichier` en multipart, colonnes `matricule;valeur;commentaire`, 300 lignes maximum. "
                    + "Paramètres : `simulation=true` pour contrôler sans enregistrer, `ignorerErreurs=true` pour importer les lignes valides."),
            op("Statistiques.evaluation", "Statistiques d'une évaluation",
                    "Moyenne, médiane, écart-type, minimum, maximum, taux de réussite et distribution en 5 tranches. `inclureBrouillons` pour compter les brouillons."),
            op("Statistiques.semestre", "Statistiques d'un semestre", "Disponible après le calcul des résultats (409 avant)."),
            op("AuditPurge.purger", "Purger le journal d'audit",
                    "Supprime les entrées de plus de `avantJours` jours (minimum 30). L'opération est elle-même journalisée (AUDIT_PURGE)."),
            op("Note.creer", "Saisir une note",
                    "Enseignant : crée un brouillon (impossible sur une évaluation anonyme ou un enseignement clôturé). Administrateur pédagogique : note directement soumise."),
            op("Note.modifier", "Modifier une note",
                    "Une note soumise ne se corrige qu'avec le paramètre `motif` (administrateur pédagogique) ; la correction est journalisée et les résultats passent à recalculer."),
            op("Note.supprimer", "Supprimer une note", "Même règle que la modification : le `motif` est obligatoire pour une note soumise."),
            op("Resultat.mesResultats", "Mes résultats publiés", "Uniquement les semestres publiés."),
            op("Resultat.monBulletin", "Mon bulletin",
                    "Avant publication, la moyenne et la décision sont masquées (`EN_ATTENTE_PUBLICATION`)."),
            op("Audit.lister", "Consulter le journal d'audit", "Filtres : `acteur`, `action`, `page`, `size`."));

    private DocumentationApi() {}

    private static Map.Entry<String, String[]> op(String cle, String resume, String description) {
        return Map.entry(cle, new String[] {resume, description});
    }

    /** Resume et description d'une operation, ou null si elle n'est pas documentee explicitement. */
    public static String[] operation(String controleur, String methode) {
        return OPERATIONS.get(controleur + "." + methode);
    }

    public static String descriptionTag(String tag) {
        return TAGS.getOrDefault(tag, "Opérations « " + tag + " ».");
    }

    /** Resume par defaut des operations courantes : "lister" + "Formations" -> "Lister : Formations". */
    public static String resume(String methode, String tag) {
        String verbe = switch (methode) {
            case "lister" -> "Lister";
            case "detail" -> "Consulter le détail";
            case "creer" -> "Créer";
            case "modifier" -> "Modifier";
            case "supprimer" -> "Supprimer";
            default -> Libelles.humaniser(methode);
        };
        return verbe + " : " + tag;
    }

    public static boolean estOperationCourante(String methode) {
        return methode != null && methode.toLowerCase(Locale.ROOT).matches("lister|detail|creer|modifier|supprimer");
    }
}