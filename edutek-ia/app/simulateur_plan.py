"""Simulateur de promotions fonde sur le plan d'etudes TEK-UP (parcours GLSI, 10 semestres).

ATTENTION : ces donnees restent SYNTHETIQUES. Le plan d'etudes fournit la structure (modules, coefficients,
ECTS, volumes horaires, enchainement) mais aucun resultat d'etudiant. Les liens "aptitude -> note" et
"absences -> echec" sont ceux decrits ci-dessous, choisis par nous. Un modele entraine ici apprend ces
hypotheses, pas la realite : ses metriques ne mesurent pas sa performance sur de vrais etudiants.
Le simulateur est PARAMETRABLE (`Parametres`) pour etre cale sur des statistiques reelles agregees
(taux de reussite par semestre, moyenne et ecart-type), qui ne sont pas des donnees personnelles.

Modele generatif :
  * facteur general g ; aptitudes par domaine (maths, informatique, langues) correlees a g ;
  * engagement : processus AR(1) avec derive, correle a g ; il commande le taux d'absence ;
  * note finale d'un module = niveau du semestre + difficulte du domaine + aptitude du domaine
    + engagement + effet du prerequis (note du module precedent) + bruit ;
  * moyenne du semestre = moyenne ponderee par les coefficients du plan ; echec si < 10 ;
  * ce que le service observe en cours de semestre est un INSTANTANE bruite (notes provisoires,
    absences), le modele doit predire l'echec final ;
  * abandon possible apres un semestre faible ; observation interrompue a une date aleatoire (promotions en cours).
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional

import numpy as np

from .dataset import Dataset, Periode, depuis_trajectoires
from .plan_etudes import N_SEMESTRES, modules_du_semestre

SEUIL_VALIDATION = 10.0
DUREE_SEANCE_H = 10.5   # une seance pointee = un bloc de 10,5 h du plan (hypothese, voir README)


@dataclass
class Parametres:
    # niveau moyen des notes par semestre (S1..S10) : le cycle preparatoire est plus selectif
    niveau_semestre: List[float] = field(default_factory=lambda: [11.4, 11.5, 11.6, 11.6, 11.8, 11.9, 12.0, 12.1, 12.2, 13.0])
    difficulte_domaine: Dict[str, float] = field(default_factory=lambda: {
        "MATH": -0.7, "INFO": 0.0, "RESEAU": -0.2, "LANGUE": 0.9, "GESTION": 0.7, "PROJET": 1.2})
    poids_aptitude: float = 2.1
    poids_engagement: float = 1.0
    poids_prerequis: float = 0.28
    bruit_module: float = 1.9
    bruit_instantane: float = 1.7       # ecart module par module entre notes provisoires et finales
    bruit_commun: float = 1.6           # ecart commun a tout le semestre (ne s'annule pas en moyennant)
    penalite_absence: float = 3.0       # points perdus par la moyenne finale au-dela de 25 % d'absence
    p_abandon: Dict[str, float] = field(default_factory=lambda: {"faible": 0.22, "echec": 0.07, "reussite": 0.008})
    p_donnee_notes_manquante: float = 0.02
    p_donnee_pointage_manquante: float = 0.12


def _sigmoide(z):
    return 1.0 / (1.0 + np.exp(-z))


def generer_etudiant(rng: np.random.Generator, p: Parametres, echecs_par_semestre: Optional[Dict[int, List[int]]] = None) -> List[Periode]:
    g = rng.normal()
    apt = {"MATH": 0.7 * g + 0.714 * rng.normal(), "INFO": 0.75 * g + 0.66 * rng.normal(), "LANGUE": 0.5 * g + 0.866 * rng.normal()}
    apt["RESEAU"], apt["PROJET"] = apt["INFO"], apt["INFO"]
    apt["GESTION"] = apt["LANGUE"]
    engagement = 0.4 * g + np.sqrt(0.84) * rng.normal()
    derive = 0.0
    choix = {"P1": str(rng.choice(["Developpement hybride Flutter", "Realite virtuelle et animation 3D"])),
             "P2": str(rng.choice(["Developpement iOS", "React"]))}
    notes_finales: Dict[str, float] = {}
    n_obs = int(rng.integers(2, N_SEMESTRES + 1))
    trajectoire: List[Periode] = []
    precedente_obs = None

    for sem in range(1, N_SEMESTRES + 1):
        if len(trajectoire) >= n_obs:
            break
        engagement = 0.8 * engagement + 0.6 * rng.normal()
        derive += rng.normal(0.0, 0.3)
        modules = modules_du_semestre(sem, choix)
        finales, provisoires = [], []
        choc_fin_semestre = rng.normal(0.0, p.bruit_commun)   # examens finaux : ecart commun a tous les modules
        for m in modules:
            mu = p.niveau_semestre[sem - 1] + p.difficulte_domaine[m.domaine] + p.poids_aptitude * apt[m.domaine] \
                + p.poids_engagement * engagement + derive
            if m.prerequis and m.prerequis in notes_finales:
                mu += p.poids_prerequis * (notes_finales[m.prerequis] - 10.0)
            note = float(np.clip(mu + rng.normal(0.0, p.bruit_module), 0.0, 20.0))
            finales.append(note)
            provisoires.append(float(np.clip(note + choc_fin_semestre + rng.normal(0.0, p.bruit_instantane), 0.0, 20.0)))
            notes_finales[m.nom] = note
        coefs = np.array([m.coef for m in modules])
        ects = np.array([m.ects for m in modules])
        prov = np.array(provisoires)

        taux_abs = float(_sigmoide(-1.9 - 0.85 * engagement - 0.15 * apt["INFO"] + rng.normal(0.0, 0.5)))
        seances = int(round(sum(m.vht for m in modules) / DUREE_SEANCE_H))
        absences = int(rng.binomial(seances, taux_abs))
        part_nj = float(np.clip(rng.beta(2.0, 2.5) - 0.12 * engagement, 0.05, 1.0))
        non_justifiees = int(rng.binomial(absences, part_nj))

        moyenne_obs = float(np.average(prov, weights=coefs))
        indic: Dict[str, float] = {}
        if rng.random() > p.p_donnee_notes_manquante:
            indic["MOYENNE_SEMESTRE"] = round(moyenne_obs, 2)
            indic["CREDITS_OBTENUS"] = float(ects[prov >= SEUIL_VALIDATION].sum())
            indic["NB_MATIERES_NON_VALIDEES"] = float((prov < SEUIL_VALIDATION).sum())
        if rng.random() > p.p_donnee_pointage_manquante:
            indic["NB_SEANCES_POINTEES"] = float(seances)
            indic["TAUX_ABSENCE"] = round(absences / seances, 4)
            indic["TAUX_ABSENCE_NON_JUSTIFIEE"] = round(non_justifiees / seances, 4)
        if "MOYENNE_SEMESTRE" in indic and precedente_obs is not None:
            indic["TENDANCE_MOYENNE"] = round(indic["MOYENNE_SEMESTRE"] - precedente_obs, 2)
        precedente_obs = indic.get("MOYENNE_SEMESTRE")

        finale = float(np.average(np.array(finales), weights=coefs))
        finale -= p.penalite_absence * max(0.0, taux_abs - 0.25)
        if taux_abs > 0.30 and moyenne_obs < 11.0:
            finale -= 1.0
        echec = 1 if finale < SEUIL_VALIDATION else 0
        trajectoire.append((indic, echec))
        if echecs_par_semestre is not None:
            echecs_par_semestre.setdefault(sem, []).append(echec)

        niveau = "faible" if finale < 8.0 else ("echec" if echec else "reussite")
        if rng.random() < p.p_abandon[niveau]:
            break
    return trajectoire


def generer(n_etudiants: int = 5000, seed: int = 42, parametres: Optional[Parametres] = None) -> Dataset:
    p = parametres or Parametres()
    rng = np.random.default_rng(seed)
    par_semestre: Dict[int, List[int]] = {}
    etudiants = {f"P{i:06d}": generer_etudiant(rng, p, par_semestre) for i in range(n_etudiants)}
    ds = depuis_trajectoires(etudiants, "SYNTHETIQUE", {
        "generateur": "app.simulateur_plan", "plan": "TEK-UP GLSI 2024-2025 (S1-S10)",
        "n_etudiants": n_etudiants, "seed": seed, "seuil_validation": SEUIL_VALIDATION, "parametres": asdict(p)})
    ds.description["taux_echec"] = round(float(ds.y.mean()), 4)
    ds.description["n_echantillons"] = len(ds)
    ds.description["taux_echec_par_semestre"] = {f"S{s}": round(float(np.mean(v)), 3) for s, v in sorted(par_semestre.items())}
    ds.description["effectif_par_semestre"] = {f"S{s}": len(v) for s, v in sorted(par_semestre.items())}
    return ds
