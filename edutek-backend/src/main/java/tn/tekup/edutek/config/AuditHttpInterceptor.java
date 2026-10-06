package tn.tekup.edutek.config;

import tn.tekup.edutek.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class AuditHttpInterceptor implements HandlerInterceptor {

    private static final Set<String> ECRITURES = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final AuditService audit;

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (!ECRITURES.contains(request.getMethod())) {
            return;
        }
        int statut = response.getStatus();
        String action;
        if (statut >= 200 && statut < 400) {
            action = "ECRITURE";
        } else if (statut == 403) {
            action = "ACCES_REFUSE";
        } else {
            return;
        }
        try {
            String chemin = request.getRequestURI();
            String reste = chemin.startsWith("/api/") ? chemin.substring(5) : chemin;
            String[] segments = reste.split("/");
            String entite = segments.length > 0 && !segments[0].isEmpty() ? segments[0] : null;
            Long entiteId = (segments.length > 1 && segments[1].matches("\\d{1,18}")) ? Long.valueOf(segments[1]) : null;
            audit.log(action, entite, entiteId, request.getMethod() + " " + chemin + " -> " + statut);
        } catch (RuntimeException e) {
            // L'audit ne doit jamais faire echouer la requete.
        }
    }
}