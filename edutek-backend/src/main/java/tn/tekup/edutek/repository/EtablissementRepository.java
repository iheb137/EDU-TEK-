package tn.tekup.edutek.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tn.tekup.edutek.entity.Etablissement;

import java.util.Optional;

public interface EtablissementRepository extends JpaRepository<Etablissement, Long> {

    Optional<Etablissement> findByCode(String code);

    boolean existsByCode(String code);

    /** Unicite globale de l'e-mail, tous etablissements confondus (requete native, non filtree). */
    @Query(value = "select exists(select 1 from utilisateurs where lower(email) = lower(:email))", nativeQuery = true)
    boolean emailExisteGlobalement(@Param("email") String email);
}