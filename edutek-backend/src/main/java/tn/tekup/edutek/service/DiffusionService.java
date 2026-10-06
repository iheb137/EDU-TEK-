package tn.tekup.edutek.service;

import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.ClasseRepository;
import tn.tekup.edutek.repository.EnseignantRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DiffusionService {

    public static final int MAX_DESTINATAIRES = 5000;

    private final UtilisateurRepository utilisateurRepository;
    private final EtudiantRepository etudiantRepository;
    private final EnseignantRepository enseignantRepository;
    private final ClasseRepository classeRepository;
    private final NotificationService notificationService;
    private final AuditService audit;

    /** audience : ETUDIANTS, ENSEIGNANTS, TOUS ou CLASSE (avec classeId). Retourne le nombre de destinataires. */
    @Transactional
    public int diffuser(String audience, Long classeId, String titre, String contenu) {
        List<? extends Utilisateur> cibles;
        String detail = audience;
        switch (audience) {
            case "ETUDIANTS" -> cibles = etudiantRepository.findAll();
            case "ENSEIGNANTS" -> cibles = enseignantRepository.findAll();
            case "TOUS" -> cibles = utilisateurRepository.findAll();
            case "CLASSE" -> {
                if (classeId == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "classeId obligatoire pour l'audience CLASSE");
                }
                if (!classeRepository.existsById(classeId)) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Classe introuvable : " + classeId);
                }
                cibles = etudiantRepository.findByClasseId(classeId);
                detail = audience + " " + classeId;
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Audience invalide. Valeurs : ETUDIANTS, ENSEIGNANTS, TOUS, CLASSE");
        }

        List<Utilisateur> actifs = new ArrayList<>();
        for (Utilisateur u : cibles) {
            if (Boolean.TRUE.equals(u.getActif())) {
                actifs.add(u);
            }
        }
        if (actifs.size() > MAX_DESTINATAIRES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Audience trop large (" + actifs.size() + " destinataires, maximum " + MAX_DESTINATAIRES + ") : segmentez l'envoi");
        }
        for (Utilisateur u : actifs) {
            notificationService.notifier(u, titre, contenu);
        }
        audit.log("DIFFUSION", "Notification", null, detail + " : " + actifs.size() + " destinataire(s) - " + titre);
        return actifs.size();
    }
}