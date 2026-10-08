package tn.tekup.edutek.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.tekup.edutek.entity.RegleCalcul;

import java.util.Optional;

public interface RegleCalculRepository extends JpaRepository<RegleCalcul, Long> {
    Optional<RegleCalcul> findByFormationId(Long formationId);
}