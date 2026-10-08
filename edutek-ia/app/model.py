"""Reseau recurrent (GRU) du risque d'echec du semestre."""
from __future__ import annotations

import torch
from torch import nn

from .features import INPUT_DIM

ARCHITECTURE = {"proj": 32, "hidden": 48, "dropout": 0.2}


class RisqueGRU(nn.Module):
    """Sequence de semestres (B, T, D) -> logit du risque de ne pas valider le dernier semestre.

    - une projection par semestre, puis un GRU qui lit la trajectoire de l'etudiant ;
    - l'etat final est concatene aux indicateurs du semestre courant (connexion directe) ;
    - la tete produit un logit ; la probabilite est sigmoid(logit / temperature).
    """

    def __init__(self, input_dim: int = INPUT_DIM, proj: int = 32, hidden: int = 48, dropout: float = 0.2):
        super().__init__()
        self.proj = nn.Sequential(nn.Linear(input_dim, proj), nn.ReLU())
        self.gru = nn.GRU(proj, hidden, batch_first=True)
        self.norm = nn.LayerNorm(hidden)
        self.tete = nn.Sequential(
            nn.Linear(hidden + input_dim, 32), nn.ReLU(), nn.Dropout(dropout), nn.Linear(32, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        sortie, _ = self.gru(self.proj(x))
        h = self.norm(sortie[:, -1, :])
        return self.tete(torch.cat([h, x[:, -1, :]], dim=1)).squeeze(1)
