"""Entrainement, calibration, evaluation et enregistrement d'un modele.

Utilisation :
    python -m app.train --source synthetic --etudiants 5000 --graine 42
    python -m app.train --source csv --fichier data/export.csv
"""
from __future__ import annotations

import argparse
import copy
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Callable, Dict, Optional

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from torch import nn

from . import VERSION_SERVICE, config, registry
from .data_csv import charger
from .dataset import Dataset, separer
from .features import BORNES, FEATURES, N_FEAT
from .metrics import evaluer, probabilite_regles
from .model import ARCHITECTURE, RisqueGRU
from .synthetic import generer

TYPE_MODELE = "DEEP_LEARNING"


@dataclass
class Config:
    source: str = "synthetic"          # "synthetic" ou "csv"
    etudiants: int = 5000              # taille du jeu synthetique
    fichier: Optional[str] = None      # CSV pour source = "csv"
    graine: int = 42
    epoques: int = 60
    batch: int = 256
    lr: float = 2e-3
    weight_decay: float = 1e-4
    patience: int = 8
    masquage: float = 0.08             # augmentation : proba de masquer un indicateur present (robustesse aux donnees partielles)


def _masquer(xb: torch.Tensor, p: float, gen: torch.Generator) -> torch.Tensor:
    """Masque au hasard des indicateurs presents, comme le ferait une donnee manquante reelle."""
    if p <= 0:
        return xb
    v, m, present = xb[:, :, :N_FEAT], xb[:, :, N_FEAT:2 * N_FEAT], xb[:, :, -1:]
    retire = (torch.rand(v.shape, generator=gen) < p).float() * present * (1.0 - m)
    return torch.cat([v * (1.0 - retire), torch.clamp(m + retire, max=1.0), present], dim=2)


def _logits(reseau: RisqueGRU, X: np.ndarray) -> np.ndarray:
    reseau.eval()
    with torch.no_grad():
        return reseau(torch.from_numpy(X)).numpy().astype(np.float64)


def _sigmoide(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-z))


def _temperature(logits: np.ndarray, y: np.ndarray) -> float:
    """Calibration par mise a l'echelle de temperature, ajustee sur la validation uniquement."""
    z = torch.tensor(logits, dtype=torch.float64)
    cible = torch.tensor(y, dtype=torch.float64)
    log_t = torch.zeros(1, dtype=torch.float64, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)
    perte = nn.BCEWithLogitsLoss()

    def fermeture():
        opt.zero_grad()
        v = perte(z / torch.exp(log_t), cible)
        v.backward()
        return v

    opt.step(fermeture)
    return float(np.clip(torch.exp(log_t).item(), 0.5, 5.0))


def _charger(cfg: Config) -> Dataset:
    if cfg.source == "synthetic":
        return generer(cfg.etudiants, cfg.graine)
    if cfg.source == "csv":
        if not cfg.fichier:
            raise ValueError("source csv : precisez le fichier")
        return charger(cfg.fichier)
    raise ValueError(f"Source inconnue : {cfg.source}")


def entrainer(cfg: Config, journal: Callable[[str], None] = print) -> Dict:
    torch.manual_seed(cfg.graine)
    np.random.seed(cfg.graine)

    ds = _charger(cfg)
    est_train, est_val, est_test = separer(ds, cfg.graine)
    Xtr, ytr = ds.X[est_train], ds.y[est_train]
    Xva, yva = ds.X[est_val], ds.y[est_val]
    Xte, yte = ds.X[est_test], ds.y[est_test]
    for nom, y in (("entrainement", ytr), ("validation", yva), ("test", yte)):
        if len(np.unique(y)) < 2:
            raise ValueError(f"L'ensemble de {nom} ne contient qu'une seule classe : donnees insuffisantes")
    journal(f"Donnees {ds.source} : {len(ds)} echantillons, taux d'echec {ds.y.mean():.3f} "
            f"(train {len(ytr)}, validation {len(yva)}, test {len(yte)})")

    reseau = RisqueGRU(**ARCHITECTURE)
    opt = torch.optim.Adam(reseau.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    planif = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, factor=0.5, patience=3)
    perte = nn.BCEWithLogitsLoss()
    Xtr_t, ytr_t = torch.from_numpy(Xtr), torch.from_numpy(ytr)
    Xva_t, yva_t = torch.from_numpy(Xva), torch.from_numpy(yva)

    meilleure_perte, meilleur_etat, meilleure_epoque, sans_progres = float("inf"), None, 0, 0
    generateur = torch.Generator().manual_seed(cfg.graine)
    for epoque in range(1, cfg.epoques + 1):
        reseau.train()
        ordre = torch.randperm(len(Xtr_t), generator=generateur)
        for debut in range(0, len(ordre), cfg.batch):
            idx = ordre[debut:debut + cfg.batch]
            opt.zero_grad()
            perte(reseau(_masquer(Xtr_t[idx], cfg.masquage, generateur)), ytr_t[idx]).backward()
            nn.utils.clip_grad_norm_(reseau.parameters(), 1.0)
            opt.step()
        reseau.eval()
        with torch.no_grad():
            p_val = perte(reseau(Xva_t), yva_t).item()
        planif.step(p_val)
        if p_val < meilleure_perte - 1e-5:
            meilleure_perte, meilleur_etat, meilleure_epoque, sans_progres = p_val, copy.deepcopy(reseau.state_dict()), epoque, 0
        else:
            sans_progres += 1
        if epoque == 1 or epoque % 5 == 0:
            journal(f"  epoque {epoque:3d}  perte validation {p_val:.4f}")
        if sans_progres >= cfg.patience:
            journal(f"  arret anticipe a l'epoque {epoque} (meilleure : {meilleure_epoque})")
            break
    reseau.load_state_dict(meilleur_etat)

    temperature = _temperature(_logits(reseau, Xva), yva)
    p_gru_val = _sigmoide(_logits(reseau, Xva) / temperature)
    p_gru_test = _sigmoide(_logits(reseau, Xte) / temperature)

    # Reference de l'explication : valeur moyenne (echelle [0,1]) de chaque indicateur au semestre courant.
    courant = Xtr[:, -1, :]
    reference = []
    for i in range(N_FEAT):
        presents = courant[:, N_FEAT + i] < 0.5
        reference.append(float(courant[presents, i].mean()) if presents.any() else 0.0)

    # Modeles de comparaison, evalues sur le MEME ensemble de test.
    regression = LogisticRegression(max_iter=1000).fit(Xtr[:, -1, :2 * N_FEAT], ytr)
    metriques = {
        "test": {
            "gru": evaluer(yte, p_gru_test),
            "regles_backend": evaluer(yte, probabilite_regles(Xte)),
            "regression_logistique": evaluer(yte, regression.predict_proba(Xte[:, -1, :2 * N_FEAT])[:, 1]),
        },
        "validation": {"gru": evaluer(yva, p_gru_val)},
    }
    t = metriques["test"]
    journal(f"Test : GRU AUC {t['gru']['roc_auc']} / Brier {t['gru']['brier']} / ECE {t['gru']['ece']}  |  "
            f"regression logistique AUC {t['regression_logistique']['roc_auc']}  |  regles actuelles AUC {t['regles_backend']['roc_auc']}")

    synthetique = ds.source == "SYNTHETIQUE"
    nom = "gru-risque-synth" if synthetique else "gru-risque"
    version = registry.nouvelle_version(nom)
    meta = {
        "nom": nom, "version": version, "type": TYPE_MODELE, "donnees": ds.source,
        "cree_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "architecture": ARCHITECTURE, "features": FEATURES,
        "bornes": {k: list(v) for k, v in BORNES.items()},
        "max_history": config.MAX_HISTORY, "temperature": round(temperature, 6), "reference": reference,
        "entrainement": {**asdict(cfg), "meilleure_epoque": meilleure_epoque,
                         "n_train": int(len(ytr)), "n_val": int(len(yva)), "n_test": int(len(yte))},
        "donnees_description": ds.description, "metriques": metriques,
        "torch": torch.__version__, "service": VERSION_SERVICE,
    }
    registry.enregistrer(nom, version, reseau, meta)
    journal(f"Modele enregistre : {nom} {version}")
    return meta


def main() -> None:
    p = argparse.ArgumentParser(description="Entraine un modele de risque d'echec")
    p.add_argument("--source", choices=["synthetic", "csv"], default="synthetic")
    p.add_argument("--etudiants", type=int, default=5000)
    p.add_argument("--fichier")
    p.add_argument("--graine", type=int, default=42)
    p.add_argument("--epoques", type=int, default=60)
    p.add_argument("--activer", action="store_true", help="active le modele une fois entraine")
    a = p.parse_args()
    meta = entrainer(Config(source=a.source, etudiants=a.etudiants, fichier=a.fichier, graine=a.graine, epoques=a.epoques))
    if a.activer:
        registry.activer(meta["nom"], meta["version"])
        print(f"Modele actif : {meta['nom']} {meta['version']}")
    print(json.dumps(meta["metriques"]["test"], indent=2))


if __name__ == "__main__":
    main()
