"""Registre des modeles : un dossier par nom et par version, et un pointeur vers le modele actif.

models/
  active.json                      {"nom": "...", "version": "..."}
  <nom>/<version>/weights.pt       poids du reseau (state_dict)
  <nom>/<version>/meta.json        architecture, echelles, temperature, metriques, provenance des donnees
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch

from . import config
from .features import BORNES, FEATURES
from .model import RisqueGRU


@dataclass
class Modele:
    nom: str
    version: str
    meta: Dict
    reseau: RisqueGRU
    temperature: float
    reference: np.ndarray

    @property
    def type(self) -> str:
        return self.meta.get("type", "DEEP_LEARNING")

    @property
    def donnees(self) -> str:
        return self.meta.get("donnees", "INCONNUES")

    def info(self) -> Dict[str, str]:
        return {"nom": self.nom, "version": self.version, "type": self.type, "donnees": self.donnees}


def _racine() -> Path:
    return Path(config.MODELS_DIR)


def nouvelle_version(nom: str) -> str:
    prefixe = datetime.now(timezone.utc).strftime("%Y.%m")
    dossier = _racine() / nom
    numeros = [int(d.name.rsplit(".", 1)[1]) for d in dossier.glob(prefixe + ".*") if d.is_dir()] if dossier.exists() else []
    return f"{prefixe}.{max(numeros, default=0) + 1}"


def enregistrer(nom: str, version: str, reseau: RisqueGRU, meta: Dict) -> Path:
    dossier = _racine() / nom / version
    if dossier.exists():
        raise FileExistsError(f"Le modele {nom} {version} existe deja")
    dossier.mkdir(parents=True)
    torch.save(reseau.state_dict(), dossier / "weights.pt")
    (dossier / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    return dossier


def _lire_meta(nom: str, version: str) -> Dict:
    chemin = _racine() / nom / version / "meta.json"
    if not chemin.is_file():
        raise FileNotFoundError(f"Modele introuvable : {nom} {version}")
    return json.loads(chemin.read_text(encoding="utf-8"))


def charger(nom: str, version: str) -> Modele:
    meta = _lire_meta(nom, version)
    if meta.get("features") != FEATURES or {k: list(v) for k, v in meta.get("bornes", {}).items()} != \
            {k: list(v) for k, v in BORNES.items()}:
        raise ValueError(f"Modele {nom} {version} incompatible avec les indicateurs de cette version du service")
    reseau = RisqueGRU(**meta["architecture"])
    reseau.load_state_dict(torch.load(_racine() / nom / version / "weights.pt", map_location="cpu", weights_only=True))
    reseau.eval()
    return Modele(nom, version, meta, reseau, float(meta["temperature"]), np.asarray(meta["reference"], dtype=np.float32))


def actif() -> Optional[Tuple[str, str]]:
    chemin = _racine() / "active.json"
    if not chemin.is_file():
        return None
    d = json.loads(chemin.read_text(encoding="utf-8"))
    return d["nom"], d["version"]


def activer(nom: str, version: str) -> Modele:
    modele = charger(nom, version)  # refuse un modele absent ou incompatible avant de changer le pointeur
    (_racine()).mkdir(parents=True, exist_ok=True)
    (_racine() / "active.json").write_text(json.dumps({"nom": nom, "version": version}), encoding="utf-8")
    return modele


def lister() -> List[Dict]:
    racine = _racine()
    courant = actif()
    sortie = []
    if racine.exists():
        for meta_path in sorted(racine.glob("*/*/meta.json")):
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            nom, version = meta_path.parent.parent.name, meta_path.parent.name
            test = meta.get("metriques", {}).get("test", {}).get("gru", {})
            sortie.append({
                "nom": nom, "version": version, "type": meta.get("type"), "donnees": meta.get("donnees"),
                "cree_le": meta.get("cree_le"), "roc_auc_test": test.get("roc_auc"),
                "actif": courant == (nom, version),
            })
    return sortie
