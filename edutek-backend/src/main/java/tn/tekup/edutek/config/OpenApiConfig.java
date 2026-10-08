package tn.tekup.edutek.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import tn.tekup.edutek.util.DocumentationApi;
import tn.tekup.edutek.util.Libelles;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

@Configuration
public class OpenApiConfig {

    private static final String DESCRIPTION = """
            API REST de la plateforme **Edu-Tek** (TEK-UP University) : gestion académique multi-établissement \
            (formations, classes, notes, résultats, présences, paiements) avec un volet d'aide à la décision par IA.

            ## S'authentifier
            1. `POST /api/auth/login` avec `email` et `motDePasse` : la réponse contient un jeton JWT.
            2. Cliquer sur **Authorize** et coller le jeton (sans le mot « Bearer »).
            3. Si la réponse est 403 avec `MOT_DE_PASSE_A_CHANGER`, appeler `POST /api/auth/changer-mot-de-passe` puis se reconnecter.

            ## Établissements (multi-tenant)
            Chaque établissement a ses propres données. Le jeton porte l'établissement ; à la connexion, l'en-tête \
            `X-Etablissement` le choisit (par défaut `tekup`). Un établissement inconnu ou inactif est refusé (401). \
            Les e-mails sont uniques sur toute la plateforme, les matricules et les codes par établissement.

            ## Circuit des notes et des résultats
            1. L'enseignant saisit des **brouillons** de notes, puis **soumet** l'évaluation (plus aucune modification possible).
            2. Il **clôture** la saisie de son enseignement ; l'administrateur pédagogique peut le rouvrir.
            3. L'administrateur pédagogique **calcule** les résultats (moyennes, décisions, rangs) puis les **publie**.
            4. Les étudiants ne voient leurs résultats qu'après publication. Toute correction d'une note soumise exige un motif et est journalisée.

            ## Erreurs
            Toutes les erreurs ont le format `{"erreur": "message"}` avec les codes 400 (requête invalide), \
            401 (non authentifié), 403 (droits insuffisants), 404 (introuvable) et 409 (conflit). \
            Chaque opération indique les droits requis dans sa description (**Accès**).
            """;

    @Bean
    public OpenAPI edutekOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Edu-Tek API")
                        .version("1.0")
                        .description(DESCRIPTION)
                        .contact(new Contact().name("Équipe Edu-Tek - TEK-UP University")))
                .addServersItem(new Server().url("http://localhost:8080").description("Développement local"))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")
                                .description("Jeton obtenu par POST /api/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }

    /** Composants communs (format d'erreur, en-tête d'établissement) et description des tags. */
    @Bean
    public OpenApiCustomizer composantsEtTags() {
        return openApi -> {
            Components c = openApi.getComponents();
            if (c == null) {
                c = new Components();
                openApi.setComponents(c);
            }
            Schema<?> erreur = new ObjectSchema()
                    .description("Format d'erreur commun à toute l'API")
                    .addProperty("erreur", new StringSchema().description("Message explicite").example("Email deja utilise"));
            c.addSchemas("Erreur", erreur);
            c.addParameters("XEtablissement", new Parameter()
                    .in("header").name("X-Etablissement").required(false)
                    .description("Code de l'établissement (par défaut : tekup). Ignoré une fois connecté : le jeton porte l'établissement.")
                    .schema(new StringSchema())
                    .example("tekup"));

            Set<String> utilises = new TreeSet<>();
            if (openApi.getPaths() != null) {
                openApi.getPaths().values().forEach(item -> item.readOperations().forEach(op -> {
                    if (op.getTags() != null) {
                        utilises.addAll(op.getTags());
                    }
                }));
            }
            List<Tag> tags = new ArrayList<>();
            for (String t : utilises) {
                tags.add(new Tag().name(t).description(DocumentationApi.descriptionTag(t)));
            }
            openApi.setTags(tags);
        };
    }

    /** Tag, resume, droits d'acces et reponses d'erreur standard de chaque operation, sans annoter les controleurs. */
    @Bean
    public OperationCustomizer documentationDesOperations() {
        return (operation, handlerMethod) -> {
            Method m = handlerMethod.getMethod();
            String controleur = handlerMethod.getBeanType().getSimpleName().replaceAll("Controller$", "");
            String tag = Libelles.tag(controleur);
            boolean publique = controleur.equals("Auth");
            operation.setTags(List.of(tag));

            String[] doc = DocumentationApi.operation(controleur, m.getName());
            if (doc != null) {
                operation.setSummary(doc[0]);
            } else if (operation.getSummary() == null || operation.getSummary().isBlank()) {
                operation.setSummary(DocumentationApi.resume(m.getName(), tag));
            }

            PreAuthorize droits = AnnotatedElementUtils.findMergedAnnotation(m, PreAuthorize.class);
            if (droits == null) {
                droits = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getBeanType(), PreAuthorize.class);
            }
            String acces = publique ? "**Accès** : public"
                    : droits != null ? "**Accès** : `" + droits.value() + "`"
                    : "**Accès** : tout utilisateur authentifié";
            String base = doc != null ? doc[1] : operation.getDescription();
            operation.setDescription(base == null || base.isBlank() ? acces : base + "\n\n" + acces);

            ApiResponses reponses = operation.getResponses();
            if (reponses == null) {
                reponses = new ApiResponses();
                operation.setResponses(reponses);
            }
            String verbe = verbe(m);
            boolean ecriture = !verbe.equals("GET");
            boolean avecId = Arrays.stream(m.getParameters()).anyMatch(p -> p.isAnnotationPresent(PathVariable.class));
            if (verbe.equals("POST") || verbe.equals("PUT") || verbe.equals("PATCH")) {
                ajouter(reponses, "400", "Requête invalide : champ manquant, format incorrect ou règle métier non respectée");
            }
            ajouter(reponses, "401", publique
                    ? "Identifiants invalides, établissement inconnu ou inactif"
                    : "Jeton absent, expiré ou invalide, ou établissement inconnu ou inactif");
            if (!publique || m.getName().equals("login")) {
                ajouter(reponses, "403", publique
                        ? "Mot de passe temporaire à changer (code MOT_DE_PASSE_A_CHANGER)"
                        : "Droits insuffisants pour cette opération");
            }
            if (avecId) {
                ajouter(reponses, "404", "Ressource introuvable");
            }
            if (ecriture) {
                ajouter(reponses, "409", "Conflit : valeur déjà existante, élément encore référencé ou état incompatible");
            }
            if (publique) {
                operation.addParametersItem(new Parameter().$ref("#/components/parameters/XEtablissement"));
            }
            return operation;
        };
    }

    private static String verbe(Method m) {
        RequestMapping rm = AnnotatedElementUtils.findMergedAnnotation(m, RequestMapping.class);
        RequestMethod[] ms = rm != null ? rm.method() : new RequestMethod[0];
        return ms.length > 0 ? ms[0].name() : "GET";
    }

    private static void ajouter(ApiResponses reponses, String code, String description) {
        if (!reponses.containsKey(code)) {
            reponses.addApiResponse(code, new ApiResponse().description(description)
                    .content(new Content().addMediaType("application/json",
                            new MediaType().schema(new Schema<Object>().$ref("#/components/schemas/Erreur")))));
        }
    }
}