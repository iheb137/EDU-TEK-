import numpy as np
import pytest

from app.plan_etudes import PLAN, TOTAUX_PUBLIES, modules_du_semestre, totaux
from app.simulateur_plan import Parametres, generer
from app.train import Config, entrainer


def test_plan_conforme_aux_totaux_publies():
    for semestre, (coef, ects, vht) in TOTAUX_PUBLIES.items():
        c, e, v = totaux(semestre)
        assert c == coef and v == vht, semestre
        assert abs(e - ects) <= 1, semestre          # S4 : 31 au lieu de 32 dans le document source


def test_prerequis_connus_et_dans_un_semestre_anterieur():
    place = {m.nom: s for s, ms in PLAN.items() for m in ms}
    for s, ms in PLAN.items():
        for m in ms:
            if m.prerequis:
                assert m.prerequis in place, m.nom
                assert place[m.prerequis] < s, m.nom


def test_un_seul_module_par_panier_optionnel():
    noms = [m.nom for m in modules_du_semestre(9)]
    assert sum(n in noms for n in ("Developpement hybride Flutter", "Realite virtuelle et animation 3D")) == 1
    assert sum(n in noms for n in ("Developpement iOS", "React")) == 1


def test_simulateur_reproductible_et_plausible():
    a, b = generer(300, 7), generer(300, 7)
    assert np.array_equal(a.X, b.X) and np.array_equal(a.y, b.y)
    assert a.source == "SYNTHETIQUE"
    assert 0.05 < a.y.mean() < 0.5
    par_semestre = a.description["taux_echec_par_semestre"]
    assert par_semestre["S1"] > par_semestre["S10"]         # le cycle preparatoire est plus selectif
    assert set(par_semestre) <= {f"S{i}" for i in range(1, 11)}


def test_les_parametres_pilotent_le_taux_d_echec():
    facile = Parametres(niveau_semestre=[14.0] * 10)
    difficile = Parametres(niveau_semestre=[9.0] * 10)
    assert generer(300, 3, difficile).y.mean() > generer(300, 3, facile).y.mean() + 0.2


def test_entrainement_sur_le_plan(tmp_path, monkeypatch):
    from app import config
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path / "models")
    meta = entrainer(Config(source="plan", etudiants=400, epoques=3), lambda *_: None)
    assert meta["donnees"] == "SYNTHETIQUE"
    assert meta["donnees_description"]["generateur"] == "app.simulateur_plan"
    assert "rappel_top20" in meta["metriques"]["test"]["gru"]
