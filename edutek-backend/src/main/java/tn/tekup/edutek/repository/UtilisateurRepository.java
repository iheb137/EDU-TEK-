package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Utilisateur;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
    Optional<Utilisateur> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query("select u from Utilisateur u where u.actif = true and "
         + "(lower(u.nom) like lower(concat('%', :q, '%')) or lower(u.prenom) like lower(concat('%', :q, '%'))) "
         + "order by u.nom, u.prenom")
    List<Utilisateur> rechercher(@Param("q") String q, Pageable pageable);

    @Query("select u from Utilisateur u where u.actif in (:actifs) and "
         + "(lower(u.nom) like lower(concat('%', :q, '%')) or lower(u.prenom) like lower(concat('%', :q, '%')) "
         + "or lower(u.email) like lower(concat('%', :q, '%')))")
    Page<Utilisateur> rechercherAdmin(@Param("q") String q, @Param("actifs") Collection<Boolean> actifs, Pageable pageable);
}