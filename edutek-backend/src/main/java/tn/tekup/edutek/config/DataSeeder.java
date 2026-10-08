package tn.tekup.edutek.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import tn.tekup.edutek.service.EtablissementService;
import tn.tekup.edutek.util.EtablissementContexte;

/** Au demarrage : etablissement par defaut (roles + administrateur) et, si configure, la plateforme. */
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final EtablissementService etablissementService;

    @Value("${app.etablissement.defaut:tekup}")
    private String codeDefaut;

    @Value("${app.etablissement.defaut-nom:TEK-UP University}")
    private String nomDefaut;

    @Value("${app.seed.admin.email:}")
    private String adminEmail;

    @Value("${app.seed.admin.password:}")
    private String adminPassword;

    @Value("${app.seed.plateforme.email:}")
    private String plateformeEmail;

    @Value("${app.seed.plateforme.password:}")
    private String plateformePassword;

    @Override
    public void run(String... args) {
        etablissementService.assurer(codeDefaut, nomDefaut, adminEmail, adminPassword, false);
        if (!plateformeEmail.isBlank() && !plateformePassword.isBlank()) {
            etablissementService.assurer(EtablissementContexte.PLATEFORME, "Administration de la plateforme",
                    plateformeEmail, plateformePassword, false);
        }
    }
}