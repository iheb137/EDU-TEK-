import pytest

from app import config


@pytest.fixture(autouse=True)
def dossiers_isoles(tmp_path, monkeypatch):
    """Chaque test travaille dans un dossier de modeles et de donnees temporaire."""
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path / "models")
    monkeypatch.setattr(config, "DATA_DIR", tmp_path / "data")
    (tmp_path / "data").mkdir()
    monkeypatch.setattr(config, "API_KEY", "")
    return tmp_path
