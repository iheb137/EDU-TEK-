package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String objet;

    @Column(length = 2000)
    private String contenu;

    @Column(name = "date_envoi")
    private LocalDateTime dateEnvoi = LocalDateTime.now();

    private Boolean lu = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expediteur_id", nullable = false)
    private Utilisateur expediteur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destinataire_id", nullable = false)
    private Utilisateur destinataire;
}
