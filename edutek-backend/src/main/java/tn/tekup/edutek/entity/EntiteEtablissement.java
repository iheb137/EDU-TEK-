package tn.tekup.edutek.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import org.hibernate.annotations.TenantId;

/**
 * Classe de base de toutes les donnees d'un etablissement. Hibernate renseigne et filtre
 * automatiquement la colonne tenant_id (code de l'etablissement courant).
 */
@MappedSuperclass
@Getter
public abstract class EntiteEtablissement {

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private String etablissement;
}