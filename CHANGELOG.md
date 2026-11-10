# Changelog

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
