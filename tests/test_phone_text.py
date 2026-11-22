import importlib
import re
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest

package = ModuleType("dcpkg_phone")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/deepal_companion")]
sys.modules["dcpkg_phone"] = package
text = importlib.import_module("dcpkg_phone.phone_text")


def hass(language):
    return SimpleNamespace(config=SimpleNamespace(language=language))


class PhoneText(unittest.TestCase):
    def test_follows_home_assistant_language(self):
        self.assertEqual(text.tr(hass("it"), "Lock vehicle"), "Blocca veicolo")
        self.assertEqual(text.tr(hass("es-ES"), "Dismiss"), "Ignorar")
        self.assertEqual(text.tr(hass("de"), "Trunk"), "Kofferraum")
        self.assertEqual(text.tr(hass("el"), "Not charging"), "Δεν φορτίζει")

    def test_other_languages_and_unknown_text_stay_english(self):
        self.assertEqual(text.tr(hass("fr"), "Dismiss"), "Dismiss")
        self.assertEqual(text.tr(hass("it"), "Something else"), "Something else")
        self.assertEqual(text.tr(SimpleNamespace(), "Test"), "Test")

    def test_every_language_has_the_same_keys_and_twelve_months(self):
        english = {lang: text._texts(lang) for lang in text.LANGUAGES}
        keys = set(english["it"])
        for lang, words in english.items():
            self.assertEqual(set(words), keys, lang)
            self.assertEqual(len(words["months"]), 12)

    def test_every_english_phone_text_used_in_code_has_a_translation(self):
        root = Path(__file__).resolve().parents[1] / "custom_components/deepal_companion"
        used = set()
        for path in root.glob("*.py"):
            for double, single in re.findall(r"""(?<![A-Za-z_])tr\(\s*(?:self\.hass|hass)\s*,\s*(?:"([^"]+)"|'([^']+)')""", path.read_text(encoding="utf-8")):
                used.add(double or single)
        used.discard("config")  # hass.config helpers, not phone text
        self.assertTrue(used, "no phone texts found")
        for lang in text.LANGUAGES:
            missing = sorted(t for t in used if t not in text._texts(lang))
            self.assertEqual(missing, [], lang)

    def test_no_language_is_written_inline_in_python(self):
        source = (Path(__file__).resolve().parents[1] / "custom_components/deepal_companion/phone_text.py").read_text(encoding="utf-8")
        for lang in ("Dismiss", "Ignorar", "Kofferraum", "Blocca"):
            self.assertNotIn(lang, source)

if __name__ == "__main__":
    unittest.main()
