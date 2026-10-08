"""Configuration du service, lue dans les variables d'environnement."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Dossier des modeles entraines (un sous-dossier par nom et par version).
MODELS_DIR = Path(os.getenv("IA_MODELS_DIR", str(BASE_DIR / "models")))

# Si renseignee, toute requete (sauf /health) doit porter l'en-tete X-API-Key.
API_KEY = os.getenv("IA_API_KEY", "")

# Entraine un modele sur donnees SYNTHETIQUES au demarrage si aucun modele actif (developpement uniquement).
BOOTSTRAP = os.getenv("IA_BOOTSTRAP", "0") == "1"

# Nombre de semestres precedents pris en compte par le modele recurrent.
MAX_HISTORY = 4

# Dossier des exports de donnees reelles anonymisees (JAMAIS versionne dans Git).
DATA_DIR = Path(os.getenv("IA_DATA_DIR", str(BASE_DIR / "data")))
