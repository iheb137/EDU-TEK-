package tn.tekup.edutek.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tn.tekup.edutek.entity.Pointage;
import tn.tekup.edutek.entity.Seance;
import tn.tekup.edutek.repository.PointageRepository;
import tn.tekup.edutek.repository.SeanceRepository;
import tn.tekup.edutek.util.PaiementCalcul;

import java.time.LocalDate;

/**
 * Faire l'appel vaut pointage : la seance est pointee (EN_ATTENTE, duree prevue) quand son enseignant
 * enregistre l'appel. Transaction separee : si plusieurs presences arrivent en meme temps, un conflit
 * sur le pointage n'annule jamais la presence elle-meme.
 */
@Service
@RequiredArgsConstructor
public class PointageAutoService {

    private final PointageRepository pointageRepository;
    private final SeanceRepository seanceRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void pointerSiNecessaire(Long seanceId) {
        Seance s = seanceRepository.findById(seanceId).orElse(null);
        if (s == null || s.getDate().isAfter(LocalDate.now()) || pointageRepository.findBySeanceId(seanceId).isPresent()) {
            return;
        }
        int minutes = PaiementCalcul.minutes(s.getHeureDebut(), s.getHeureFin());
        if (minutes < 1 || minutes > 720) {
            return;
        }
        Pointage p = new Pointage();
        p.setSeance(s);
        p.setMinutesDeclarees(minutes);
        p.setCommentaire("Pointage automatique : appel effectue le " + LocalDate.now());
        pointageRepository.saveAndFlush(p);
    }
}
