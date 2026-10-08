import numpy as np

from app.features import FEATURES, INPUT_DIM, N_FEAT, SEQ_LEN, encode_periode, encode_sequence


def test_indicateur_absent_n_est_pas_un_zero_invente():
    valeurs, absents = encode_periode({"MOYENNE_SEMESTRE": 10.0})
    i = FEATURES.index("MOYENNE_SEMESTRE")
    assert absents[i] == 0 and valeurs[i] == 0.5
    j = FEATURES.index("TAUX_ABSENCE")
    assert absents[j] == 1 and valeurs[j] == 0


def test_valeurs_hors_bornes_ou_invalides():
    valeurs, absents = encode_periode({"MOYENNE_SEMESTRE": 99, "TAUX_ABSENCE": float("nan"), "CREDITS_OBTENUS": None})
    assert valeurs[FEATURES.index("MOYENNE_SEMESTRE")] == 1.0
    assert absents[FEATURES.index("TAUX_ABSENCE")] == 1
    assert absents[FEATURES.index("CREDITS_OBTENUS")] == 1


def test_indicateurs_inconnus_ignores():
    _, absents = encode_periode({"INCONNU": 3.0})
    assert absents.sum() == N_FEAT


def test_sequence_remplie_a_gauche_et_courant_en_dernier():
    seq = encode_sequence({"MOYENNE_SEMESTRE": 20.0}, [{"MOYENNE_SEMESTRE": 0.0}])
    assert seq.shape == (SEQ_LEN, INPUT_DIM)
    assert seq[-1, -1] == 1 and seq[-2, -1] == 1 and seq[0, -1] == 0
    assert seq[-1, 0] == 1.0 and seq[-2, 0] == 0.0


def test_historique_trop_long_garde_les_plus_recents():
    hist = [{"MOYENNE_SEMESTRE": float(i)} for i in range(10)]
    seq = encode_sequence({}, hist)
    assert np.isclose(seq[-2, 0], 9 / 20) and np.isclose(seq[0, 0], 6 / 20)
