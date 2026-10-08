"""Messages echanges avec le backend (voir docs/contrat-service-ia.md)."""
from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PeriodeIn(BaseModel):
    semestreId: Optional[int] = None
    dateDebut: Optional[str] = Field(None, description="AAAA-MM-JJ")
    indicateurs: Dict[str, Optional[float]] = Field(default_factory=dict)


class DemandePrediction(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "etudiantId": 12, "semestreId": 3,
        "indicateurs": {"MOYENNE_SEMESTRE": 9.5, "CREDITS_OBTENUS": 25.0, "NB_MATIERES_NON_VALIDEES": 1.0,
                        "NB_SEANCES_POINTEES": 24.0, "TAUX_ABSENCE": 0.25, "TAUX_ABSENCE_NON_JUSTIFIEE": 0.125,
                        "TENDANCE_MOYENNE": -1.5},
        "historique": [{"semestreId": 2, "dateDebut": "2025-02-01",
                        "indicateurs": {"MOYENNE_SEMESTRE": 11.0, "TAUX_ABSENCE": 0.1}}]}})

    etudiantId: Optional[int] = None
    semestreId: Optional[int] = None
    indicateurs: Dict[str, Optional[float]] = Field(
        default_factory=dict, description="Indicateurs du semestre analyse ; un indicateur sans donnee est absent")
    historique: List[PeriodeIn] = Field(
        default_factory=list, max_length=24, description="Semestres precedents, du plus ancien au plus recent")


class ModeleInfo(BaseModel):
    nom: str
    version: str
    type: str
    donnees: str = Field(description="SYNTHETIQUE ou REELLE : provenance des donnees d'entrainement")


class Facteur(BaseModel):
    nom: str
    valeur: float
    contribution: float = Field(description="Variation du log-odds du risque ; > 0 augmente le risque")


class ReponsePrediction(BaseModel):
    modele: ModeleInfo
    probabilite: float = Field(ge=0.0, le=1.0, description="Probabilite de ne pas valider le semestre")
    facteurs: List[Facteur]


class DemandeActivation(BaseModel):
    nom: str
    version: str


class DemandeEntrainement(BaseModel):
    source: Literal["synthetic", "csv"] = "synthetic"
    etudiants: int = Field(5000, ge=200, le=100000, description="Taille du jeu synthetique")
    fichier: Optional[str] = Field(None, description="Nom d'un CSV place dans le dossier data/ (source csv)")
    graine: int = 42
    epoques: int = Field(60, ge=1, le=300)
