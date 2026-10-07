package tn.tekup.edutek.ia;

import tn.tekup.edutek.ia.ContratIa.DemandePrediction;
import tn.tekup.edutek.ia.ContratIa.ModeleInfo;
import tn.tekup.edutek.ia.ContratIa.ReponsePrediction;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public interface ServiceIa {

    ReponsePrediction predire(DemandePrediction demande);

    ModeleInfo modeleActif();

    /** Demande au service d'utiliser ce modele ; sans effet par defaut (faux service). */
    default void activer(String nom, String version) {
    }

    /** Declenche un reentrainement et retourne le nouveau modele ; non disponible par defaut. */
    default ModeleInfo reentrainer() {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED,
                "Reentrainement non disponible avec ce service (aucun modele entraine)");
    }
}