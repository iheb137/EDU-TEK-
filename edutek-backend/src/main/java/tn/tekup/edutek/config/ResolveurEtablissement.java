package tn.tekup.edutek.config;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import tn.tekup.edutek.util.EtablissementContexte;

/** Indique a Hibernate l'etablissement courant. Declare dans application.properties. */
public class ResolveurEtablissement implements CurrentTenantIdentifierResolver<String> {

    @Override
    public String resolveCurrentTenantIdentifier() {
        String code = EtablissementContexte.courant();
        return code != null ? code : EtablissementContexte.AUCUN;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }
}