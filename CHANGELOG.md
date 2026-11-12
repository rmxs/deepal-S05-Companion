# Changelog

## 0.1.6 — New Sessions page and safer saving

### Updating to 0.1.6
- Restart Home Assistant after updating (backend files changed), then hard-refresh the browser (Ctrl+F5) so the new card and panel load.
- Parked alerts are updated automatically at start-up. Open and save an alert once to see the new “Why isn’t it sending?” explanations.

### Changes
- **Card only page**: a second page, **Deepal Card** (`/deepal-companion-card`), shows just the card, with no Companion controls and no profile list. It uses the profile you last chose in Card Settings in that browser, or the first profile. It is hidden from the sidebar by default and keeps working from its address and from notifications. The card fills the full height of the device like an app, edge to edge on a phone; if more blocks appear and the content is taller than the screen, the card grows and the page scrolls normally.
- **Car View background by time of day**: the morning and afternoon backgrounds are a deeper blue sky that suits the dark theme (with a warm horizon in the morning), and the evening is a dusk gradient. The sun and moon sit further inside the picture so they are not cut off on narrow screens. The night background stays dark with the moon and stars.
- Every confirmation window (lock, unlock, windows, trunk, climate, lights, horn, locate, refresh) now looks like the Doors window you get by tapping the lock on the car image: the current state, Cancel and Confirm side by side, and the question underneath.
- **Show “Deepal Card” in the sidebar**: a switch under **Card Settings → Advanced → Sidebar** (off by default). An administrator turns it on, then reloads the browser to see the entry.
- **When you tap a notification**: a **Card only page** button opens that page when a notification is tapped. New installations use this page by default; existing choices, including an empty one, are kept.
- **Profile box redesign**: **Card Settings → Profile** starts closed; the arrow next to the badge opens it. It has a header with a connection badge, an equal three-button row (Duplicate, New profile, Delete) and a **Card design** row with **Design style** and **Max width** (px).
- **Connection badge**: next to **Profile**, **Active** (green) shows that Deepal Alternative is connected to the vehicle cloud, **Offline** (red) that the connection is lost, and **No data** (grey) that its status is not available yet. Hover it for details.
- **Action buttons** (scroll layout): buttons are sized so the next one always shows half, instead of a blank edge.
- **Info tiles**: when the row is wider than the card, the cut edge fades, the same as the action buttons row.
- **Corner radius**: the large and small tiles, the charging box and the charging-costs button share one radius, which follows the card corner in the "no padding" layout.
- **Charging box**: the profile dropdown and Assign button have the same height; helper text and buttons are 12 px.
- **Tile spacing**: the gap between the Temperature and Energy tiles matches the other gaps in the "no padding" layout.
- **Settings button on the vehicle image** has a larger touch area (about 44 px) without changing its look.
- **Action buttons** (Rows layout): a shorter last row is centred instead of left-aligned.
- **Equal spacing**: the space above and below the action buttons now matches the space between the other blocks.
- **Data age badge** on the refresh button sits at the top-right corner of the button.

### New
- **Ultra minimal card design.** A one-line strip with the vehicle name, lock status, total range, battery and fuel, plus two Info tiles on wider cards; it shows the remaining charging time while charging. Minimal now has larger battery and fuel rings and a small range bar beside the kilometres.
- **Two new card designs: Minimal and Modern Cockpit.** Choose them under Profile → Card design → Design style. Minimal is a compact status card (name, lock, last update, total range, battery and fuel) with no image or buttons; below the range it shows the Info tiles you choose in Layout → Info (tap for details, hold for your own actions), in two to four rows on a phone. Modern Cockpit shows the vehicle image, a large total range, battery and fuel rings, climate status, and the usual buttons below. On the Energy and Modern Cockpit designs the vehicle image now spans the full card width with the car centred. Both adapt to the width of the card, keep your saved Sections order and visibility (unused sections are greyed out in the list), and show the charging curve while charging.
- **Sessions page redesign**: key figures for the selected period (energy from charger, cost, paid price per kWh, free share), compact session cards with a battery bar that shows the real start and end level and the charge duration, an icon-only edit button and a highlighted charging-curve button, a denser table with right-aligned numbers, and a short summary instead of a nearly empty cost chart.
- **Energy delivered chart** (7 days by default): daily bars split into free, paid and not-priced charging, with a tooltip for each day. The battery and petrol history also opens on the weekly view.
- **Correct or delete a charge** (administrators). The charging curve popup has tools to change a charge between AC and DC, remove charging-current readings in a dragged time range, and delete the charge. A bin icon next to each session deletes it too. Deleted charges stay under **Data options → Deleted charges** for 30 days, where they can be restored; after that they are removed with their receipt. A deleted charge is not brought back by the Recorder import.
- Greek and Spanish cover the new charge tools, the Deleted charges list and their confirmations.
- **Archive status** diagnostic sensor shows whether the charging archive is OK, degraded or stopped, so a recording problem is visible in Home Assistant without opening the Companion page.

- **Car colour and wheels** are now the same in every display profile of a vehicle. Until you save them for the vehicle, each profile uses the value already chosen in your oldest profile that had one; nothing is overwritten.

### Notifications
- **Alerts now arrive when you leave the car on and unlocked.** The car does not switch itself off, so alerts that wait for a parked car (Unlocked vehicle, Open window/door/trunk, Lights on, Climate left on, Comfort functions left on) could stay silent for hours. A car now counts as parked when its power status is off, **or** when it is on and the odometer has not changed for a while. While you drive, nothing is sent.
- **One time for “Before first alert”.** The old separate “Parked for” setting is gone. The time you set in **Before first alert** is the one that counts, so changing it from 15 minutes to 1 hour changes everything together.
- **New “Car on, not moving for” time** (default 30 minutes). Use it to decide how long you can sit in the car, switched on, before it counts as left behind.
- **Existing alerts update by themselves** when Home Assistant starts. You do not need to open or save them again, and your own times are kept.
- **Advanced conditions** for the five parked alerts (Unlocked vehicle, Open window/door/trunk, Lights on, Climate left on, Comfort functions left on). Switch them on to build your own rule: pick a sensor, a state and how long it must hold (for example “Power status On for 20 min” or “Odometer not changing for 30 min”). Choose per alert whether **all** or **any** of the rows must be true. They replace the default parked check; the default stays when they are off.
- **“Why isn’t it sending?” is clearer.** It now lists each condition with ✓ or ✕, the current value and when the sensor last changed (for example “on (changed 12 min ago)”). A **?** next to every line opens a short explanation of the sensor, when it changes and why it is used. Re-save an alert once after updating to see the new lines.
- **Left open or unlocked** (live notification): it now waits **5 minutes** by default (it was 1), because the car reports about every 5 minutes. The switch is renamed **Only when the car is parked**: it stays quiet while you drive and appears after the car has stopped. Existing waits below 5 minutes are raised to 5.
- **Left open or unlocked** now tells that you are driving from the odometer, so it does not appear and disappear while you drive.
- **Greek and Spanish** cover the new alert settings, Advanced conditions, the “Why isn’t it sending?” lines and the **?** explanations.
- **Unread badge on the notifications button.** The card shows a red number for alerts you have not opened yet. It is saved per Home Assistant user, so it follows you across devices, and it clears when you open the list. A new user starts at zero.

### Fixes
- **Charging efficiency on free profiles**: the field is now always shown. It still drives the estimated energy of free charges, which used a hidden 90% before.
- **Back from the background on a phone**: when you return to the dashboard after some time away, the card and the Companion pages check the connection to Home Assistant, reconnect if it was lost and reload their data on their own, so you no longer need to refresh the page by hand.
- **Saving readings**: a temporary database error is retried a few times before a reading is given up, and a slow database can no longer make the waiting list grow without limit.
- **Sensors**: a sensor that was reporting a value and then becomes unavailable (for example after a restart, until the car wakes up) keeps its last good value; other states are used as they are.
- **Importing charges**: sessions longer than 7 days, implausible energy for the session length, and out-of-order curve readings are rejected.
- **False DC charge after AC charging**: some cars report a DC current (for example 400 A) for a few minutes when an AC charge ends. That reading is now ignored, so the charge stays AC, the charging curve keeps its real shape and the session does not run longer. A DC charge that really starts is still recorded.
- **Interrupted saves**: if Home Assistant stops while the charging archive is still writing, the next start records a warning and keeps the last complete checkpoint.
- **Sensors after entity changes**: renaming or recreating a Companion sensor or the battery entity refreshes only the affected sensors, once.
- **Failed setup**: if setup fails, the integration is fully released, so it can be loaded again without restarting Home Assistant.
- **Large exports**: an export above 25 MB is refused with a message to use Database backup, which saves a complete file.
- **Tariff values**: values that are not finite numbers are rejected instead of being used in price calculations.

## 0.1.5 — Live notification fixes and translations

### Fixes
- **Left open or unlocked** (live notification) no longer appears while the car is switched on or driving. New switch **Only when the car is off**, on by default.
- The **Charging curve** no longer stops at the last current change: the line continues to the current time and battery level, without extra dots. New Advanced setting **Refresh the charging curve every (min)** (default 5) for when the car reports nothing new.
- Live notifications now appear in **Recent activity**: one entry when they start and one when they end.
- Live notifications colour the text with the same card palette colour as the icon and progress bar, also when the timer is off.
- A lost connection (for example after the app returns from the background) now shows a readable message instead of `[object Object]`.
- Companion dashboard, **Card design**: the “Maximum width (px)” label and its hint no longer overlap the field on phones.
- Car View, charging text **At the port**: the guide dot now sits on the port pulse.
- The Energy sheet no longer raises an error in the read-only preview when the charging archive cannot be read.
- An alert whose phones are all held back by their own condition (for example “only when I am away”) now waits and is sent as soon as one phone qualifies. Before, it counted as sent and never arrived.
- **Live charging** ends on the phone when the car stays unreachable longer than the reading age limit, instead of staying there.
- A charge is no longer split in two when the car loses its connection for a while. A charge whose car never reports again is closed after 6 hours at its last known reading.
- Vehicle type **Automatic**: a plug-in hybrid is no longer counted as electric when a charge starts before its fuel sensor has loaded.
- The charging curve stays on the card through a single zero reading in the middle of a charge.
- Costs dashboard: the energy total is now labelled **Energy from charger**. It includes charging losses, so it is higher than the *Energy added to battery* sensor.
- A request with a missing value now answers “Missing value: …” instead of only the field name.
- Greek and Spanish now cover the Companion dashboard, the notification pages, live notifications, Recent activity, the costs dashboard and the charging curve, and fill the gaps in Card Settings that showed mixed-language text.
- Translations no longer change file names, folders and other identifiers shown as hints (for example the photo file names in Card Settings).
- The card shows a readable message when its settings cannot be loaded after a lost connection.

## 0.1.4 — New charging notifications and safer saving

### Notifications
- New alerts: **Charging started**, **Charging almost finished** (time left at or below a limit, default 15 min) and **Charging reached target** (default 80%).
- Saving from two tabs or devices now merges both sets of changes; only the same field changed two ways is rejected.
- Alerts that are switched off or removed clear themselves from the phone.
- Alerts held by quiet hours are sent when quiet hours end instead of being lost.
- Recipient conditions now see the same values as the alert itself.
- **Why isn’t it sending?** on an alert explains step by step why it is or is not being sent right now (switches, condition, delay, send limit, repeat, quiet hours, devices). It only reads; nothing is sent.

### Setup and settings
- Setup keeps the vehicle type you confirmed. A default "Automatic" saved by an older version no longer hides it; only a type you pick in Settings is kept, including Automatic.
- Plug-in hybrids found during setup start with the 18-inch wheels; existing wheel choices are unchanged.
- Export / Reset (YAML) removed from the card settings; settings stay in Home Assistant.
- Number settings (battery capacity, reminder, battery jump, tank) show the label and the value side by side; the long explanation opens under a “?”.
- New Advanced settings: minimum battery gain for the charging-profile reminder (default 3%), how many recent charges it checks (default 10) and the ignored one-off battery jump (default 20%).

### Health
- New **Health** tab in the Companion dashboard: a read-only list of checks for the vehicle sensors, the charging recorder, the database, notification devices, the last notification and charging prices. Each problem says what is wrong and how to fix it. It never changes settings or sends anything.

### Charging
- The profile reminder lists every unanswered recent charge, oldest first; dismissing applies to one charge and one user.
- One odd high battery reading is ignored until the next reading confirms it.

### Fixes after review
- Settings saves from the card, the Companion panel and the card editor now always send the settings revision they were editing. Home Assistant refuses a save without one. If another editor saved first, the stale copy is dropped, the latest settings are loaded and a message asks you to repeat the change.
- Every `.js` in the frontend now has a matching `.gz`, rebuilt on each build; the build stops if one differs and removes `.gz` files left without their `.js`. (Home Assistant serves the `.gz` when it exists, so an out-of-date one would load old code.)
- **Charging costs** is now its own setting (`charging_cost`): when off, the cost block disappears from the card; saved prices, receipts and the Costs dashboard are kept.
- Charges waiting for a profile are kept in their own saved queue, so new charges can no longer push an unanswered one out of view. “Recent charges checked for the reminder” now sets how many reminders wait in line; the rest stay queued. Assigning a profile removes the charge from the queue; dismissing still applies per user and per charge.
- No unanswered charge is dropped any more: the waiting queue no longer stops at 100, and a dismissal is kept while its charge is still queued, so an old dismissed charge cannot reappear.

### Live notifications
- Three Lock Screen notifications now have their own box in the Notifications page: **Live charging**, **Live climate** and **Left open or unlocked**. Each opens its own page with its own settings, so you only see the options that belong to it.
- Each page has a switch, the matching options (show target or outside temperature, which doors, windows, bonnet or trunk to list, how long to wait before showing), a title, an icon, a test button and a stop button. The page is built from the same rows and switches as the other alerts, so it looks and works the same way.
- The title now shows only the useful information (for example "72% · 1 h 20 min left") instead of the notification name, which was cut off on the Lock Screen.
- Icons accept Material Design icons (`mdi:`) only, because the phone app cannot show other icon sets. The list offers the most useful ones and shows the one in use.
- Colours follow the card palette, on the progress bar, the timer and the icon. Doors, windows and the unlocked car show in red.
- "Turn off" and "Lock vehicle" buttons are marked **Android only**, because iPhone Live Activities cannot show action buttons.
- **When you tap a notification** now sits with the old-data protection settings and opens the dashboard page you pick.
- The Live tag is yellow when on and grey when off. The Recommended preset is highlighted in green when it is the one in use.

### Card
- The Settings popup is removed from the card. Settings need administrator rights, so the Settings button now opens the Companion dashboard, where notifications, charging profiles and sessions are managed in one place. The card becomes lighter and non-administrators no longer see a settings screen they cannot use.
- The Settings link is now a small round gear on the image, at the bottom right opposite the lock status. The bottom row is gone, so the card is shorter. The gear is shown to Home Assistant administrators only. Its on/off switch moved to **Card Settings → Layout → On the image**, next to the other things shown on the image.
- The notification button in the top pill now opens a popup with your recent notifications, in the same design as the Notifications page (Load more, delete one or delete all). It no longer leaves the dashboard. Only administrators can see the list.
- The age of the vehicle data now sits on the refresh button as a small tinted badge (now, 1m, 3m, 1h ...), replacing the "Updated ..." line at the bottom. It turns yellow after 2 hours and red after 4 hours, so old data is easy to spot without taking space.
- The block of warning icons at the bottom of the card is gone, together with the "Always all" option. It took a lot of space and, with everything shown, mostly displayed grey icons that needed no attention. Warnings now show as a small red number on the Diagnostics button at the top, and tapping that button opens the full list of indicators. If you hide the Diagnostics button, the warnings that are active still appear as icons in the image corner. Diagnostics is no longer in the list of card sections, because the button replaces it; show or hide the button under Top-right buttons. Your saved choices of which indicators to watch are kept.
- Drag-and-drop sorting of sections, buttons and info items can now move an item to the very first or very last place, and swap the first two or last two items. Before, the dragged row could not be dropped over the first or last row.
- **Lock status** is more honest. The car's cloud is read about every 5 minutes, and an unlock lasts only seconds, so the card cannot always see it.
  - While the engine or power is on, the card shows **In use** instead of a lock state, because the car may lock itself while driving.
  - If the car was driven since the last lock change (engine turned off, or the odometer changed), it shows **Locked after 21:14** instead of an exact time it cannot know.
  - The lock and engine times come from the recorded history, so reloading the integration or restarting Home Assistant no longer resets "Locked at ..." to the restart time.

- The Companion dashboard tab bar now has five tabs and stays on one row; on narrow screens it scrolls sideways or shows only the open tab’s name.
- Edits in the cost and notification forms are saved before you switch tab or profile, so nothing is lost.
- If the card cannot load, it shows a short message with a **Try again** button instead of a technical error.
- The preview note now always matches the state: the coloured box appears only for simulated states, and with **Allow clicks** on it says that clicks change only the simulation. Live controls still show a warning that actions affect your vehicle.

### Updating to 0.1.4
- Restart Home Assistant after updating (backend files changed), then hard-refresh the browser (Ctrl+F5) so the new card and panel load.
- A save from an older, cached card is refused with “Settings revision missing. Reload before saving.” until the page is refreshed.

### Reliability
- Settings saves detect changes made elsewhere and ask you to reload.
- Cost saves are checked before they are written.
- Access checks cover every sensor the vehicle uses, skipping ones that do not exist.
- The archive worker can no longer block unload or shutdown; unexpected errors are logged with a fixed message.
- Cost summaries are recalculated only when something changed (at most every 15 minutes for late readings).
- Greek and Spanish texts updated.

## 0.1.3 — Independent card blocks and saved preferences

- Control Charging costs and Charging reminder independently in Layout → Sections.
- Show preview guidance in a coloured information box.
- Keep selected notification button labels readable and open mobile alert settings at the top.
- Keep the notification header stationary when the Unsaved changes pill appears or clears.
- Restore the selected card profile when reopening the dashboard.
- Save complete notification preferences and recover omitted values from older saved rules.
- Preserve saved profiles, locations, receipts and notification settings during database upgrades.

## 0.1.2 — Charging profiles and reminder preview

- Delete charging profiles with a confirmation and preservation notice; earlier charging sessions and saved costs stay intact.
- Keep deleted presets removed after reload, including an empty profile list.
- Mark charges using a removed profile with an icon to assign another profile; saved costs stay unchanged until edited.
- Automatically select Manual charge when entering a total payment.
- Suggest charging-network names as you type, with custom names supported.
- Test charging-detected reminders in the card preview without changing real charging data.

## 0.1.1 — Setup and first-load fixes

- A clear setup screen with step-by-step instructions and a setup link when no vehicle is available.
- Vehicle menus, profile controls and previews stay hidden until vehicle setup succeeds.
- The dashboard recovers when the vehicle becomes available, without requiring a page refresh.
- Car View image layers retry temporary loading failures automatically.
- Frontend resource URLs follow the installed version so updates load the matching files.

## 0.1.0 — First release

### Release highlights

- **Live charging notifications:** iPhone Live Activities and Android Live Updates bring charging progress and optional remaining time to the Lock Screen. Updates follow the car’s reported readings and work with the dashboard closed.
- **Saved charging curves:** review current over time, changed readings, Low/High current and battery percentages when available. Captured curves stay with each session in Companion’s charging archive.
- **Charging expenses:** use location tariffs, free charging, charger readings or battery estimates; enter receipt energy and total payments; and review costs with session filters, sorting and historical charts.

### Dashboard and card

- Bundled vehicle card and Companion dashboard in one Home Assistant integration.
- Mobile, Tablet and Energy designs with independent display profiles.
- Live Car View, vehicle controls, climate, seats, tyres and diagnostics.
- Card layouts, colours, images, button settings and custom sensor tiles.
- Sortable information tiles and custom diagnostic entities.
- Tile icon colour presets and a custom colour picker.
- Shared settings, interactive previews and Add to dashboard.

### Charging and history

- Permanent charging archive with saved prices and current curves.
- Charging locations, free charging, charger sensors and manual receipt corrections.
- Weekly/monthly history, energy and cost charts, and daily estimated consumption.
- Grid/table session views, database filters and sorting, and six-session pagination.
- Three-column charging cards on wide screens with responsive tablet/mobile layouts.
- Import of available Recorder sessions/readings, JSON export and database backup including captured curves.
- Automatic lossless compression of older sensor readings, bounded background maintenance and archive storage diagnostics.
- Individual receipt updates with conflict checks for simultaneous edits.

### Notifications

- Background vehicle alerts with Mobile App recipients, presets and quiet hours.
- Custom timing, thresholds, severity, icons, messages and supported action buttons.
- Alert previews, test notifications and manageable recent activity.
- Charging Live Activities for iPhone and Live Updates for supported Android devices.

### Guides

- Marketplace, HACS and manual installation instructions.
- Step-by-step user guide, complete menu reference, notification guide and troubleshooting.

### Licence

- GPLv3 for Companion code, with DEC Deepal image credits and retained third-party asset licences.
