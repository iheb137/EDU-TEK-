"""Chargement de donnees REELLES anonymisees, exportees du backend en CSV.

Colonnes attendues (separateur virgule ou point-virgule, valeur vide = indicateur absent) :
    etudiant_id, semestre_id, date_debut (AAAA-MM-JJ), echec (0 ou 1), puis les 7 indicateurs.
`etudiant_id` doit etre un identifiant pseudonymise (jamais le matricule, le nom ou l'e-mail).
"""
from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path
from typing import Dict, List

from .dataset import Dataset, Periode, depuis_trajectoires
from .features import FEATURES

COLONNES_OBLIGATOIRES = ["etudiant_id", "semestre_id", "date_debut", "echec"]


def charger(chemin: str | Path) -> Dataset:
    chemin = Path(chemin)
    with chemin.open(newline="", encoding="utf-8-sig") as f:
        echantillon = f.read(2048)
        f.seek(0)
        delimiteur = ";" if echantillon.count(";") > echantillon.count(",") else ","
        lecteur = csv.DictReader(f, delimiter=delimiteur)
        manquantes = [c for c in COLONNES_OBLIGATOIRES if c not in (lecteur.fieldnames or [])]
        if manquantes:
            raise ValueError(f"Colonnes manquantes dans {chemin.name} : {', '.join(manquantes)}")
        brut: Dict[str, List[tuple]] = defaultdict(list)
        for n, rang in enumerate(lecteur, start=2):
            try:
                echec = int(rang["echec"])
                if echec not in (0, 1):
                    raise ValueError
            except (ValueError, TypeError):
                raise ValueError(f"Ligne {n} : 'echec' doit valoir 0 ou 1") from None
            indic = {}
            for nom in FEATURES:
                valeur = (rang.get(nom) or "").strip().replace(",", ".")
                if valeur:
                    try:
                        indic[nom] = float(valeur)
                    except ValueError:
                        raise ValueError(f"Ligne {n} : valeur invalide pour {nom}") from None
            brut[rang["etudiant_id"]].append((rang["date_debut"], indic, echec))
    etudiants: Dict[str, List[Periode]] = {
        ident: [(i, e) for _, i, e in sorted(lignes, key=lambda t: t[0])] for ident, lignes in brut.items()
    }
    return depuis_trajectoires(etudiants, "REELLE", {"fichier": chemin.name, "n_etudiants": len(etudiants)})
