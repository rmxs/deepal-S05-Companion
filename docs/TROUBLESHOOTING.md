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
7. For Live notifications, follow the separate [requirements and test steps](NOTIFICATIONS.md#live-notifications-on-the-lock-screen).

## The lock time looks wrong

1. The card reads the car’s cloud about every 5 minutes, and an unlock lasts only seconds, so a quick unlock and lock between two readings is never seen.
2. While the engine or power is on, the card shows **In use** and makes no lock claim, because the car may lock itself while driving.
3. **Locked after 21:14** means the car was driven since the last lock change, and it was locked some time after that moment. The odometer and the engine state are used to detect a drive.
4. The lock and engine times come from the recorded history, so restarting Home Assistant or reloading the integration does not reset them. If the recorder has no history, the card falls back to the time Home Assistant last saw a change.
5. Check the age badge on the refresh button. An old reading (yellow after 2 hours, red after 4) means the car has not reported recently; use the refresh button.

## The Settings gear is missing

1. The gear is shown to Home Assistant administrators only.
2. Check **Card Settings → Layout → On the image → Settings button**.

## Duplicate alerts arrive

1. Check the selected receiving devices on **Notifications**.
2. Review enabled rules and their repeat intervals.
3. Check other Home Assistant notification rules if the same event is reported more than once.

## Before reporting an issue

Include the Companion version, Home Assistant version, phone/browser, steps to reproduce and relevant log messages. Remove tokens, personal details and private vehicle information before sharing logs.
