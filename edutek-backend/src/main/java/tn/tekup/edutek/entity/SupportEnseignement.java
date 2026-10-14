package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Support de cours rattache a un enseignement (matiere + classe) : fichier televerse sur le serveur
 * ou lien externe. Independant des classes virtuelles.
 */
@Entity
@Table(name = "supports_enseignement")
@Getter
@Setter
@NoArgsConstructor
public class SupportEnseignement extends EntiteEtablissement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enseignement_id", nullable = false)
    private Enseignement enseignement;

    @Column(nullable = false, length = 200)
    private String titre;

    /** Regroupement libre (ex. « Chapitre 1 »). */
    @Column(length = 120)
    private String chapitre;

    /** FICHIER ou LIEN. */
    @Column(nullable = false, length = 10)
    private String nature;

    /** Adresse externe (nature LIEN). */
    @Column(length = 500)
    private String url;

    /** Nom d'origine du fichier televerse (nature FICHIER). */
    @Column(name = "nom_fichier", length = 255)
    private String nomFichier;

    /** Chemin relatif dans le dossier de stockage (nature FICHIER). */
    @Column(name = "chemin_stockage", length = 300)
    private String cheminStockage;

    @Column(name = "type_mime", length = 120)
    private String typeMime;

    @Column(name = "taille_octets")
    private Long tailleOctets;

    /** Masque = visible du seul enseignant et de l'administration pedagogique. */
    @Column(nullable = false)
    private Boolean visible = Boolean.TRUE;

    /** Les etudiants n'ont ete prevenus qu'une fois, a la premiere mise en ligne. */
    @Column(nullable = false)
    private Boolean notifie = Boolean.FALSE;

    @Column(name = "date_depot", nullable = false)
    private LocalDateTime dateDepot = LocalDateTime.now();

    @Column(name = "depose_par", length = 200)
    private String deposePar;
}
