"""Prediction et explication d'une demande."""
from __future__ import annotations

import math
from typing import List, Mapping, Optional, Sequence, Tuple

import numpy as np
import torch

from .features import FEATURES, N_FEAT, encode_sequence, ligne_vide
from .registry import Modele

NOM_HISTORIQUE = "HISTORIQUE_SEMESTRES"


class Predictionneur:
    def __init__(self, modele: Modele):
        self.modele = modele

    def _logits(self, lots: np.ndarray) -> np.ndarray:
        with torch.no_grad():
            return self.modele.reseau(torch.from_numpy(lots)).numpy().astype(np.float64) / self.modele.temperature

    def predire(self, indicateurs: Optional[Mapping], historique: Sequence[Mapping] = ()) -> Tuple[float, List[dict]]:
        """Retourne (probabilite d'echec, facteurs explicatifs).

        Explication par OCCLUSION : pour chaque indicateur present au semestre courant, on le remplace par la
        valeur moyenne de la population d'entrainement et on mesure la baisse du log-odds du risque. Une
        contribution positive signifie que la valeur observee AUGMENTE le risque par rapport a un etudiant moyen.
        Le facteur HISTORIQUE_SEMESTRES mesure de meme l'effet des semestres precedents.
        """
        base = encode_sequence(indicateurs, historique)
        variantes = [base]
        etiquettes: List[Tuple[str, Optional[float]]] = []
        reference = self.modele.reference
        for i, nom in enumerate(FEATURES):
            if base[-1, N_FEAT + i] > 0.5:
                continue  # indicateur absent : aucun facteur invente
            v = base.copy()
            v[-1, i] = reference[i]
            variantes.append(v)
            etiquettes.append((nom, float((indicateurs or {})[nom])))
        if len(historique) > 0:
            v = base.copy()
            v[:-1] = ligne_vide()
            # Sans semestre precedent, la tendance n'existe pas non plus : on evite une entree impossible.
            v[-1, FEATURES.index("TENDANCE_MOYENNE")] = 0.0
            v[-1, N_FEAT + FEATURES.index("TENDANCE_MOYENNE")] = 1.0
            variantes.append(v)
            etiquettes.append((NOM_HISTORIQUE, float(min(len(historique), self.modele.meta.get("max_history", 4)))))

        logits = self._logits(np.stack(variantes))
        probabilite = 1.0 / (1.0 + math.exp(-logits[0]))
        facteurs = [
            {"nom": nom, "valeur": round(valeur, 4), "contribution": round(float(logits[0] - logits[k + 1]), 4)}
            for k, (nom, valeur) in enumerate(etiquettes)
        ]
        facteurs = [f for f in facteurs if abs(f["contribution"]) > 1e-9]
        facteurs.sort(key=lambda f: abs(f["contribution"]), reverse=True)
        return round(probabilite, 4), facteurs
