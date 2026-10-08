"""Indicateurs academiques -> tenseurs.

Chaque semestre est un vecteur de 15 valeurs : 7 indicateurs mis a l'echelle [0, 1],
7 bits "indicateur absent" et 1 bit "semestre present" (0 pour le remplissage).
Un indicateur absent n'est jamais remplace par un zero invente : il est signale par son bit.
"""
from __future__ import annotations

import math
from typing import Mapping, Optional, Sequence

import numpy as np

from .config import MAX_HISTORY

# Ordre FIGE : il fait partie du contrat avec les modeles enregistres.
FEATURES = [
    "MOYENNE_SEMESTRE",
    "CREDITS_OBTENUS",
    "NB_MATIERES_NON_VALIDEES",
    "NB_SEANCES_POINTEES",
    "TAUX_ABSENCE",
    "TAUX_ABSENCE_NON_JUSTIFIEE",
    "TENDANCE_MOYENNE",
]
N_FEAT = len(FEATURES)
SEQ_LEN = MAX_HISTORY + 1
INPUT_DIM = 2 * N_FEAT + 1

# Bornes de mise a l'echelle (valeur hors bornes ramenee a la borne).
BORNES = {
    "MOYENNE_SEMESTRE": (0.0, 20.0),
    "CREDITS_OBTENUS": (0.0, 30.0),
    "NB_MATIERES_NON_VALIDEES": (0.0, 10.0),
    "NB_SEANCES_POINTEES": (0.0, 60.0),
    "TAUX_ABSENCE": (0.0, 1.0),
    "TAUX_ABSENCE_NON_JUSTIFIEE": (0.0, 1.0),
    "TENDANCE_MOYENNE": (-10.0, 10.0),
}


def _valide(v) -> bool:
    return v is not None and isinstance(v, (int, float)) and not isinstance(v, bool) \
        and math.isfinite(v)


def encode_periode(indicateurs: Optional[Mapping[str, Optional[float]]]):
    """Un semestre -> (valeurs[7], absents[7]). Valeur 0 et bit 1 quand l'indicateur est absent."""
    valeurs = np.zeros(N_FEAT, dtype=np.float32)
    absents = np.ones(N_FEAT, dtype=np.float32)
    if indicateurs:
        for i, nom in enumerate(FEATURES):
            v = indicateurs.get(nom)
            if _valide(v):
                lo, hi = BORNES[nom]
                valeurs[i] = min(1.0, max(0.0, (float(v) - lo) / (hi - lo)))
                absents[i] = 0.0
    return valeurs, absents


def ligne(indicateurs) -> np.ndarray:
    v, a = encode_periode(indicateurs)
    return np.concatenate([v, a, np.ones(1, dtype=np.float32)])


def ligne_vide() -> np.ndarray:
    """Remplissage a gauche quand l'historique est plus court que SEQ_LEN."""
    return np.zeros(INPUT_DIM, dtype=np.float32)


def encode_sequence(courant, historique: Sequence = ()) -> np.ndarray:
    """(SEQ_LEN, INPUT_DIM), du plus ancien au plus recent, le semestre courant en derniere ligne."""
    recents = list(historique)[-MAX_HISTORY:]
    lignes = [ligne_vide()] * (SEQ_LEN - 1 - len(recents)) + [ligne(h) for h in recents] + [ligne(courant)]
    return np.stack(lignes).astype(np.float32)
