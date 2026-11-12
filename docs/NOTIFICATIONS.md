# Notifications

[README](../README.md) · [User guide](USAGE.md) · [All settings](SETTINGS.md)

Use the separate **Notifications** page in the Companion sidebar dashboard for integration notifications.

## Set up phone alerts

1. Install the **Home Assistant Companion App** on the phone and connect it to this Home Assistant server.
2. Allow notifications in the phone’s system settings.
3. Open **Deepal Companion → Notifications**.
4. Under **Devices to notify**, select the phones that should receive alerts.
5. Enable the notification master switch.
6. Choose **Basic**, **Recommended** or **All**, then review the individual switches.
7. Send a test notification and check the phone.
8. Set quiet hours if needed.
9. Choose **Save Changes**.

The device list comes from the Home Assistant Mobile App integration. Recheck your selection after replacing or registering a phone.

## Available alerts

| Alert | What it reports | Settings to check |
| --- | --- | --- |
| Charging complete | Charging stopped at or above your chosen battery level | Delay, completion percentage, severity, text/icon and available action |
| Plugged in, but not charging | The cable remains connected without charging | Delay, repeats, maximum notifications and severity |
| Charging interrupted | Charging stopped below the completion level while still plugged in | Delay, repeats, maximum notifications and severity |
| Unlocked vehicle | The car remains unlocked | Delay, repeats, away/parked conditions, Advanced conditions and Lock/Dismiss actions |
| Open window, door or trunk | An opening remains open | Delay, repeats, available away/parked conditions and Advanced conditions |
| Lights on | Vehicle lights remain on | Delay, repeats, available away/parked conditions and Advanced conditions |
| Tyre pressure | A tyre pressure warning is active | Delay, repeats and severity |
| Critical warning | A supported critical vehicle warning is active | Delay, repeats and severity |
| Vehicle warning | A supported vehicle warning is active | Delay, repeats and severity |
| Key battery | The key battery warning is active | Delay, repeats and severity |
| Low battery | Battery level is below your threshold | Percentage threshold, delay and repeats |
| Low fuel | Hybrid fuel range is below your threshold | Remaining range in km, delay and repeats |
| Climate left on | Climate has remained on | Delay, repeats, available conditions and Advanced conditions |
| Comfort functions left on | Seat heating, ventilation or steering-wheel heating remains on while locked and parked | Delay, repeats, available conditions and Advanced conditions |
| Lost connection to the vehicle | The cloud connection remains unavailable | Delay, repeats and severity |

Only settings relevant to the selected alert are shown. Some alerts need vehicle sensors that may not be available on every model. **Plugged in, but not charging** can also apply during scheduled charging; choose a suitable delay or leave it off.

## Customise an alert

1. Select the alert row or its edit arrow.
2. Turn the alert on or off.
3. Set **Before first alert**.
4. If available, set **Repeat every** and **Max repetitions**.
5. Set the alert’s threshold, such as the charging-complete percentage.
6. Choose **Only when I am away from home** or **Only when the car is parked**, where offered.
7. If the car is often left switched on, set **Car on, not moving for** (default 30 minutes). It is shown with the parked condition.
8. Choose the notification severity.
9. Choose a notification icon using the Home Assistant icon picker.
10. Edit the title and message. Use the offered tags to insert values such as vehicle name, battery, range or elapsed minutes.
11. Choose the supported notification buttons.
12. Check the message preview, send a test and save.

### What “parked” means

The car does not switch itself off when you leave, so its power status often stays **on**. With **Only when the car is parked**, an alert is sent when either of these is true:

- The power status is **off**, and the alert’s **Before first alert** time has passed.
- The power status is **on** and the odometer has not changed for **Car on, not moving for** (the first-alert time is part of this wait; never less than 2 minutes).

While you drive the odometer keeps changing, so nothing is sent. The car reports about every 5 minutes (about every 2 while driving), so alerts can be a few minutes late. Both times follow what you set; nothing is fixed. Alerts from older versions are updated automatically.

### Advanced conditions

For the five parked alerts, **Advanced conditions** lets you decide when the alert counts as parked. Switch it on, choose whether **all** or **any** of your rows must be true, then add rows: a sensor (power status, engine, odometer, doors, lights, any door, windows, charging cable, charging or climate), a state and, if you want, how many minutes it must hold. Up to 8 rows. Your rows replace the default parked check, and **Before first alert** is still added afterwards. Switch it off to return to the default. Sensors your car does not have are left out.

### Why isn’t it sending?

Choose **Why isn’t it sending?** on an alert. It lists every condition with ✓ (true), ✕ (not true) or ⏳ (waiting), the current value and when the sensor last changed. Tap the **?** next to a line for a short explanation of that sensor and when it changes. It only reads; nothing is sent.

**Reset alert** restores that alert’s defaults. **Cancel** discards unsaved edits. Reminders stop when their condition clears or when you use Dismiss. If every selected phone has a condition that is not met, the alert waits and is sent as soon as one phone qualifies.

### Severity

- **Information:** a quiet notification.
- **Important:** a sound alert that respects quiet hours.
- **Critical:** bypasses quiet hours; phone permissions and system settings control whether it can interrupt Do Not Disturb.

### Action buttons

- **None:** show the notification without action buttons.
- **Dismiss:** stop further reminders for the current alert.
- **Lock vehicle:** available for the unlocked-vehicle alert.
- **Lock + Dismiss:** lock the car and stop its current reminders.

The preview shows the actions selected for that alert. Lock sends a real vehicle command.

## Set quiet hours

1. Open **Notifications → Quiet hours**.
2. Enable quiet hours.
3. Set the start and end times, including an overnight range such as 22:00–07:00.
4. Select **Silent** or **No notification**.
5. Save your changes.

Critical alerts are exempt from quiet hours. Under the overview’s **Advanced** section, **Ignore old data** can suppress checks based on stale vehicle readings. Set 0 to turn that check off.

## Test a notification

1. Select at least one phone under **Devices to notify**.
2. Open an alert and choose **Send a test of this notification**, or use the overview test.
3. Check the result message in Companion.
4. Confirm receipt on the selected phone.
5. Save any settings you want to keep.

A test does not turn the alert on or operate the car. Quiet alerts use sound for tests. An accepted request means Home Assistant accepted it; check the phone to confirm delivery.

## Live notifications on the Lock Screen

> [!IMPORTANT]
> **Live notifications stay visible on your phone while the dashboard is closed.** Companion supports iPhone **Live Activities** and Android **Live Updates**. They have their own box at the top of **Notifications**, separate from the other alerts, and every one is **off by default**.
>
> Updates use the car’s last reported readings. A faster setting does not make the vehicle integration poll the car faster, and the car’s cloud is read about every 5 minutes, so very short events can be missed.

There are three Live notifications. Each opens its own page, so you only see the options that belong to it.

| Notification | What it shows | Page options |
| --- | --- | --- |
| **Live charging** | Battery level and, if you want, time left while the car charges | Show time remaining; Update at most every (minutes); Update every (battery %) |
| **Live climate** | Cabin temperature against the target while the climate is on. It disappears when the climate stops | Show target temperature; Show outside temperature; Show progress bar; Show running time; “Turn off” button; Update at most every (minutes); Wait before showing (minutes) |
| **Left open or unlocked** | One list of the doors, windows, bonnet, trunk or unlocked car. Items drop off as they are closed, and it disappears when everything is secure | Doors, Windows, Bonnet and Trunk switches; Unlocked car; Only when the car is parked; Show item count; Show time; “Lock vehicle” button; Wait before showing (minutes) |

- **Only when the car is parked** (on by default) keeps *Left open or unlocked* quiet while you drive, and ends a running notification when you drive off. The car counts as parked when it is off, or on with the odometer unchanged for about 2 minutes, so it does not flicker while you drive. **Wait before showing** defaults to 5 minutes, because the car reports about every 5 minutes; a lower saved value is raised to 5.
- **Live charging** ends on your phone when the car stays unreachable longer than the reading age limit.
- Each live notification adds one **started** and one **ended** entry to Recent activity.
- Live notification text uses the same colour as the icon and progress bar from the card palette, including when the timer is off.

Every page also has an **Alert enabled** switch, a **Title**, an **Icon**, a **Send test** button and an **End test** button.

- The notification title shows only the useful information, for example “72% · 1 h 20 min left”.
- **Icon** accepts Material Design icons only (names starting with `mdi:`). The phone app cannot show other icon sets, so other names are refused. The list offers the most useful ones and highlights the one in use.
- Colours follow the card palette on the progress bar, the timer and the icon. Doors, windows and an unlocked car show in red.
- The **Turn off** and **Lock vehicle** buttons are marked **Android only**, because iPhone Live Activities cannot show action buttons.
- **When you tap a notification** sits in the same box as **Old data protection**. Choose the dashboard page the phone opens, or leave it empty to open the page the Home Assistant app shows by default. To open Companion, choose its page here. The **Card only page** button opens just the card (press it again to clear it). New installations use this page by default; an existing choice, including empty, is kept. The page works even when its sidebar entry is hidden. To show it in the sidebar, use **Card Settings → Advanced → Sidebar**.

### Requirements

- Home Assistant Core **2026.7.0 or newer**.
- A current Home Assistant Companion App connected to the same server.
- iPhone/iPad **iOS/iPadOS 17.2 or later** for Live Activities, or **Android 16 or later** for Live Updates.
- Notifications and Live Activities/Live Updates allowed on the phone.
- A working connection from the phone to Home Assistant, including remote access when away.

Check the [official Home Assistant Live Activity guide](https://companion.home-assistant.io/docs/notifications/live-activities/) for phone-specific permissions and setup.

### Enable a Live notification

1. Open **Deepal Companion → Notifications**.
2. Select the receiving phone under **Devices to notify**.
3. In the **Live notifications** box, open the one you want.
4. Turn on **Alert enabled** and adjust the options.
5. Save notification settings.
6. Start charging, turn on the climate or leave a door open, and check the phone’s Lock Screen.

The **LIVE** tag next to each name is yellow while that notification is on and grey while it is off.

### Test a Live notification

1. Open the Live notification page and make sure a receiving phone is selected.
2. Choose **Send test** and check the phone.
3. Choose **End test** when finished.

A test uses a separate notification from a real one, and ending it leaves your real notification unchanged. If a normal test notification works but a live test does not, check live-activity permissions, the app version and the connection to Home Assistant.

## Recent activity

1. Open **Notifications → Recent activity**.
2. Review the five loaded entries and their result details.
3. Use **Load more** to fetch older entries.
4. Use an entry’s delete button to remove it, or **Delete all** to clear the activity list.

Deleting activity entries does not delete charging sessions or notification settings.

The notifications button on the card shows a red number for entries you have not opened yet. It is saved per Home Assistant user, so it follows you to other devices, and it clears when you open the list. A user who has never opened it starts at zero. The settings preview does not show the number.

