package tn.tekup.edutek.config;

import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.entity.SuperAdmin;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.RoleRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
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

        Utilisateur admin = utilisateurRepository.findByEmail("admin@tekup.tn").orElseGet(() -> {
            SuperAdmin sa = new SuperAdmin();
            sa.setNom("Admin");
            sa.setPrenom("Super");
            sa.setEmail("admin@tekup.tn");
            sa.setMotDePasse(passwordEncoder.encode("admin123"));
            System.out.println(">>> Compte de test cree : admin@tekup.tn / admin123");
            return utilisateurRepository.save(sa);
        });

        if (admin.getRoles().isEmpty()) {
            admin.getRoles().add(roles.get("SUPERADMIN"));
            utilisateurRepository.save(admin);
            System.out.println(">>> Role SUPERADMIN attribue a admin@tekup.tn");
        }
    }
}