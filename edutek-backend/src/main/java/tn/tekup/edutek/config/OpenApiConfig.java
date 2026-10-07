package tn.tekup.edutek.config;

import tn.tekup.edutek.util.Libelles;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI edutekOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Edu-Tek API")
                        .version("1.0")
                        .description("API REST de la plateforme Edu-Tek (TEK-UP University). "
                                + "Authentification : POST /api/auth/login puis bouton Authorize avec le jeton JWT. "
                                + "Les erreurs sont renvoyees au format {\"erreur\": \"message\"}. "
                                + "Les droits d'acces de chaque operation sont indiques dans sa description."))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }

    /** Tag, resume et droits d'acces generes pour chaque operation, sans annoter les controleurs. */
    @Bean
    public OperationCustomizer documentationDesOperations() {
        return (operation, handlerMethod) -> {
            operation.setTags(List.of(Libelles.tag(handlerMethod.getBeanType().getSimpleName())));
            if (operation.getSummary() == null || operation.getSummary().isBlank()) {
                operation.setSummary(Libelles.humaniser(handlerMethod.getMethod().getName()));
            }
            PreAuthorize droits = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getMethod(), PreAuthorize.class);
            if (droits == null) {
                droits = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getBeanType(), PreAuthorize.class);
            }
            String acces = droits != null ? "Acces : " + droits.value() : "Acces : tout utilisateur authentifie";
            String existant = operation.getDescription();
            operation.setDescription(existant == null || existant.isBlank() ? acces : existant + "\n\n" + acces);
            return operation;
        };
    }
}