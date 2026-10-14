"""Plan d'etudes TEK-UP, cycle d'ingenieur en sciences du numerique, parcours GLSI (2024-2025).

Source : plans d'etudes publies par TEK-UP (cycle preparatoire integre S1-S4, specialite GLSI S5-S10).
Un module = (nom, domaine, coefficient, ECTS, volume horaire, prerequis, panier optionnel).
Hypotheses a connaitre :
  * S10 = projet de fin d'etudes (coef 20, 30 ECTS, 378 h), valeurs lues sur le plan SSIR (meme structure).
  * S9 : les modules des paniers optionnels (Flutter / Realite virtuelle ; iOS / React) ne sont pas
    comptes dans les totaux publies ; l'etudiant en choisit un par panier.
  * S4 : le plan annonce 32 ECTS, la somme des modules en donne 31 (ecart du document source).
Les prerequis sont une modelisation pedagogique (dependance des notes), pas une regle du plan.
"""
from __future__ import annotations

from typing import Dict, List, NamedTuple, Optional


class Module(NamedTuple):
    nom: str
    domaine: str          # MATH, INFO, RESEAU, LANGUE, GESTION, PROJET
    coef: float
    ects: float
    vht: float
    prerequis: Optional[str] = None
    panier: Optional[str] = None   # modules optionnels : un seul par panier


def _m(ligne: str) -> Module:
    p = [x.strip() for x in ligne.split("|")]
    return Module(p[0], p[1], float(p[2]), float(p[3]), float(p[4]),
                  p[5] or None if len(p) > 5 else None, p[6] or None if len(p) > 6 else None)


_BRUT: Dict[int, List[str]] = {
    1: ["Analyse 1|MATH|3|4|42", "Algebre 1|MATH|3|4|42", "Reseau IP-1|RESEAU|2|4|42", "Base de donnees|INFO|2|4|42",
        "Initiation a l'informatique et C2I|INFO|1|2|21", "Programmation C|INFO|1|2|21", "Atelier de langage C|INFO|2|4|42",
        "Algorithmique et structures de donnees 1|INFO|2|4|42", "Anglais 1|LANGUE|1|2|21", "Francais 1|LANGUE|1|2|21", "Droit general|GESTION|1|2|21"],
    2: ["Analyse 2|MATH|3|4|42|Analyse 1", "Algebre 2|MATH|3|4|42|Algebre 1", "SQL|INFO|1|2|21|Base de donnees", "Reseau IP-2|RESEAU|2|4|42|Reseau IP-1",
        "Algorithmique et structures de donnees 2|INFO|2|4|42|Algorithmique et structures de donnees 1",
        "Programmation C avancee|INFO|2|4|42|Atelier de langage C", "Infographie|INFO|2|4|42",
        "Anglais 2|LANGUE|1|2|21|Anglais 1", "Francais 2|LANGUE|1|2|21|Francais 1", "Droit d'entreprise|GESTION|1|2|21|Droit general"],
    3: ["Analyse 3|MATH|2|4|42|Analyse 2", "Algebre 3|MATH|2|4|42|Algebre 2", "Python 1|INFO|2|4|42", "Fondements de base des systemes|INFO|2|4|42",
        "Reseau IP-3|RESEAU|2|4|42|Reseau IP-2", "Systemes logiques|INFO|2|4|42", "Traitement de signal|MATH|1|2|21",
        "Francais 3|LANGUE|1|2|21|Francais 2", "Anglais 3|LANGUE|1|2|21|Anglais 2", "Gestion d'entreprise 1|GESTION|1|2|21"],
    4: ["Algebre 4|MATH|1|2|21|Algebre 3", "Analyse 4|MATH|1|2|21|Analyse 3", "Python 2|INFO|2|4|42|Python 1", "Projet integre|PROJET|2|3|42",
        "Latex|INFO|1|2|21", "Reseau IP-4|RESEAU|2|4|42|Reseau IP-3", "Architecture des ordinateurs modernes|INFO|2|4|42|Systemes logiques",
        "Transmission de donnees|RESEAU|2|4|42", "Francais 4|LANGUE|1|2|21|Francais 3", "Anglais 4|LANGUE|1|2|21|Anglais 3", "Gestion d'entreprise 2|GESTION|1|2|21|Gestion d'entreprise 1"],
    5: ["Mathematiques de l'ingenieur|MATH|2|3|31.5|Analyse 4", "Systemes logiques GLSI|INFO|2|3|31.5|Systemes logiques", "Reseaux IP GLSI-1|RESEAU|2|4|42|Reseau IP-4",
        "Systeme d'exploitation Linux 1|RESEAU|2|4|42", "Algorithmique et structure de donnees GLSI|INFO|2|4|42|Algorithmique et structures de donnees 2",
        "Programmation C GLSI|INFO|2|4|42|Programmation C avancee", "HTML5 CSS3 Bootstrap|INFO|1|2|21", "SGBD relationnelles|INFO|2|4|42|SQL",
        "Virtualisation et Cloud|RESEAU|2|4|42", "Techniques de communication 1|LANGUE|1|1|10.5", "Communication English 1|LANGUE|1|1|10.5|Anglais 4"],
    6: ["Probabilites, statistiques et processus aleatoires|MATH|2|4|42|Mathematiques de l'ingenieur", "Theorie des graphes|MATH|1|2|21", "Theorie des langages|MATH|1|2|21",
        "Reseaux IP GLSI-2|RESEAU|2|3|31.5|Reseaux IP GLSI-1", "Systemes d'exploitation Linux 2|RESEAU|2|4|42|Systeme d'exploitation Linux 1",
        "Programmation Java|INFO|2|4|42|Programmation C GLSI", "Programmation Python GLSI|INFO|2|3|31.5|Python 2", "IA generative|INFO|1|2|21",
        "Modelisation UML|INFO|2|4|42", "Gestion de versions decentralisee|INFO|1|2|21", "Developpement web JS/PHP|INFO|2|4|42|HTML5 CSS3 Bootstrap",
        "Techniques de communication 2|LANGUE|1|1|10.5|Techniques de communication 1", "Communication English 2|LANGUE|1|1|10.5|Communication English 1"],
    7: ["Bases de donnees avancee|INFO|2|3|31.5|SGBD relationnelles", "Architecture logicielle|INFO|1|2|21|Modelisation UML", "Approches Agile|GESTION|1|2|21",
        "Algorithmique avancee et complexite|INFO|2|3|42|Theorie des graphes", "Traitement d'images|INFO|1|2|21", "Spring Boot|INFO|2|3|42|Programmation Java",
        "Framework PHP Symfony|INFO|2|3|42|Developpement web JS/PHP", "Devops 2|RESEAU|2|3|42|Virtualisation et Cloud", "Design patterns|INFO|2|3|31.5|Programmation Java",
        "Techniques de communication 3|LANGUE|1|2|10.5|Techniques de communication 2", "English communication 3|LANGUE|1|2|10.5|Communication English 2",
        "Conduite de projet|GESTION|1|2|21", "Projet de developpement S7|PROJET|2|2|21"],
    8: ["Services Web|INFO|1|2|21|Spring Boot", "Node JS|INFO|1|2|21|Developpement web JS/PHP", "Angular|INFO|2|3|31.5|Developpement web JS/PHP", "Business Intelligence|INFO|2|2.5|31.5|Bases de donnees avancee",
        "Recherche operationnelle|MATH|1|2|21|Theorie des graphes", "Intelligence artificielle et introduction au machine learning|INFO|1|2|21|Probabilites, statistiques et processus aleatoires",
        "Big Data|INFO|2|2.5|31.5|Bases de donnees avancee", "Programmation II : developpement .NET|INFO|2|3|42|Programmation Java", "Developpement mobile|INFO|2|3|42",
        "Technique de communication 4|LANGUE|1|2|10.5|Techniques de communication 3", "English Communication 4|LANGUE|1|2|10.5|English communication 3",
        "Gestion financiere|GESTION|1|2|21", "Droit de l'entreprise|GESTION|1|2|21|Droit d'entreprise", "Projet de developpement S8|PROJET|2|3|21|Projet de developpement S7"],
    9: ["Architectures AWS|RESEAU|2|4|42|Devops 2", "Devops 3|RESEAU|2|4|31.5|Devops 2", "Framework Django|INFO|2|4|42|Programmation Python GLSI",
        "Qualite logicielle et automatisation des tests|INFO|2|4|31.5|Design patterns", "Ionic|INFO|1|2|21|Developpement mobile", "Web marketing|GESTION|1|2|21",
        "Apprentissage et fouille de donnees|INFO|1|2|21|Intelligence artificielle et introduction au machine learning",
        "Machine learning et deep learning|INFO|2|4|31.5|Intelligence artificielle et introduction au machine learning", "Management et entrepreneuriat|GESTION|1|2|21",
        "Projet de developpement S9|PROJET|2|2|21|Projet de developpement S8",
        "Developpement hybride Flutter|INFO|2|4|42|Developpement mobile|P1", "Realite virtuelle et animation 3D|INFO|1|2|21||P1",
        "Developpement iOS|INFO|2|3|31.5|Developpement mobile|P2", "React|INFO|2|3|31.5|Developpement web JS/PHP|P2"],
    10: ["Projet de fin d'etudes|PROJET|20|30|378|Projet de developpement S9"],
}

PLAN: Dict[int, List[Module]] = {s: [_m(l) for l in lignes] for s, lignes in _BRUT.items()}
N_SEMESTRES = len(PLAN)

# Totaux publies par le plan (coef, ECTS, volume horaire), pour verification. S9 : non controle (paniers).
TOTAUX_PUBLIES = {1: (19, 34, 357), 2: (18, 32, 336), 3: (16, 32, 336), 4: (16, 32, 336), 5: (19, 34, 357),
                  6: (20, 36, 378), 7: (20, 32, 357), 8: (20, 33, 346.5), 10: (20, 30, 378)}


def modules_du_semestre(semestre: int, choix: Optional[Dict[str, str]] = None) -> List[Module]:
    """Modules suivis : obligatoires + le choix de l'etudiant dans chaque panier optionnel."""
    modules = PLAN[semestre]
    obligatoires = [m for m in modules if not m.panier]
    optionnels: Dict[str, List[Module]] = {}
    for m in modules:
        if m.panier:
            optionnels.setdefault(m.panier, []).append(m)
    suivis = list(obligatoires)
    for panier, liste in optionnels.items():
        choisi = (choix or {}).get(panier)
        suivis.append(next((m for m in liste if m.nom == choisi), liste[0]))
    return suivis


def totaux(semestre: int) -> tuple:
    """(coef, ECTS, volume horaire) des modules obligatoires."""
    ms = [m for m in PLAN[semestre] if not m.panier]
    return sum(m.coef for m in ms), sum(m.ects for m in ms), sum(m.vht for m in ms)
