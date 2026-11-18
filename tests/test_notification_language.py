"""Notification language: the admin-only WebSocket operations and the stored choice (API contract, mocked Home Assistant)."""
import importlib
import sys
import types
import unittest

import test_api as base  # reuses its lightweight Home Assistant doubles and the Connection helper

api = base.api
phone_text = importlib.import_module("companion_api_test.phone_text")
MESSAGE_LANGUAGES = phone_text.MESSAGE_LANGUAGES


class FakeStore:
    """Stands in for the Home Assistant Store that keeps deepal_companion.language."""
    def __init__(self, saved=None):
        self.saved = saved
    async def async_save(self, data):
        self.saved = dict(data)
    async def async_load(self):
        return self.saved


class FakeHub:
    """Mirrors Hub.set_language: validate, apply to phone texts, then store the choice."""
    def __init__(self, hass, store):
        self.hass, self._language_store, self.vehicles, self.db = hass, store, {}, None
    async def set_language(self, choice):
        if choice not in MESSAGE_LANGUAGES:
            raise ValueError("Unknown notification language")
        phone_text.set_language(self.hass, choice)
        if self._language_store is not None:
            await self._language_store.async_save({"language": choice})
        return phone_text.language_choice(self.hass)


class NotificationLanguageApi(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.hass = types.SimpleNamespace(config=types.SimpleNamespace(language="en"))
        self.store = FakeStore()
        self.hub = FakeHub(self.hass, self.store)
        self.hass.data = {"deepal_companion": self.hub}
        phone_text.set_language(self.hass, "auto")

    async def call(self, op, data=None, admin=True):
        connection = base.Connection(admin=admin)
        await api.request(self.hass, connection, {"id": 1, "type": "deepal_companion/request", "op": op, "vehicle_id": "", "view_id": "", "data": data or {}})
        return connection

    async def test_get_returns_the_saved_choice_to_any_user(self):
        self.assertEqual((await self.call("notification_language_get", admin=False)).results, [{"language": "auto"}])
        await self.call("notification_language_set", {"language": "el"})
        self.assertEqual((await self.call("notification_language_get", admin=False)).results, [{"language": "el"}])

    async def test_admin_can_set_each_supported_language_and_it_is_stored(self):
        for choice in ("de", "es", "it", "el", "en", "auto"):
            c = await self.call("notification_language_set", {"language": choice})
            self.assertEqual(c.results, [{"language": choice}])
            self.assertEqual(self.store.saved, {"language": choice})
            self.assertEqual(phone_text.language_choice(self.hass), choice)

    async def test_non_admin_cannot_change_the_language(self):
        await self.call("notification_language_set", {"language": "de"})
        c = await self.call("notification_language_set", {"language": "it"}, admin=False)
        self.assertEqual(c.results, [])
        self.assertTrue(c.errors, "A non-admin change must be refused")
        self.assertEqual(self.store.saved, {"language": "de"})
        self.assertEqual(phone_text.language_choice(self.hass), "de")

    async def test_unknown_language_is_rejected_and_nothing_changes(self):
        await self.call("notification_language_set", {"language": "de"})
        for bad in ("fr", "", None, "DE", ["de"]):
            c = await self.call("notification_language_set", {"language": bad})
            self.assertTrue(c.errors, f"{bad!r} must be rejected")
        self.assertEqual(self.store.saved, {"language": "de"})
        self.assertEqual(phone_text.language_choice(self.hass), "de")

    async def test_saved_choice_is_restored_after_restart(self):
        await self.call("notification_language_set", {"language": "es"})
        phone_text._chosen.clear()  # simulate a Home Assistant restart
        saved = await self.store.async_load()
        phone_text.set_language(self.hass, saved.get("language") if isinstance(saved, dict) else "auto")
        self.assertEqual((await self.call("notification_language_get", admin=False)).results, [{"language": "es"}])
        self.assertEqual(phone_text.language(self.hass), "es")


if __name__ == "__main__":
    unittest.main()
