package tn.tekup.edutek.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.List;

/**
 * Compte de service de n8n : en-tete X-API-Key, uniquement sous /api/n8n/, role ROLE_N8N.
 * Les cles (app.n8n.api-keys, separees par des virgules) de moins de 32 caracteres sont ignorees.
 */
@Component
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    public static final String ENTETE = "X-API-Key";

    private final List<byte[]> cles;

    public ApiKeyAuthFilter(@Value("${app.n8n.api-keys:}") String cles) {
        this.cles = Arrays.stream(cles.split(","))
                .map(String::trim)
                .filter(c -> c.length() >= 32)
                .map(c -> c.getBytes(StandardCharsets.UTF_8))
                .toList();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/n8n/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String fournie = request.getHeader(ENTETE);
        if (fournie != null) {
            if (cleValide(fournie)) {
                Authentication auth = new UsernamePasswordAuthenticationToken(
                        "n8n", null, List.of(new SimpleGrantedAuthority("ROLE_N8N")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } else {
                response.setStatus(401);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"erreur\":\"Cle d'API invalide\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    /** Compare a toutes les cles configurees, en temps constant : la duree ne depend pas de la correspondance. */
    private boolean cleValide(String fournie) {
        byte[] octets = fournie.getBytes(StandardCharsets.UTF_8);
        boolean valide = false;
        for (byte[] cle : cles) {
            valide |= MessageDigest.isEqual(cle, octets);
        }
        return valide;
    }
}