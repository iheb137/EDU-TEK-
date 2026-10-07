package tn.tekup.edutek.config;

import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.entity.SuperAdmin;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.RoleRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UtilisateurRepository utilisateurRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.admin.email:}")
    private String adminEmail;

    @Value("${app.seed.admin.password:}")
    private String adminPassword;

    @Override
    @Transactional
    public void run(String... args) {
        String[] noms = {
            "SUPERADMIN", "ADMIN_PEDAGOGIQUE", "ADMIN_COMMUNICATION",
            "ADMIN_SUPPORT", "ADMIN_FINANCIER", "ENSEIGNANT", "ETUDIANT"
        };

        Map<String, Role> roles = new HashMap<>();
        for (String nom : noms) {
            Role role = roleRepository.findByNom(nom).orElseGet(() -> {
                Role nouveau = new Role();
                nouveau.setNom(nom);
                return roleRepository.save(nouveau);
            });
            roles.put(nom, role);
        }

        if (adminEmail.isBlank() || adminPassword.isBlank()) {
            System.out.println(">>> Aucun administrateur initial configure (app.seed.admin.email / app.seed.admin.password)");
            return;
        }

        Utilisateur admin = utilisateurRepository.findByEmail(adminEmail.trim()).orElseGet(() -> {
            SuperAdmin sa = new SuperAdmin();
            sa.setNom("Admin");
            sa.setPrenom("Super");
            sa.setEmail(adminEmail.trim());
            sa.setMotDePasse(passwordEncoder.encode(adminPassword));
            System.out.println(">>> Administrateur initial cree : " + adminEmail.trim());
            return utilisateurRepository.save(sa);
        });

        if (admin.getRoles().isEmpty()) {
            admin.getRoles().add(roles.get("SUPERADMIN"));
            utilisateurRepository.save(admin);
            System.out.println(">>> Role SUPERADMIN attribue a " + admin.getEmail());
        }
    }
}