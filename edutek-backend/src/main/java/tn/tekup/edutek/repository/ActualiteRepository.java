package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Actualite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActualiteRepository extends JpaRepository<Actualite, Long> {
    Page<Actualite> findByTitreContainingIgnoreCase(String titre, Pageable pageable);
}