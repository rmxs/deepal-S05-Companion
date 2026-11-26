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
3. Check **Card Settings → Vehicle → Entity mapping** if the wrong entity is being used.
4. For car colour and wheels, check **Card Settings → Vehicle**, and choose Car View in **Appearance**.

## Charging text or the curve is missing

1. Check the AC/DC current and charger-connected entities.
2. Choose a charging text style under **Card Settings → Charging**.
3. Enable **Card Settings → Advanced → Charging records → Charging curve** for the current-session graph.
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
5. Check quiet hours, severity, away/parked conditions and old-data filtering. If every phone has a condition that is not met, the alert waits; choose **Why isn’t it sending?** on the alert to see which condition holds it, with the current values and a **?** explanation for each. If the car was left switched on, check **Car on, not moving for** (default 30 minutes): the car does not switch itself off, so it counts as parked only after the odometer stops changing.
6. If the phone was replaced, recheck its Mobile App registration and recipient selection.
7. For Live notifications, follow the separate [requirements and test steps](NOTIFICATIONS.md#live-notifications-on-the-lock-screen).

## Preconditioning does not start, or fails

1. **“The car is switched on or being driven”** (Deepal code 1036): remote climate works only when the car is parked and switched off. Companion does not retry and hands the climate over to the driver.
2. **“The car did not answer in time”:** the car may be asleep or have a weak mobile signal. Companion asks for fresh data before every start and stop, and retries up to the number of attempts set under **General → Advanced: retries and checks**.
3. **Stop or Start was “not confirmed” although the car did change:** Companion asks the car for a fresh report after every command. If the car still does not send one within the wait time (**General → Advanced: retries and checks**), the attempt counts as not confirmed. Increase **Wait for the car to answer**, and check the Deepal Alternative integration and the car’s mobile signal.
4. **“The Deepal sign-in has expired”:** open Deepal Alternative in Home Assistant and sign in again.
5. **“Deepal refused because too many commands were sent”:** wait a little. Companion pauses before trying again.
6. **Start blocked by the battery:** check **Battery protection** on the Preconditioning page. The last battery reading is refreshed before every start. If the car still does not report its battery level, the start is blocked on purpose.
7. **A schedule did not run:** check that **Scheduled preconditioning** is on (it is off by default), that the schedule is enabled, and **Notifications → Recent activity** for “skipped” or “missed”. A schedule that is more than five minutes late because Home Assistant was not running is recorded as missed.
8. **Remote climate stops after 15 minutes:** this is the car’s own limit. Companion never extends it.
9. **“Unknown operation” on the Preconditioning page:** restart Home Assistant after updating.
10. **“Vehicle unavailable” or unknown values on a Home Assistant set to another language:** update to 2.0.1-b1 and restart Home Assistant. Companion now finds the car’s entities even when they have other names or the language is not English.

## A preconditioning notification does not arrive

1. Open **Notifications → Preconditioning**, choose a phone and press **Send test notification**.
2. “Sent to 1 of 1 phones” means Home Assistant accepted the message. Arrival on the phone is not confirmed, so also check the phone’s notification permission for the Home Assistant app.
3. Check the event you expect is switched on, the main **Notifications** switch is on, and the phone is selected.
4. Check **Settings → System → Logs** for “Error sending notification”, and restart Home Assistant after an update.

## The lock time looks wrong

1. The card reads the car’s cloud about every 5 minutes, and an unlock lasts only seconds, so a quick unlock and lock between two readings is never seen.
2. While the engine or power is on, the card shows **In use** and makes no lock claim, because the car may lock itself while driving.
3. **Locked after 21:14** means the car was driven since the last lock change, and it was locked some time after that moment. The odometer and the engine state are used to detect a drive.
4. The lock and engine times come from the recorded history, so restarting Home Assistant or reloading the integration does not reset them. If the recorder has no history, the card falls back to the time Home Assistant last saw a change.
5. Check the age badge on the refresh button. An old reading (yellow after 2 hours, red after 4) means the car has not reported recently; use the refresh button.

## The Deepal Card entry is missing from the sidebar

1. It is hidden by default. An administrator can turn on **Card Settings → Vehicle → Sidebar → Show “Deepal Card” in the sidebar**.
2. Reload the browser after changing it.
3. The page itself still opens at `/deepal-companion-card`, and notifications can open it.

## The card shows “Connection lost” on the phone

1. Home Assistant shows this message itself when the app was in the background for a long time.
2. The card and the Companion pages check the connection when you return and reconnect by themselves. Wait a few seconds; the data reloads without a manual refresh.
3. If the message stays, close the Home Assistant app completely, open it again and check your network.


## Colours or text look wrong after an update

1. Hard-refresh the browser (Ctrl+F5).
2. In the Home Assistant app on a phone, open **Settings → Companion app → Debugging → Reset frontend cache**, then reopen the dashboard.
3. The Companion pages and the card follow your Home Assistant theme. If a page still looks dark on a light theme, check **Profile → Theme** in Home Assistant, and tell us which page it is.

## The connection badge shows Offline or No data

1. **Offline** means Deepal Alternative reports the vehicle cloud connection as off or unavailable. Check that integration and its sign-in.
2. **No data** means the connection sensor has no state yet or was not found. Check the entity prefix under **Card Settings → Vehicle**.

## The Settings gear is missing

1. The gear is shown to Home Assistant administrators only.
2. Check **Card Settings → Layout → On the image → Settings button**.

## Duplicate alerts arrive

1. Check the selected receiving devices on **Notifications**.
2. Review enabled rules and their repeat intervals.
3. Check other Home Assistant notification rules if the same event is reported more than once.

## Fuel items are shown on an electric car, or missing on a hybrid

1. Open **Card Settings → Vehicle → Vehicle type**.
2. **Automatic** treats the car as a hybrid when a fuel level, fuel range or fuel volume sensor exists for the vehicle prefix. If an electric car still shows fuel, check whether Deepal Alternative creates a fuel sensor for it; otherwise choose **Electric**.
3. If a hybrid shows no fuel, make sure its fuel sensors exist and the prefix is correct, or choose **Plug-in hybrid**.
4. Reload the page after changing the type. Choosing Electric only hides fuel items; no data is deleted.

## Phone notification text or times are not what I expect

1. Texts follow the Home Assistant language (**Settings → System → General**): English, Italian, Spanish, German or Greek. Other languages stay English.
2. Alerts you saved earlier keep the language they had when saved. Re-save or reset the alert to use the new language.
3. Titles and messages you wrote yourself are sent exactly as typed.
4. Times use the Home Assistant time zone. Restart Home Assistant after an update, because the notification code runs in the backend.

## Before reporting an issue

Include the Companion version, Home Assistant version, phone/browser, steps to reproduce and relevant log messages. Remove tokens, personal details and private vehicle information before sharing logs.
