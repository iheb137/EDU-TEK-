package tn.tekup.edutek.ia;

import tn.tekup.edutek.ia.ContratIa.DemandePrediction;
import tn.tekup.edutek.ia.ContratIa.FacteurIa;
import tn.tekup.edutek.ia.ContratIa.ModeleInfo;
import tn.tekup.edutek.ia.ContratIa.ReponsePrediction;
import tn.tekup.edutek.util.ModeleRegles;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;

/** FAUX service d'IA : modele a regles ecrit a la main, pas un modele entraine. */
@Service
@ConditionalOnProperty(name = "app.ia.mode", havingValue = "stub", matchIfMissing = true)
public class ServiceIaStub implements ServiceIa {

    @Override
    public ReponsePrediction predire(DemandePrediction demande) {
        ModeleRegles.Resultat r = ModeleRegles.evaluer(demande.indicateurs());
        List<FacteurIa> facteurs = r.facteurs().stream()
                .map(f -> new FacteurIa(f.nom(), f.valeur(), f.contribution()))
                .toList();
        return new ReponsePrediction(modeleActif(), r.probabilite(), facteurs);
    }

    @Override
    public ModeleInfo modeleActif() {
        return new ModeleInfo(ModeleRegles.NOM, ModeleRegles.VERSION, ModeleRegles.TYPE);
    }
}