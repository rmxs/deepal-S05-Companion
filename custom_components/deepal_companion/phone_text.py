"""Texts the integration itself writes into phone notifications, in the Home Assistant language.

English is the key. The wording matches the Companion panel dictionaries (frontend/lang). Rule titles and messages
come from the alert presets in the panel, which are translated there before they are saved."""
from __future__ import annotations

from functools import lru_cache
from json import loads
from pathlib import Path

LANGUAGES = ("it", "es", "de", "el")  # every other language falls back to English
_FOLDER = Path(__file__).parent / "phone_text"


@lru_cache(maxsize=None)
def _texts(lang):
    """The translated texts of one language, read from phone_text/<lang>.json once."""
    return loads((_FOLDER / (lang + ".json")).read_text(encoding="utf-8"))


MESSAGE_LANGUAGES = ("auto", "en") + LANGUAGES
_chosen = {}  # id(hass) -> chosen message language; "auto" or missing follows the Home Assistant language


def set_language(hass, choice):
    """The "Message language" setting: every text Companion writes into phone notifications uses it."""
    _chosen[id(hass)] = choice if choice in MESSAGE_LANGUAGES else "auto"


def language_choice(hass):
    """The saved choice: "auto" or a language code."""
    return _chosen.get(id(hass), "auto")


def language(hass):
    choice = _chosen.get(id(hass), "auto")
    if choice != "auto":
        return choice
    value = str(getattr(getattr(hass, "config", None), "language", "") or "en").lower().replace("_", "-")
    return value.split("-")[0] if value.split("-")[0] in LANGUAGES else "en"


def tr(hass, text):
    """The Home Assistant language version of a fixed notification text; unknown text stays English."""
    lang = language(hass)
    return _texts(lang).get(text, text) if lang != "en" else text


def month(hass, number):
    lang = language(hass)
    names = _texts(lang).get("months") if lang != "en" else None
    return names[number - 1] if names else None


async def async_preload(hass):
    """Read every language file once in the executor, so no file is opened inside the event loop."""
    def load():
        for lang in LANGUAGES:
            _texts(lang)
    await hass.async_add_executor_job(load)
