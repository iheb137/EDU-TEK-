package tn.tekup.edutek.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.time.Instant;
import java.util.Collection;

/** Utilisateur Spring Security portant la date du dernier changement de mot de passe. */
public class UtilisateurPrincipal extends User {

    private final Instant mdpModifieLe;

    public UtilisateurPrincipal(String username, String password, boolean enabled, boolean credentialsNonExpired,
                                Collection<? extends GrantedAuthority> authorities, Instant mdpModifieLe) {
        super(username, password, enabled, true, credentialsNonExpired, true, authorities);
        this.mdpModifieLe = mdpModifieLe;
    }

    public Instant getMdpModifieLe() {
        return mdpModifieLe;
    }
}