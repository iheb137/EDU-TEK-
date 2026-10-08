package tn.tekup.edutek.service;

import jakarta.persistence.EntityManagerFactory;
import lombok.RequiredArgsConstructor;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.Transaction;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import tn.tekup.edutek.entity.Etablissement;
import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.entity.SuperAdmin;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.EtablissementRepository;
import tn.tekup.edutek.security.RolesSysteme;

import java.util.HashMap;
import java.util.Map;

/** Creation d'un etablissement et de son contenu initial (roles systeme, premier SuperAdmin). */
@Service
@RequiredArgsConstructor
public class EtablissementService {

    private final EtablissementRepository etablissementRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManagerFactory entityManagerFactory;

    /** Idempotent : cree l'etablissement s'il manque, puis ses roles et son SuperAdmin s'ils manquent. */
    public Etablissement assurer(String code, String nom, String adminEmail, String adminMotDePasse,
                                 boolean motDePasseTemporaire) {
        Etablissement etablissement = etablissementRepository.findByCode(code).orElseGet(() -> {
            Etablissement nouveau = new Etablissement();
            nouveau.setCode(code);
            nouveau.setNom(nom);
            return etablissementRepository.save(nouveau);
        });
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        // Session ouverte explicitement pour l'etablissement cible, independante de la requete en cours.
        try (Session session = sessionFactory.withOptions().tenantIdentifier(code).openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                remplir(session, code, adminEmail, adminMotDePasse, motDePasseTemporaire);
                tx.commit();
            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
        return etablissement;
    }

    private void remplir(Session session, String code, String adminEmail, String adminMotDePasse,
                         boolean motDePasseTemporaire) {
        Map<String, Role> roles = new HashMap<>();
        for (String nomRole : RolesSysteme.NOMS) {
            Role role = session.createQuery("from Role r where r.nom = :n", Role.class)
                    .setParameter("n", nomRole).uniqueResultOptional().orElseGet(() -> {
                        Role nouveau = new Role();
                        nouveau.setNom(nomRole);
                        session.persist(nouveau);
                        return nouveau;
                    });
            roles.put(nomRole, role);
        }
        if (adminEmail == null || adminEmail.isBlank() || adminMotDePasse == null || adminMotDePasse.isBlank()) {
            System.out.println(">>> [" + code + "] aucun administrateur initial configure");
            return;
        }
        String email = adminEmail.trim();
        Utilisateur admin = session.createQuery("from Utilisateur u where u.email = :e", Utilisateur.class)
                .setParameter("e", email).uniqueResultOptional().orElseGet(() -> {
                    SuperAdmin sa = new SuperAdmin();
                    sa.setNom("Admin");
                    sa.setPrenom("Super");
                    sa.setEmail(email);
                    sa.setMotDePasse(passwordEncoder.encode(adminMotDePasse));
                    sa.setMdpTemporaire(motDePasseTemporaire);
                    session.persist(sa);
                    System.out.println(">>> [" + code + "] administrateur initial cree : " + email);
                    return sa;
                });
        if (admin.getRoles().isEmpty()) {
            admin.getRoles().add(roles.get("SUPERADMIN"));
            System.out.println(">>> [" + code + "] role SUPERADMIN attribue a " + email);
        }
    }
}