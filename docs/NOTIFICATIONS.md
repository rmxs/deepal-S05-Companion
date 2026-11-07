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
| Unlocked vehicle | The car remains unlocked | Delay, repeats, away/parked conditions and Lock/Dismiss actions |
| Open window, door or trunk | An opening remains open | Delay, repeats and available away/parked conditions |
| Lights on | Vehicle lights remain on | Delay, repeats and available away/parked conditions |
| Tyre pressure | A tyre pressure warning is active | Delay, repeats and severity |
| Critical warning | A supported critical vehicle warning is active | Delay, repeats and severity |
| Vehicle warning | A supported vehicle warning is active | Delay, repeats and severity |
| Key battery | The key battery warning is active | Delay, repeats and severity |
| Low battery | Battery level is below your threshold | Percentage threshold, delay and repeats |
| Low fuel | Hybrid fuel range is below your threshold | Remaining range in km, delay and repeats |
| Climate left on | Climate has remained on | Delay, repeats and available conditions |
| Comfort functions left on | Seat heating, ventilation or steering-wheel heating remains on while locked and parked | Delay, repeats and available conditions |
| Lost connection to the vehicle | The cloud connection remains unavailable | Delay, repeats and severity |

Only settings relevant to the selected alert are shown. Some alerts need vehicle sensors that may not be available on every model. **Plugged in, but not charging** can also apply during scheduled charging; choose a suitable delay or leave it off.

## Customise an alert

1. Select the alert row or its edit arrow.
2. Turn the alert on or off.
3. Set **Before first alert**.
4. If available, set **Repeat every** and **Max repetitions**.
5. Set the alert’s threshold, such as the charging-complete percentage.
6. Choose **Only when I am away from home** or **Only when the car is parked**, where offered.
7. Set **Parked for** when using the parked condition.
8. Choose the notification severity.
9. Choose a notification icon using the Home Assistant icon picker.
10. Edit the title and message. Use the offered tags to insert values such as vehicle name, battery, range or elapsed minutes.
11. Choose the supported notification buttons.
12. Check the message preview, send a test and save.

**Reset alert** restores that alert’s defaults. **Cancel** discards unsaved edits. Reminders stop when their condition clears or when you use Dismiss.

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

## Live charging on the Lock Screen

> [!IMPORTANT]
> **Charging can stay visible on your phone while the dashboard is closed.** Companion supports iPhone **Live Activities** and Android **Live Updates** for charging progress. Enable this separately under **Notifications → Live charging**. It is off by default.
>
> Updates use the car’s last reported battery and charging readings. The default update interval is **300 seconds**, with a **5% battery step**. A faster setting does not make the vehicle integration poll the car faster. A displayed countdown uses the most recently reported remaining-time estimate.

### Requirements

- Home Assistant Core **2026.7.0 or newer**.
- A current Home Assistant Companion App connected to the same server.
- iPhone/iPad **iOS/iPadOS 17.2 or later** for Live Activities, or **Android 16 or later** for Live Updates.
- Notifications and Live Activities/Live Updates allowed on the phone.
- A working connection from the phone to Home Assistant, including remote access when away.

Check the [official Home Assistant Live Activity guide](https://companion.home-assistant.io/docs/notifications/live-activities/) for phone-specific permissions and setup.

### Enable live charging

1. Open **Deepal Companion → Notifications**.
2. Select the receiving phone under **Devices to notify**.
3. Find the **Live charging** section and turn it on.
4. Leave **Update interval (s)** at 300 or enter your preferred interval.
5. Leave **Battery step (%)** at 5 or enter another step.
6. Under **Lock Screen display**, choose **Time remaining** or **Battery only**.
7. If needed, open its **Advanced** section and set **Maximum reading age**. The default is 1800 seconds.
8. Save notification settings.
9. Start charging and check the phone’s Lock Screen.

The activity displays battery progress and reported charging information. It updates as fresh readings arrive and ends when charging finishes or stops, subject to the phone’s delivery behaviour.

### Test live charging

1. Select your receiving phone.
2. Choose **Test live charging**.
3. Check for a Live Activity/Live Update on the phone.
4. Choose **End live test** when finished.

The test uses a separate activity from a real charge. If a normal test notification works but a live test does not, check live-activity permissions, app version and connection to Home Assistant.

## Recent activity

1. Open **Notifications → Recent activity**.
2. Review the five loaded entries and their result details.
3. Use **Load more** to fetch older entries.
4. Use an entry’s delete button to remove it, or **Delete all** to clear the activity list.

Deleting activity entries does not delete charging sessions or notification settings.

