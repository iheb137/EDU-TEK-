"""Service HTTP du module IA."""
from __future__ import annotations

import hmac
import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import VERSION_SERVICE, config, registry
from .predictor import Predictionneur
from .schemas import (DemandeActivation, DemandeEntrainement, DemandePrediction, ReponsePrediction)
from .train import Config, entrainer

journal = logging.getLogger("edutek.ia")


class Etat:
    predictionneur: Optional[Predictionneur] = None
    verrou_swap = threading.Lock()
    verrou_entrainement = threading.Lock()


def _charger_actif() -> None:
    cible = registry.actif()
    if cible is None:
        Etat.predictionneur = None
        return
    Etat.predictionneur = Predictionneur(registry.charger(*cible))


@asynccontextmanager
async def cycle_de_vie(_: FastAPI):
    try:
        _charger_actif()
        if Etat.predictionneur is None and config.BOOTSTRAP:
            journal.warning("Aucun modele actif : entrainement initial sur donnees SYNTHETIQUES (IA_BOOTSTRAP=1)")
            meta = entrainer(Config(etudiants=3000, epoques=30), journal.info)
            Etat.predictionneur = Predictionneur(registry.activer(meta["nom"], meta["version"]))
    except Exception:  # le service demarre quand meme ; /health signale l'absence de modele
        journal.exception("Chargement du modele actif impossible")
        Etat.predictionneur = None
    yield


app = FastAPI(
    title="Edu-Tek IA", version=VERSION_SERVICE, lifespan=cycle_de_vie,
    description="Service de prediction du risque d'echec academique (PyTorch). "
                "Si IA_API_KEY est definie, l'en-tete X-API-Key est obligatoire (sauf /health).")


def verifier_cle(x_api_key: Optional[str] = Header(default=None)) -> None:
    if config.API_KEY and not (x_api_key and hmac.compare_digest(x_api_key, config.API_KEY)):
        raise HTTPException(status_code=401, detail="Cle d'API absente ou invalide")


def _predictionneur() -> Predictionneur:
    p = Etat.predictionneur
    if p is None:
        raise HTTPException(status_code=503, detail="Aucun modele actif : entrainez puis activez un modele")
    return p


@app.exception_handler(StarletteHTTPException)
async def erreur_http(_: Request, exc: StarletteHTTPException):
    return JSONResponse({"erreur": str(exc.detail)}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def erreur_validation(_: Request, exc: RequestValidationError):
    details = "; ".join(f"{'.'.join(str(x) for x in e['loc'][1:])}: {e['msg']}" for e in exc.errors())
    return JSONResponse({"erreur": f"Requete invalide : {details}"}, status_code=422)


@app.get("/health", summary="Etat du service")
def health():
    p = Etat.predictionneur
    return {"statut": "ok" if p else "sans_modele", "version_service": VERSION_SERVICE,
            "modele": p.modele.info() if p else None}


@app.get("/model", summary="Modele actif", dependencies=[Depends(verifier_cle)])
def modele_actif():
    return _predictionneur().modele.info()


@app.get("/models", summary="Modeles disponibles", dependencies=[Depends(verifier_cle)])
def modeles():
    return registry.lister()


@app.post("/predict", response_model=ReponsePrediction, summary="Risque d'echec d'un etudiant",
          dependencies=[Depends(verifier_cle)])
def predire(demande: DemandePrediction):
    p = _predictionneur()
    historique = sorted(demande.historique, key=lambda h: h.dateDebut or "") \
        if all(h.dateDebut for h in demande.historique) else demande.historique
    probabilite, facteurs = p.predire(demande.indicateurs, [h.indicateurs for h in historique])
    return {"modele": p.modele.info(), "probabilite": probabilite, "facteurs": facteurs}


@app.post("/activate", summary="Activer un modele", dependencies=[Depends(verifier_cle)])
def activer(demande: DemandeActivation):
    try:
        with Etat.verrou_swap:
            modele = registry.activer(demande.nom, demande.version)
            Etat.predictionneur = Predictionneur(modele)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return modele.info()


@app.post("/train", summary="Entrainer un nouveau modele (sans l'activer)", dependencies=[Depends(verifier_cle)])
def entrainer_modele(demande: DemandeEntrainement):
    fichier = None
    if demande.source == "csv":
        if not demande.fichier:
            raise HTTPException(status_code=400, detail="Source csv : indiquez 'fichier' (dans le dossier data/)")
        racine = Path(config.DATA_DIR).resolve()
        fichier = (racine / demande.fichier).resolve()
        if racine not in fichier.parents or not fichier.is_file():
            raise HTTPException(status_code=404, detail="Fichier introuvable dans le dossier data/")
    if not Etat.verrou_entrainement.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Un entrainement est deja en cours")
    try:
        meta = entrainer(Config(source=demande.source, etudiants=demande.etudiants,
                                fichier=str(fichier) if fichier else None, graine=demande.graine,
                                epoques=demande.epoques), journal.info)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        Etat.verrou_entrainement.release()
    return {"modele": {"nom": meta["nom"], "version": meta["version"], "type": meta["type"], "donnees": meta["donnees"]},
            "metriques": meta["metriques"]["test"]}
