package tn.tekup.edutek.service;

import tn.tekup.edutek.entity.JournalAudit;
import tn.tekup.edutek.repository.JournalAuditRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final JournalAuditRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String action, String entite, Long entiteId, String details) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String acteur = (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken))
                ? auth.getName() : "anonyme";
        enregistrer(acteur, action, entite, entiteId, details);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logPour(String acteur, String action, String entite, Long entiteId, String details) {
        enregistrer(acteur, action, entite, entiteId, details);
    }

    private void enregistrer(String acteur, String action, String entite, Long entiteId, String details) {
        JournalAudit j = new JournalAudit();
        j.setActeurEmail(coupe(acteur == null || acteur.isBlank() ? "anonyme" : acteur, 255));
        j.setAction(coupe(action, 100));
        j.setEntite(coupe(entite, 100));
        j.setEntiteId(entiteId);
        j.setDetails(coupe(details, 1000));
        j.setAdresseIp(coupe(adresseIp(), 64));
        repository.save(j);
    }

    private static String adresseIp() {
        RequestAttributes ra = RequestContextHolder.getRequestAttributes();
        if (ra instanceof ServletRequestAttributes sra) {
            return sra.getRequest().getRemoteAddr();
        }
        return null;
    }

    private static String coupe(String s, int max) {
        return s != null && s.length() > max ? s.substring(0, max) : s;
    }
}