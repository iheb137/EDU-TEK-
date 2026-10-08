package tn.tekup.edutek.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tn.tekup.edutek.repository.EtablissementRepository;
import tn.tekup.edutek.security.JwtUtil;
import tn.tekup.edutek.util.EtablissementContexte;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Determine l'etablissement de chaque requete /api/ avant toute lecture en base :
 * 1) jeton JWT (revendication "etab"), 2) en-tete X-Etablissement (connexion, cle n8n),
 * 3) etablissement par defaut. Un etablissement inconnu ou desactive est refuse (401).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class EtablissementFilter extends OncePerRequestFilter {

    public static final String ENTETE = "X-Etablissement";
    private static final long VALIDITE_MS = 30_000;

    private final JwtUtil jwtUtil;
    private final EtablissementRepository etablissementRepository;
    private final String defaut;
    private final Map<String, Long> actifsJusqua = new ConcurrentHashMap<>();

    public EtablissementFilter(JwtUtil jwtUtil, EtablissementRepository etablissementRepository,
                               @Value("${app.etablissement.defaut:tekup}") String defaut) {
        this.jwtUtil = jwtUtil;
        this.etablissementRepository = etablissementRepository;
        this.defaut = defaut;
    }

    /** A appeler apres activation ou desactivation, pour ne pas attendre l'expiration du cache. */
    public void oublier(String code) {
        actifsJusqua.remove(code);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String code = determiner(request);
        if (!estActif(code)) {
            response.setStatus(401);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"erreur\":\"Etablissement inconnu ou desactive\"}");
            return;
        }
        EtablissementContexte.definir(code);
        try {
            chain.doFilter(request, response);
        } finally {
            EtablissementContexte.effacer();
        }
    }

    private String determiner(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                String code = jwtUtil.extractEtablissement(auth.substring(7));
                if (code != null && !code.isBlank()) {
                    return code;
                }
            } catch (RuntimeException e) {
                // jeton invalide : le filtre JWT le refusera
            }
            return defaut;
        }
        String entete = request.getHeader(ENTETE);
        if (entete != null && !entete.isBlank()) {
            return entete.trim();
        }
        return defaut;
    }

    private boolean estActif(String code) {
        long maintenant = System.currentTimeMillis();
        Long jusqua = actifsJusqua.get(code);
        if (jusqua != null && jusqua > maintenant) {
            return true;
        }
        boolean actif = etablissementRepository.findByCode(code)
                .map(e -> Boolean.TRUE.equals(e.getActif())).orElse(false);
        if (actif) {
            actifsJusqua.put(code, maintenant + VALIDITE_MS);
        } else {
            actifsJusqua.remove(code);
        }
        return actif;
    }
}