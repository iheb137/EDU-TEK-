"""Generateur de donnees SYNTHETIQUES.

ATTENTION : ces donnees sont fabriquees, elles ne decrivent pas de vrais etudiants. Elles servent a
developper, tester et demontrer la chaine complete (donnees -> entrainement -> service). Un modele
entraine dessus apprend les regles du generateur ci-dessous, pas la realite de TEK-UP : ses metriques
ne prouvent rien sur la performance reelle. Le modele est donc nomme "...-synth" et signale
`donnees = SYNTHETIQUE`. Il faut le reentrainer sur des donnees reelles anonymisees (voir README).

Modele generatif : chaque etudiant a une aptitude `a` et un engagement qui evolue d'un semestre a
l'autre (processus AR(1) avec derive). La moyenne finale du semestre en depend ; le service observe
seulement un instantane bruite en cours de semestre (moyenne partielle, absences) et doit predire
l'echec final. L'absence elevee et la moyenne faible se renforcent mutuellement (effet non lineaire).
"""
from __future__ import annotations

from typing import Dict, List

import numpy as np

from .dataset import Dataset, Periode, depuis_trajectoires

SEUIL_VALIDATION = 10.0


def _sigmoide(z):
    return 1.0 / (1.0 + np.exp(-z))


def generer_etudiant(rng: np.random.Generator) -> List[Periode]:
    n_semestres = int(rng.integers(2, 8))
    aptitude = rng.normal()
    engagement = 0.5 * aptitude + np.sqrt(0.75) * rng.normal()
    derive = 0.0
    precedente_obs = None
    trajectoire: List[Periode] = []

    for _ in range(n_semestres):
        engagement = 0.8 * engagement + 0.6 * rng.normal()
        derive += rng.normal(0.0, 0.35)
        vraie = 11.3 + 2.2 * aptitude + 1.1 * engagement + derive + rng.normal(0.0, 1.0)

        moyenne_obs = float(np.clip(vraie + rng.normal(0.0, 1.4), 0.0, 20.0))
        taux_abs = float(_sigmoide(-1.9 - 0.85 * engagement - 0.15 * aptitude + rng.normal(0.0, 0.5)))
        seances = int(rng.integers(14, 60))
        absences = int(rng.binomial(seances, taux_abs))
        part_nj = float(np.clip(rng.beta(2.0, 2.5) - 0.12 * engagement, 0.05, 1.0))
        non_justifiees = int(rng.binomial(absences, part_nj))
        lambda_nv = 0.55 * (10.5 - moyenne_obs) if moyenne_obs < 10.5 else 0.12
        non_validees = int(rng.poisson(max(0.05, lambda_nv)))
        credits = float(max(0, 30 - 5 * non_validees))

        indic: Dict[str, float] = {}
        if rng.random() > 0.02:
            indic["MOYENNE_SEMESTRE"] = round(moyenne_obs, 2)
            indic["CREDITS_OBTENUS"] = credits
            indic["NB_MATIERES_NON_VALIDEES"] = float(non_validees)
        if rng.random() > 0.12:  # pas de pointage enregistre ce semestre
            indic["NB_SEANCES_POINTEES"] = float(seances)
            indic["TAUX_ABSENCE"] = round(absences / seances, 4)
            indic["TAUX_ABSENCE_NON_JUSTIFIEE"] = round(non_justifiees / seances, 4)
        if "MOYENNE_SEMESTRE" in indic and precedente_obs is not None:
            indic["TENDANCE_MOYENNE"] = round(indic["MOYENNE_SEMESTRE"] - precedente_obs, 2)
        precedente_obs = indic.get("MOYENNE_SEMESTRE")

        finale = vraie + rng.normal(0.0, 0.8)
        finale -= 3.0 * max(0.0, taux_abs - 0.25)           # decrochage : les absences pesent en fin de semestre
        if taux_abs > 0.30 and moyenne_obs < 11.0:           # effet de renforcement
            finale -= 1.0
        echec = 1 if finale < SEUIL_VALIDATION else 0
        trajectoire.append((indic, echec))
    return trajectoire


def generer(n_etudiants: int = 5000, seed: int = 42) -> Dataset:
    rng = np.random.default_rng(seed)
    etudiants = {f"S{i:06d}": generer_etudiant(rng) for i in range(n_etudiants)}
    ds = depuis_trajectoires(
        etudiants,
        "SYNTHETIQUE",
        {"generateur": "app.synthetic", "n_etudiants": n_etudiants, "seed": seed, "seuil_validation": SEUIL_VALIDATION},
    )
    ds.description["taux_echec"] = round(float(ds.y.mean()), 4)
    ds.description["n_echantillons"] = len(ds)
    return ds
