package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.JournalAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JournalAuditRepository extends JpaRepository<JournalAudit, Long> {

    @Query("select j from JournalAudit j where lower(j.acteurEmail) like lower(concat('%', :acteur, '%')) "
         + "and j.action like concat(:action, '%')")
    Page<JournalAudit> rechercher(@Param("acteur") String acteur, @Param("action") String action, Pageable pageable);
}