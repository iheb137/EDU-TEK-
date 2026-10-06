package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "journal_audit")
@Getter
@Setter
@NoArgsConstructor
public class JournalAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime horodatage = LocalDateTime.now();

    @Column(name = "acteur_email", nullable = false)
    private String acteurEmail;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(length = 100)
    private String entite;

    @Column(name = "entite_id")
    private Long entiteId;

    @Column(length = 1000)
    private String details;

    @Column(name = "adresse_ip", length = 64)
    private String adresseIp;
}