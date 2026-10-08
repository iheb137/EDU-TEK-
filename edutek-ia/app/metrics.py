"""Metriques d'evaluation et modeles de reference (baselines)."""
from __future__ import annotations

import math
from typing import Dict, Mapping

import numpy as np
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

from .features import FEATURES, N_FEAT


def ece(y: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    """Erreur de calibration attendue : ecart moyen entre probabilite annoncee et frequence observee."""
    total = 0.0
    bornes = np.linspace(0.0, 1.0, bins + 1)
    for lo, hi in zip(bornes[:-1], bornes[1:]):
        masque = (p >= lo) & ((p < hi) if hi < 1.0 else (p <= hi))
        if masque.any():
            total += masque.mean() * abs(y[masque].mean() - p[masque].mean())
    return float(total)


def evaluer(y: np.ndarray, p: np.ndarray) -> Dict[str, float]:
    sortie = {
        "roc_auc": float(roc_auc_score(y, p)),
        "pr_auc": float(average_precision_score(y, p)),
        "brier": float(brier_score_loss(y, p)),
        "ece": ece(y, p),
        "taux_echec": float(y.mean()),
        "n": int(len(y)),
    }
    for seuil in (0.3, 0.5, 0.7):
        pred = p >= seuil
        tp = float(((pred == 1) & (y == 1)).sum())
        sortie[f"precision@{seuil}"] = tp / pred.sum() if pred.sum() else 0.0
        sortie[f"rappel@{seuil}"] = tp / (y == 1).sum() if (y == 1).sum() else 0.0
    return {k: round(v, 4) for k, v in sortie.items()}


def probabilite_regles(X: np.ndarray) -> np.ndarray:
    """Port exact du faux service du backend (ModeleRegles.java) : sert de reference a battre.

    Entree : tenseurs de sequences ; seule la derniere ligne (semestre courant) est utilisee.
    Valeurs par defaut quand un indicateur est absent : identiques a la version Java.
    """
    bornes = {
        "MOYENNE_SEMESTRE": (0.0, 20.0), "TAUX_ABSENCE": (0.0, 1.0), "TAUX_ABSENCE_NON_JUSTIFIEE": (0.0, 1.0),
        "NB_MATIERES_NON_VALIDEES": (0.0, 50.0), "TENDANCE_MOYENNE": (-20.0, 20.0),
    }
    from .features import BORNES

    def brut(row: np.ndarray, nom: str, defaut: float) -> float:
        i = FEATURES.index(nom)
        if row[N_FEAT + i] > 0.5:
            return defaut
        lo, hi = BORNES[nom]
        v = lo + row[i] * (hi - lo)
        b_lo, b_hi = bornes[nom]
        return min(b_hi, max(b_lo, v))

    sortie = np.zeros(len(X), dtype=np.float64)
    for k, seq in enumerate(X):
        r = seq[-1]
        moyenne = brut(r, "MOYENNE_SEMESTRE", 10.0)
        z = (-0.5 + 3.0 * brut(r, "TAUX_ABSENCE", 0.0) + 2.0 * brut(r, "TAUX_ABSENCE_NON_JUSTIFIEE", 0.0)
             + 0.4 * brut(r, "NB_MATIERES_NON_VALIDEES", 0.0) - 0.25 * (moyenne - 10.0)
             - 0.15 * brut(r, "TENDANCE_MOYENNE", 0.0))
        sortie[k] = 1.0 / (1.0 + math.exp(-z))
    return sortie
