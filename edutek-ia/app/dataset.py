"""Construction des echantillons d'entrainement a partir des trajectoires d'etudiants."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

import numpy as np

from .config import MAX_HISTORY
from .features import encode_sequence

# Une trajectoire = liste chronologique de (indicateurs du semestre, echec 0/1).
Periode = Tuple[Dict[str, float], int]


@dataclass
class Dataset:
    X: np.ndarray            # (N, SEQ_LEN, INPUT_DIM)
    y: np.ndarray            # (N,) 1 = semestre non valide
    groupes: np.ndarray      # (N,) identifiant de l'etudiant, pour separer train / validation / test
    source: str              # "SYNTHETIQUE" ou "REELLE"
    description: Dict = field(default_factory=dict)

    def __len__(self) -> int:
        return len(self.y)


def depuis_trajectoires(etudiants: Dict[str, List[Periode]], source: str, description: Dict | None = None) -> Dataset:
    """Un echantillon par semestre : indicateurs du semestre + au plus MAX_HISTORY semestres precedents."""
    X, y, g = [], [], []
    for ident, periodes in etudiants.items():
        for i, (indic, echec) in enumerate(periodes):
            historique = [p[0] for p in periodes[max(0, i - MAX_HISTORY):i]]
            X.append(encode_sequence(indic, historique))
            y.append(float(echec))
            g.append(ident)
    if not X:
        raise ValueError("Aucun echantillon : jeu de donnees vide")
    return Dataset(np.stack(X), np.asarray(y, dtype=np.float32), np.asarray(g), source, description or {})


def separer(ds: Dataset, seed: int, part_val: float = 0.15, part_test: float = 0.15):
    """Separation PAR ETUDIANT : un meme etudiant n'apparait jamais dans deux ensembles (pas de fuite)."""
    ids = np.unique(ds.groupes)
    rng = np.random.default_rng(seed)
    rng.shuffle(ids)
    n_test = max(1, int(len(ids) * part_test))
    n_val = max(1, int(len(ids) * part_val))
    test_ids = set(ids[:n_test])
    val_ids = set(ids[n_test:n_test + n_val])
    est_test = np.array([g in test_ids for g in ds.groupes])
    est_val = np.array([g in val_ids for g in ds.groupes])
    est_train = ~(est_test | est_val)
    return est_train, est_val, est_test
