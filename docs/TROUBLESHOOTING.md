# Troubleshooting

[README](../README.md) · [Installation](INSTALLATION.md)

## Companion is missing from Add integration

1. Restart Home Assistant after installing it.
2. For a manual install, check `/config/custom_components/deepal_companion/manifest.json`.
3. Check **Settings → System → Logs** for a Deepal Companion error.

## No vehicle is found

1. Open **Settings → Devices & services → Deepal Alternative**.
2. Confirm the vehicle and its battery sensor are enabled.
3. Check that the battery sensor is a percentage sensor.
4. Try adding Deepal Companion again.

## The page appears unstyled or reports an unknown operation

1. Restart Home Assistant after the update.
2. Fully reload the browser or reopen the Companion App.
3. Reopen the page and choose **Try again**, if shown.

## Card settings do not match Companion

1. Edit the dashboard card.
2. Check that its type is **Deepal Companion** (`custom:deepal-companion-card`).
3. Check the selected vehicle and card profile.
4. Save, then reopen the dashboard.

## A control or reading is missing

1. Check that its entity exists and has a valid state in Home Assistant.
2. Check **Card Settings → Layout** for a hidden section or control.
3. Check **Card Settings → Advanced → Entity mapping** if the wrong entity is being used.
4. For paint and wheels, check **Card Settings → Advanced** and choose Car View in Appearance.

## Charging text or the curve is missing

1. Check the AC/DC current and charger-connected entities.
2. Choose a charging text style under **Card Settings → Charging**.
3. Enable **Card Settings → Layout → Sections → Charging curve** for the current-session graph.
4. For an older curve, open **Sessions → Data options → Import older Recorder charges**.
5. Reopen the saved charge’s curve.

A saved curve needs recorded current readings. Readings already purged before import cannot be recovered.

## A cost is missing or looks wrong

1. Open the session’s **Edit charge** popup.
2. Check its location, tariff, free setting and energy source.
3. Enter receipt kWh or total paid if you have them.
4. Save and recheck the totals.

Battery-based figures are marked as estimates. **Not priced** sessions do not count as free sessions.

## A phone notification does not arrive

1. Open **Notifications** and select the correct Mobile App phone.
2. Check the master switch and the individual alert switch.
3. Save changes and send a test.
4. Confirm the phone allows Home Assistant notifications.
5. Check quiet hours, severity, away/parked conditions and old-data filtering.
6. If the phone was replaced, recheck its Mobile App registration and recipient selection.
7. For Live charging, follow the separate [requirements and test steps](NOTIFICATIONS.md#live-charging-on-the-lock-screen).

## Duplicate alerts arrive

1. Check the selected receiving devices on **Notifications**.
2. Review enabled rules and their repeat intervals.
3. Check other Home Assistant notification rules if the same event is reported more than once.

## Before reporting an issue

Include the Companion version, Home Assistant version, phone/browser, steps to reproduce and relevant log messages. Remove tokens, personal details and private vehicle information before sharing logs.
