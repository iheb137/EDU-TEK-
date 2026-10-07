package tn.tekup.edutek.ia;

import tn.tekup.edutek.ia.ContratIa.DemandePrediction;
import tn.tekup.edutek.ia.ContratIa.ModeleInfo;
import tn.tekup.edutek.ia.ContratIa.ReponsePrediction;

public interface ServiceIa {

    ReponsePrediction predire(DemandePrediction demande);

    ModeleInfo modeleActif();
}