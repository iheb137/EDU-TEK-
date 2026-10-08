import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import config, registry
from app.data_csv import charger
from app.dataset import separer
from app.main import Etat, app
from app.synthetic import generer
from app.train import Config, entrainer

EXEMPLE = {
    "etudiantId": 12, "semestreId": 3,
    "indicateurs": {"MOYENNE_SEMESTRE": 7.0, "CREDITS_OBTENUS": 15.0, "NB_MATIERES_NON_VALIDEES": 3.0,
                    "NB_SEANCES_POINTEES": 24.0, "TAUX_ABSENCE": 0.45, "TAUX_ABSENCE_NON_JUSTIFIEE": 0.3,
                    "TENDANCE_MOYENNE": -3.0},
    "historique": [{"semestreId": 2, "dateDebut": "2025-02-01",
                    "indicateurs": {"MOYENNE_SEMESTRE": 10.0, "CREDITS_OBTENUS": 25.0, "NB_MATIERES_NON_VALIDEES": 1.0,
                                    "NB_SEANCES_POINTEES": 30.0, "TAUX_ABSENCE": 0.2,
                                    "TAUX_ABSENCE_NON_JUSTIFIEE": 0.1}}],
}
FAIBLE = {"indicateurs": {"MOYENNE_SEMESTRE": 16.0, "NB_MATIERES_NON_VALIDEES": 0.0, "TAUX_ABSENCE": 0.02,
                          "TAUX_ABSENCE_NON_JUSTIFIEE": 0.0, "TENDANCE_MOYENNE": 1.5}}


@pytest.fixture(scope="module")
def entraine(tmp_path_factory):
    """Un modele entraine une seule fois pour tout le module (dossier dedie)."""
    dossier = tmp_path_factory.mktemp("modeles")
    ancien = config.MODELS_DIR
    config.MODELS_DIR = dossier
    try:
        meta = entrainer(Config(etudiants=800, epoques=6), lambda *_: None)
    finally:
        config.MODELS_DIR = ancien
    return dossier, meta


@pytest.fixture
def modele_rapide(entraine, monkeypatch):
    dossier, meta = entraine
    monkeypatch.setattr(config, "MODELS_DIR", dossier)
    return meta


def test_donnees_synthetiques_reproductibles_et_plausibles():
    a, b = generer(300, seed=7), generer(300, seed=7)
    assert np.array_equal(a.X, b.X) and np.array_equal(a.y, b.y)
    assert 0.2 < a.y.mean() < 0.5


def test_separation_par_etudiant_sans_fuite():
    ds = generer(400, seed=1)
    tr, va, te = separer(ds, 1)
    g = lambda m: set(ds.groupes[m])
    assert not (g(tr) & g(va)) and not (g(tr) & g(te)) and not (g(va) & g(te))
    assert (tr | va | te).all()


def test_artefacts_du_modele(modele_rapide):
    assert modele_rapide["nom"] == "gru-risque-synth" and modele_rapide["donnees"] == "SYNTHETIQUE"
    assert set(modele_rapide["metriques"]["test"]) == {"gru", "regles_backend", "regression_logistique"}
    assert modele_rapide["metriques"]["test"]["gru"]["roc_auc"] > 0.8


def test_contrat_predict(modele_rapide):
    with TestClient(app) as c:
        Etat.predictionneur = None
        c.post("/activate", json={"nom": modele_rapide["nom"], "version": modele_rapide["version"]})
        r = c.post("/predict", json=EXEMPLE)
        assert r.status_code == 200
        corps = r.json()
        assert set(corps) == {"modele", "probabilite", "facteurs"}
        assert 0 <= corps["probabilite"] <= 1
        assert corps["modele"]["type"] == "DEEP_LEARNING" and corps["modele"]["donnees"] == "SYNTHETIQUE"
        contributions = [abs(f["contribution"]) for f in corps["facteurs"]]
        assert contributions == sorted(contributions, reverse=True)
        assert {f["nom"] for f in corps["facteurs"]} <= set(EXEMPLE["indicateurs"]) | {"HISTORIQUE_SEMESTRES"}
        risque_eleve = corps["probabilite"]
        faible = c.post("/predict", json=FAIBLE).json()["probabilite"]
        assert risque_eleve > 0.7 and faible < 0.3 and faible < risque_eleve - 0.4
        # un indicateur absent ne produit aucun facteur
        assert all(f["nom"] != "TAUX_ABSENCE" for f in c.post("/predict", json={"indicateurs": {"MOYENNE_SEMESTRE": 9}}).json()["facteurs"])


def test_explication_historique_coherente(modele_rapide):
    """Retirer l'historique ne doit pas produire un facteur demesure (entree impossible)."""
    with TestClient(app) as c:
        c.post("/activate", json={"nom": modele_rapide["nom"], "version": modele_rapide["version"]})
        facteurs = {f["nom"]: f["contribution"] for f in c.post("/predict", json=EXEMPLE).json()["facteurs"]}
        assert "HISTORIQUE_SEMESTRES" in facteurs and abs(facteurs["HISTORIQUE_SEMESTRES"]) < 3.0


def test_predict_tolere_donnees_partielles_et_vides(modele_rapide):
    with TestClient(app) as c:
        c.post("/activate", json={"nom": modele_rapide["nom"], "version": modele_rapide["version"]})
        assert c.post("/predict", json={}).status_code == 200
        assert c.post("/predict", json={"indicateurs": {"MOYENNE_SEMESTRE": None}, "historique": []}).status_code == 200


def test_predict_requete_invalide_au_format_erreur(modele_rapide):
    with TestClient(app) as c:
        c.post("/activate", json={"nom": modele_rapide["nom"], "version": modele_rapide["version"]})
        r = c.post("/predict", json={"indicateurs": {"MOYENNE_SEMESTRE": "abc"}})
        assert r.status_code == 422 and "erreur" in r.json()


def test_sans_modele_actif_503():
    with TestClient(app) as c:
        Etat.predictionneur = None
        assert c.get("/health").json()["statut"] == "sans_modele"
        r = c.post("/predict", json=EXEMPLE)
        assert r.status_code == 503 and "erreur" in r.json()


def test_cle_api(modele_rapide, monkeypatch):
    monkeypatch.setattr(config, "API_KEY", "secret")
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200
        assert c.get("/models").status_code == 401
        assert c.get("/models", headers={"X-API-Key": "faux"}).status_code == 401
        assert c.get("/models", headers={"X-API-Key": "secret"}).status_code == 200


def test_activation_modele_inconnu_404():
    with TestClient(app) as c:
        assert c.post("/activate", json={"nom": "x", "version": "0"}).status_code == 404


def test_csv_reel_et_garde_fou_du_chemin(modele_rapide, tmp_path):
    lignes = ["etudiant_id;semestre_id;date_debut;echec;MOYENNE_SEMESTRE;TAUX_ABSENCE"]
    rng = np.random.default_rng(0)
    for e in range(120):
        for s in range(3):
            m = float(np.clip(rng.normal(11, 3), 0, 20))
            lignes.append(f"E{e};{s};2025-0{s + 1}-01;{int(m < 10)};{str(round(m, 2)).replace('.', ',')};{rng.random() * 0.3:.3f}")
    (config.DATA_DIR / "export.csv").write_text("\n".join(lignes), encoding="utf-8")
    ds = charger(config.DATA_DIR / "export.csv")
    assert ds.source == "REELLE" and len(ds) == 360
    with TestClient(app) as c:
        assert c.post("/train", json={"source": "csv", "fichier": "../secret.csv"}).status_code == 404
        assert c.post("/train", json={"source": "csv"}).status_code == 400
