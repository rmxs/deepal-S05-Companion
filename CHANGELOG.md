# Changelog

## 2.0.1-b1 — Beta

First beta of 2.0.1. The Charger limit has not yet been tried on every kind of charger; start with Dry run.

### New
- **Charger limit:** stops charging at your charging target by switching off your own charger. Mode is Off, Dry run (shows what it would do, never touches the charger) or Live.
  - Set it on the Charging page with **Stop charging at**. A ring shows the target; the slider (50–95%) and the presets Off, 70%, 80% and 90% sit on the left. The charger, stop control, power sensor and energy sensor are on the right, and each chosen sensor shows its current value beside its name. A limit of 100% does nothing, and the block says so: use 95% or less. The target is the same for every display profile of the car.
  - Choose your charger and the stop control, power sensor and energy sensor are filled in from it. The energy sensor prefers a "this charge" counter and never picks a lifetime total. You can change any of them, and pick any other lock or switch, from any device, except the car's own door lock. Changing the charger resets only the stop control and its direction; power and energy sensors you chose from other devices are kept. kW, MW, Wh and MWh are converted automatically, and sensors with no unit are not read as W or kWh. Choosing the car itself as the charger is refused, and a stop direction guessed from the names is flagged so you can check it.
  - **Charger type:** a new dropdown above the stop control. **Auto (switch or lock)** is the way it always worked, so saved setups do not change. **Feyree (Tuya Local)** is for a wallbox that takes commands instead of a switch: Companion picks its "Toggle charging" dropdown (or its Start and Stop buttons), its power sensor and its status sensor by itself, and shows one line such as `Stops with "Stop charging" · restarts with "Start charging"`. Only when it cannot tell which command is which, two small pickers appear in the same place. The stop is confirmed by the power and the status sensors, never by the dropdown itself (it goes back to "Waiting for command"). Without a power sensor the status alone confirms it, and Health says so. Start is only sent to put the charger back (target raised, Charge anyway, unplugged); if the car is full or unplugged and Start does nothing, it counts as released. "Choose another..." now also lists dropdowns and buttons that are a stop or start command. A "Session energy" counter is no longer taken for a lifetime total.
  - It waits about 45 seconds at the target before stopping, then checks that the stop worked and tries up to 3 times. The stop is saved before it is sent, so a Home Assistant restart cannot lose track of it.
  - If you restart the charger by hand, the limit pauses until the next plug-in. **Charge anyway** does the same.
  - Raising or removing the target, leaving Live mode or unplugging the car releases the charger, so an earlier stop should not hold the next charge.
  - If the charger cannot be put back to charging, for example because it is offline, Companion keeps trying, Health shows a warning and your phone is told once. Messages go to the phones of your enabled alerts (see Notifications).
  - The card row and the info tile show the power while waiting and the energy once stopped, for example `Stopped at 80% · 12.4 kWh`. Health has a Charger limit check that warns when the plug sensor has not answered for 10 minutes, when the energy sensor looks like a lifetime total, when the car's last report is too old for the limit to act, and when the target is 100%.
  - The settings preview has demo states for it. Translated in all languages.
  - **Alerts and the limit work together:** while the limit has the charger stopped on purpose, **Charging complete**, **Charging interrupted** and **Plugged in, but not charging** stay quiet, so you get one message, not three. They work as before when the limit is off, in Dry run, or when it has no phone to tell. Saved alerts pick this up without saving again.
  - **Charging reached target** now follows **Stop charging at**. Change the target and the alert changes with it, with no need to save the alerts again. The Notifications page shows "Follows Stop charging at (80 %)". The alert's own number is used only when the target is Off or 100 %, and it is kept.
  - While the limit is about to stop or has stopped the charge, its own message is the one you get ("Charging reached target · 80%"), so **Charging reached target** is not sent twice.
  - The limit's calm messages (stopped, would stop, released, paused) follow the quiet hours of the first enabled alert that has them: inside them they arrive silently. A failure to stop or to release stays loud.
- **Seat and steering wheel comfort on the Temperature tile:** small chips appear at the bottom left while a seat heater, seat ventilation or the steering wheel heater is on. Tap them to open the Seats pop-up.
- **Tyres page redrawn:** the Tyres view shows the car from above, with one value box beside each wheel. A tyre flagged by the car or outside your limits turns red with the reason.
- **Recommended setup for notifications:** a new install shows a card above the master switch that turns on the key alerts (charging complete, car left unlocked and critical warnings) and sends them to your phone.
- **Range window:** tap the big range number on the card to see your real range on a full battery, based on your own driving. It also shows Efficiency, consumption per 1% and per 100 km, and charts for 7 days, 30 days or 12 months.
- **Car side:** Appearance → Car View lets the 3/4 car picture face the driver side, the passenger side or Auto.
- **Black car colour:** new jet-black car images for every door, hood and tailgate state.
- **Car logs in pages:** the newest 30 entries load first, and **Show older** loads the next 30. The counts on the tiles are the true totals for the selected range.
- **Status tile:** Status (on the image) is its own tile in Layout → Sections, right after Vehicle image.

### Changed
- **Live climate waits while you drive:** Live climate is blocked while the car is moving, like Left open or unlocked. Its new switch **Only when the car is parked** (on by default, also for saved settings without it) and **Count as parked after** sit on the Live climate page; switch it off to show the climate while driving.
- **Charging page:** the page **Charging Profiles** is now **Charging**. The Charger limit block sits under the profiles and holds **Stop charging at**. It moved from Card Settings → Charging and is the same saved setting.
- **Car colour and Wheels moved:** they are now in Card Settings → Vehicle, no longer in Appearance.
- **Energy tile settings:** the Energy tile switches are in Card Settings → Charging.
- **Card Settings tabs:** the tabs are Layout, Appearance, Controls, Charging, Vehicle and Advanced. Advanced holds the less-used settings, such as Entity mapping, Card page, Data update rate and the colour settings. Diagnostics and Tyres moved to Vehicle.
- **Message under Locked / Unlocked:** moved to Appearance → Messages.
- **My diagnostics removed:** the custom diagnostic sensor list is gone. The built-in indicators stay.
- **Tile icon colour removed:** the "Icon colour of the bottom tiles" setting is gone. Those icons now follow your theme colour, and any saved value is ignored.
- **Theme colour on charging values:** the Charged total, the kWh in Last charge and the kWh column in the energy day list follow your theme colour. Status colours are unchanged.
- **Smaller card corners:** the card and its tiles have less rounded corners, so they no longer cut into the buttons and the power knob.
- **Energy tile style:** the Ring and Half gauge choices show the real Energy tile.
- **Climate pop-up:** the seat buttons are replaced by one preconditioning line. Pick Cool, Comfort or Hot, then a time, then Start. While it runs, the line shows a countdown and Stop. If climate is already on, it shows Running.
- **Preconditioning page is information only:** it has no Start or Stop button and no temperature controls. It shows the status and summary. Starting, stopping and the temperature stay on the card. A failed or unconfirmed start or stop appears on Health.
- **Preconditioning notifications:** the page no longer repeats the notification settings. A row there opens the Notifications page.
- **Preconditioning info:** the info area is one simpler row, with the status shown in the top pill.
- **Charge plan:** Save plan looks off until something changes, and the car's time zone shows under it.
- **Settings sections:** every section starts closed. Tap a section's title to open or close it; your choice is remembered in this browser.
- **Pop-up windows:** the background blurs smoothly as they open, follows your finger when dragged down, and closes when you tap outside them.
- **Car look shared:** picture style, sky, side view and photos now apply to the car in every display profile, like colour and wheels.
- **Car logs:** passing checks on Health fold into one "N checks passed" dropdown. The category tiles count every event of the selected range. Opened parts in the timeline are amber and closed parts are blue.
- **Entity mapping:** the key list shows only entities that still need mapping.
- **Phone menu:** on a phone the Companion tabs show only icons, with the title on the open tab.
- **Car lights:** the position lamp is tinted, dim when off and bright when on. Turn signals and hazards show amber on the lamp line.
- **Charging sessions title:** it sits above the card with the other page headings.
- **Faster saves:** saving a card setting is quicker.
- **Charge plan and notifications titles:** Preconditioning and Charging no longer repeat their title under the page heading, and the notification on/off card is titled "Master switch".
- **Error messages:** messages from Home Assistant and the Companion backend, such as a rejected setting or an invalid price, now show in your language in the card and the panel. English is used when no translation exists.
- **German text:** uses the formal "Sie" form throughout.

### Fixed
- **Other languages:** Preconditioning and Live status now find the car's climate entities when Home Assistant uses another language. Charging, alerts, Live charging and the Charger limit use the same lookup: your own entity choices first, then the usual names, then the car's entities by their fixed internal key. Setups whose names already match see no change.
- **Dashboard memory:** a closed dashboard page is freed right away; before, a waiting 12-second timer kept it in memory.
- **Keyboard:** the big range number and the Charger limit tile can be opened with Tab and Enter.
- **Health dot colour:** the Health tab's red dot uses the theme's red.
- **iPhone Live climate end:** the end command now carries the Live Activity flag, so iOS ends the lock-screen status silently instead of showing the text "end_live_activity" as an alert.
- **Charging location popup:** the close X shows again. Its icon had no stroke in the panel, so the button looked empty.
- **Sliding selection:** the choices on Notifications, Charging, Preconditioning, the charging curve and Car logs now glide to the new option, like Settings.
- **Live updates:** a parked car that has not sent data for hours no longer shows an orange "Last update" warning while its cloud connection is on.
- **Statistics window:** Today, This week and This month for the Odometer now include the km driven since Home Assistant last saved its statistics.
- **Statistics window:** the 30-day figures are the same on every tab. The 7-day tab used to count only the days since the start of the month.
- **Tyres tab:** it could stay empty after the card rebuilt itself, for example after a settings change, until the page was reloaded.
- **Car View:** the rear-right window now opens at the back, and the sky and city backgrounds keep their size at every card height.
- **Car View sky:** the hills and curves in the day and night skies fade out softly instead of ending in a hard edge.
- **Turn signals:** every signal now gives four full blinks, even if the sensor switches off within a second.
- **Car logs:** a window that drops or rises only because its own door opened or closed is no longer listed.
- **Pop-up windows:** they have a solid background, so the picture behind the card no longer shows through the text.
- **Health:** charge plan details no longer run off the right edge on a phone.
- **Live alerts on iPhone:** closing a live alert no longer shows a stray extra notification.
- **Connection lost:** the panel retries on its own and reloads when the connection stays dead after the phone wakes, unless there are unsaved changes.
- **Saved settings:** an older settings store that cannot be read at start-up no longer overwrites your saved settings with defaults. It tries again at the next start.
- **Live preview:** the charging cost bar shows the real charging location chosen for the charge, instead of asking again.
- **German times:** no longer show a double full stop, such as "15 Min..".
- **Italian and Spanish text:** Per 100 km, Car View, Live, Dashboard, Layout and Mobile no longer stay in English. Italian now says Ogni 100 km, In diretta, Cruscotto, Disposizione and Cellulare; Spanish says Vista del coche.
- **Preconditioning diagnostics:** Last failure is a full-width tile at the bottom of the grid, and its long message wraps in normal words instead of breaking one word per line.

## 2.0.0 — Charge plan, Car logs, statistics, theme colour and notification colours

> **Before you update:** upgrade [Deepal Alternative to v1.9.0](https://github.com/Sunek0/ha-deepal-alternative/releases/tag/v1.9.0) first. Some card functions, such as the Charge plan, need it.

A big update: a Charge plan, Car logs, a statistics window for your sensors, one new look on every page, and live notifications that follow your card colours. After updating, restart Home Assistant and refresh the dashboard (Ctrl+F5).

### New
- **Charge plan:** set the car's charging schedule from a clock button on the Energy tile, or add a Charge plan tile to the Information row. The **Until full** pill next to the end time removes the cut-off ("Until battery full"). Needs the schedule entities from Deepal Alternative.
- **Charge plan health check:** the Health tab shows whether the plan is on, its times, the plans the car reports and the last 7 days of plan activity, and warns when the switch and the car disagree. It updates by itself.
- **Car logs:** a new page that lists what happened to the car in plain language, newest first, grouped by day: Security (locks, doors, windows, "Left unlocked"), Charging (cable and every charge) and Others (warnings, key fob battery, tyre alarms, preconditioning). Tap a tile to filter. Nothing is sent to the car.
- **Statistics window:** tap Odometer, Fuel, Inside, Humidity or another number tile for a chart (7 days, 30 days, 12 months) and compact figures: distance today, this week and this month; fuel used and the last refuel; average, lowest and highest temperature. Sensors without long-term statistics show up to 30 days of history.
- **Notification colours:** in the Colours tab choose Red, Orange, Yellow or Green for each live notification state (left open or unlocked, closed and locked, climate, charging). The colour comes from your level colours.
- **Theme colour:** pick the card's main colour from nine colours in Card Settings → Appearance. It follows through the card, Energy sheet, Notifications, Costs and Preconditioning.
- **Neon city background:** a palm-lined coastal city for Car View that changes between day, afternoon and night, with a matching neon glow and a real shadow under the car that falls the same way as the palm shadows on the road.
- **Data update rate:** Live, 5 min or 10 min (Card Settings → Advanced) for saved readings and live notification refreshes.
- **Waiting effect:** while a command waits for the car the button shows Sending…, Car waking up or Confirming…; pick Spinning arc, Soft pulse or Neon ring in Card Settings → Controls.

### Improvements
- **One look everywhere:** buttons, switches, tiles, chips and fields share the same shapes, sizes and colours on the card and every Companion page, with press feedback and spring motion (off with reduced motion). Popups on the card are drawers you can drag closed.
- **Card Settings:** options moved to the menu they belong to (nothing is reset), choices are tiles, colour dots and pictures, reorder lists use two columns, and all controls have one height.
- **Live notifications:** redesigned pages with tiles, steppers, icon presets and a "Try it on your phone" bar; phones are picked from a tile grid.
- **Preconditioning:** a redesigned page with state, setup summary and Start/Stop; times follow your Home Assistant clock and time zone.
- **Connection recovery:** if Home Assistant does not reconnect about 10 seconds after you return to the app, the card reloads itself. It never does this with unsaved changes, and at most once a minute.
- **Texts:** about 120 descriptions were rewritten shorter and clearer, and everything is translated in English, Greek, German, Spanish and Italian.
- **Colours:** status colours come from one shared definition, separate from the theme colour; Costs and Preconditioning use the same interface colours as the other pages.

### Fixes
- **Live notifications:** "Left open or unlocked" now ends on iPhone after you lock the car (the end is sent again if iOS misses it) and also when the car has not reported its odometer for a while; it is red when open or unlocked instead of green; the wait time you set (even 0) is kept after a restart.
- **Charge plan:** the window opens only when the car has the plan entities, needs at least 30 minutes between start and end, and has equal-size Start and End fields on a phone, and explains when a plan set in the Deepal app or on the car (S05 PHEV) cannot be changed from here. The health check follows the plan the car actually uses and no longer shows false warnings. The clock button sits beside the Energy tile and works with the keyboard.
- **Statistics:** Last refuel shows the real amount (it was smeared by daily averages), and all figure tiles have the same height.
- **Menus and layout:** the phone menu fits all pages from 320 px up and keeps its place; Companion pages are at most 1200 px wide; Card Settings keep their scroll position; the Health dot is amber for warnings and red only for problems.
- **Card:** no false drop to 0 % in the battery chart; the Energy tile can no longer go blank; waiting buttons are no longer cut off; the page loader and Charging Profiles icons are visible; Enter and Space open the tiles; repeated redraws no longer pile up touch handlers.
- **Companion panel:** unsaved edits are kept when the profile list refreshes in the background, and deleting a profile asks in the same themed window as the rest of the app.
- **Translations:** the green "Active" chip reads Activo / Ενεργό in Spanish and Greek.

## 1.0.0 — Remote preconditioning, complete translations, button layouts and a fuller gallery

### Updating
- Restart Home Assistant after updating (backend files changed), then hard-refresh the browser (Ctrl+F5); in the Companion app, reset the frontend cache if the old text stays.
- Saved profiles, session prices, receipts, settings and notification choices are preserved.
- Preconditioning is new and starts switched off: no schedule runs until you turn on **Scheduled preconditioning**, and no preconditioning notification is sent until you turn on its switch and choose a phone.
- The **Sessions** header totals (energy, cost, priced and unpriced sessions) now follow the chosen period. With no period selected they cover the **last 31 days**; choose a period to see other ranges.
- **One row with scroll** and **One row (everything fits)** are removed. Profiles that used them now show **Main buttons + “More”**. Choose another layout in Card Settings → Controls → Button style if you prefer.

### New features
- **Remote climate preconditioning:** start or stop the cabin climate from a new **Preconditioning** button on the card (a quick panel with temperature and duration bars and a link to the full page) or from **Companion → Preconditioning**. The button is coloured while Companion’s own session runs and shows a pulsing dot when a schedule is set.
- **Preconditioning schedules:** once, daily, Mon–Fri or custom days, either **Start at** a time or **Ready by** a time (the climate starts earlier by the preparation time). Schedules follow the Home Assistant time zone, daylight-saving changes and midnight crossings, can be paused one by one, and never replay an old start after a restart. A schedule more than five minutes late is recorded as missed. Scheduling is off by default.
- **Checked commands:** the car’s data is refreshed before every start and stop and once more afterwards. A command counts as done only when the car’s fresh report confirms it, with up to three attempts (**Advanced: retries and checks** sets attempts, the wait between them and the wait for an answer). If the climate is already on, nothing is changed.
- **Plain explanations:** failures say why in simple words, for example when the car is switched on or being driven (Deepal code 1036), when the sign-in has expired, when too many commands were sent or when the car did not answer. When someone drives the car, the climate is handed over to the driver and no more commands are sent.
- **Battery protection:** choose your own minimum battery level (10–50 %, in 5 % steps), block a start at or below it, stop a running session when the battery drops to it, and choose whether it also applies while charging. The battery reading is refreshed before every start, so a car that was asleep is not blocked by an old reading.
- **Preconditioning notifications:** one switch, one set of events and one phone list, the same on the vehicle card, **Preconditioning → Notifications** and **Notifications → Preconditioning**. The phones are shared with **Live climate**. A message with a **Stop** button appears while the climate runs, and **Send test notification** checks your phone.
- **Notification language:** one setting at the top of the Notifications page sets the language of every notification Companion sends (preconditioning, alerts, charging and live updates). Automatic follows the Home Assistant language; you can also choose English, Greek, German, Spanish or Italian.
- **Your setup in short:** a plain-language summary at the top of the Preconditioning page explains the current choices, including schedules, retries, battery protection and notifications.
- **Activity and diagnostics:** every preconditioning action appears under **Notifications → Recent activity** and in the Home Assistant log, and a diagnostics box shows the current operation, last confirmed state, last successful start and stop, last failure and history.
- **Preconditioning session history:** a **Clear history** button (administrators, with confirmation), automatic removal of entries older than 30 days, and a scrolling box when the list is long.
- **Button layout “Main buttons + “More” on the image”:** the main row stays as before. A small button next to the Settings gear (inside the car image) shows how many buttons are hidden. Tapping it opens the rest in a panel directly under the image. When the main row has a free slot, the “More” button sits in that slot instead.
- **Button layout “All buttons in “More” on the image”:** no button row under the image. Every control opens from the button on the image, five per row.
- **Button layout “Swipe pages”:** swipe the control buttons left and right. Dots under the labels show the page; tap a dot to jump to it. The page you were on stays put when the card refreshes.
- **Rows of fewer than five buttons are centred** in the More panel and on swipe pages, with the same spacing as full rows.
- **Live charging cost:** while the car charges, the cost of this charge is shown as a chip in the charging block (≈ while it is an estimate, **Free** for a free location, **Not priced** until a location is chosen). Choose or change the charging location right from the card; the amount updates at once and a typed receipt is never changed. With the curve on, the location selector is a slim bar with icon-only buttons at the foot of the (now shorter) curve. With the curve off, a small selector appears during the charge and fades away once you save; **Card Settings → Charging → Cost selector while charging (curve off)** turns it off, and tapping the cost chip opens it again. Preview mode shows demo values only.
- **Redesigned charging block:** a header with the charging state, charging type and cost, and a row of figures below (current, remaining time, target). The target also rolls into the Energy tile text.
- **Status stays with the vehicle image:** in Layout settings, Status is a line of the Vehicle image row (with its own on/off switch, no arrows), because status is always drawn on the image.
- **Charging target:** set a goal under the charging settings, **Charging target (%)** (50–100 % in 5 % steps; 0 = off). The card shows the goal and an estimated time in the charging block, marks the goal on the battery ring, and rolls the target into the Energy tile text. At 100 % it shows **Full at** the estimated time. To get a phone alert when the target is reached, use the charging notification together with this setting. This is advisory only: Companion cannot stop charging, and the estimated time is approximate because charging slows near the top.

### Improvements
- **New preconditioning popup on the card:** a compact layout with a live strip (status, cabin, target and battery), temperature slider, Cool, Comfort and Warm quick choices, 5, 10 and 15 minute buttons, a countdown with Stop while it runs, and rows for schedules and phone notifications.
- **Faster, steadier confirmation:** after sending Start or Stop, Companion now asks the vehicle for a fresh report a few seconds later and again while waiting, accepts a report from the same second as the command, and refreshes before any retry so a command that already worked is not sent twice.
- **Stop reasons in plain words:** the stop message and the session history say "Planned duration reached", "Stopped by battery protection", "Stopped by you" and so on instead of a short code, in your language.
- **Confirmations are popups:** deleting a schedule and clearing the session history now ask in a centred popup instead of an inline row.
- **Faster panel reads:** vehicle list, settings and summary requests no longer wait behind saves or archive maintenance.
- **Lighter session export:** exporting a long charging archive reads the data in one pass instead of opening many database connections.
- **Long charging history:** very long history requests return a reduced number of points, so large periods load with less work for Home Assistant.
- **No file read in the main loop:** the notification texts for every language are loaded at startup, which removes a Home Assistant slow-code warning.
- **Easier taps:** navigation tabs, session footer buttons and profile action buttons are 44 px tall.
- **Readable text:** small text in the panel is at least 11 px.
- **Consistent success colour:** the success green in the Sessions and cost areas follows your chosen level colour.
- **Energy tile:** the range figures (km) use the card’s standard text sizes, with bold numbers and smaller units. The energy rings are slightly thicker.

- **Master switch greys out what depends on it:** on the Notifications page, turning the main **Notifications** switch off greys out and locks the devices, quiet hours, live notifications, alerts and the Preconditioning box until you turn it on again. Recent activity stays usable.
- **Preconditioning notifications follow the switches:** when **Preconditioning notifications** is off, the phones, event switches and test button below it are greyed out. When the global Notifications switch is off, the whole section is greyed out with a short message that global notifications are off.
- **One switch style:** the Preconditioning switches now use the same size and blue colour as the card's switches.
- **Charging target mark:** the goal on the battery ring is now a short green line sticking out of the ring instead of a dot.

### Bug fixes
- The refresh button on the card and the health chip now keep their green, amber and red tints, and the notification colours match between the card and Settings.
- Choosing a warm or cool temperature in the preconditioning popup now colours only the temperature number; Start and the active indicator keep their normal colours.
- The Sessions, Notifications and live-climate screens keep their colours when shown outside the area that defines the colour palette (every colour now has a default).
- A rejected authorization is no longer reported as an expired Deepal sign-in; only a real expired sign-in stops retrying.
- Fonts in Settings and the notification page now come from one place, and the blue, red, green and amber accents in Settings and the Energy panel (duplicate and delete profile buttons, the selected navigation tab, info boxes, period buttons and the Save button and unsaved-changes note in local notification settings) now follow your colour palette.
- **Preconditioning is limited to people allowed to control the car:** Start and Stop need control permission on the climate entity, and the buttons are disabled for non-administrators in the card.
- **Preconditioning stays reliable on unload and odd stored data:** background recovery and refresh stop with the integration, a stored session without an end time no longer breaks the status page, and phone delivery results are attached to the right activity entry.
- **Current frontend after updates:** the browser loads the new panel and card scripts after an update, instead of older cached versions.
- **Translated delete and restore dialog:** the deleted-charges dialog and the notification “old data” setting follow your chosen language.
- **Notifications page:** the Preconditioning box sits above Old data protection and uses the same width, padding and margin as the other boxes. On phones the side margins now match the other pages.
- **Narrow phones:** the five main control buttons keep at least 10 px between them and no longer touch at 360 px wide.
- **Popups from the More panel:** a button that opens a popup (for example Dashboard or Tyres) closes the panel behind it, and one tap on the popup’s X is enough.
- **Read-only info tiles:** a tap action set to Toggle on a sensor or binary sensor opens its details, instead of asking for confirmation and then failing. Switches and lights still toggle.
- **Climate “Turn off” on the Live climate notification** now uses the vehicle’s own off command, so the button works.
- **Correct auto-off time:** the start notification shows the planned stop time (for example 5 minutes), not the Ready-by time.
- **Charging cost shows “Free charging”** instead of €0.00 when every priced session is free. Days with only free sessions show “Free” in the Energy history table.
- **Diagnostics headline:** when sensors are unavailable but none are faulty, the headline shows the number of unavailable sensors instead of “All OK”.
- **Curve edits keep your costs:** removing a noisy part of a charging curve no longer changes the saved cost or deletes the meter readings behind it. The curve view still hides the removed part.
- **Imported charging curves use the right unit:** curves restored from the recorder keep the unit your car sensor reports, so power- and energy-priced sessions are costed correctly instead of falling back to the battery estimate.
- **Cost sensor currency:** the cost sensor uses the currency set in Home Assistant instead of always showing EUR.
- **Clear message for unsupported Home Assistant versions:** if Home Assistant changes the Mobile App internals this integration uses, notifications show a clear message asking you to update Deepal Companion.
- **Setup survives a language store failure:** if the saved notification language cannot be read, the integration still loads and follows the Home Assistant language.
- **Saved settings are not reported as failed:** if the reload after a successful save fails, the save is kept and the next update applies the new settings.
- **Deleting a missing display profile reports an error** instead of success, so the card no longer shows a profile as deleted when nothing changed.
- **Summary sensors do not stall setup:** the four Sessions summary sensors are added straight away and fill in when the archive responds; a slow archive is logged.
- **Settings reload in order:** two reloads for the same vehicle run one after the other, so an older reload cannot overwrite newer settings.
- The charging curve of a charge you stopped and restarted now shows the whole charge instead of only the last part, as one continuous line.
- The charging curve is drawn as a step line: each reported current is held until the next change, so no slope is shown between readings the car never reported. Current changes smaller than 0.2 A are not drawn.
- Stretches where the car sent no battery progress for longer than the **A stop longer than this starts a new charge** time are joined by a lighter grey line and shaded area. Hovering or touching one explains that data is missing, with its start, end and duration. Intervals where the battery kept rising are never marked as missing, and a real 0 A reading stays visible. Turn this off with **Highlight Missing Data** in Card Settings → Advanced → Charging curve (on by default).
- A charge that had short "unavailable" moments from the car (for example on 3 November) no longer shows a blank stretch in the middle of its curve.
- The charging Live Activity now has a white title, shows the time left as text (for example "Est. 2h 40m remaining") without seconds, and keeps the green progress bar.
- Card Settings → Advanced now groups the charging options under their own headings: Charging reminder, Charge detection and Charging curve; the battery capacity sits with the vehicle setup.
- **A second Start never reaches the car while a session is running:** if the car's state could not be read at that moment, a second start could send another climate command and move the session deadline. It is now refused with a clear message and nothing changes.
- **Colours follow your palette everywhere:** chip fills, info boxes, the countdown bar, the spinner and focus rings in the preconditioning popup were not tinted on some screens. The Companion dashboard's navigation, workflow badges and status banners now use the same success and warning colours as the card instead of fixed greens and yellows, and the cost and notification pages have built-in fallbacks.
- **Minimum Home Assistant version is now 2026.7.0** (HACS and README), so users on older versions are told before installing instead of getting a broken screen.
- **Show/hide switches in the card settings tell screen readers whether they are on or off**, and name the item they control.
- **Warning yellow is the same everywhere:** the health badge and the notification page use the palette's warning colour. The loading screen of the dashboard now uses the same font as the loaded dashboard.
- **One button and box style across the card, dashboard, cost page and popup:** buttons now share three shapes (round for filters and navigation, 12 px for normal buttons, 16 px for the large action in popups) and session boxes share one radius and padding. The cost page no longer forces its own radius and padding over the dashboard's.
- **Start is always solid green and Stop is always red**, on the card as well as in the preconditioning popup.
- **Quick links from the card's preconditioning popup to the settings:** a small sliders button at the top opens Companion dashboard → Preconditioning, and tapping the notifications text opens the same page scrolled to the notification settings (administrators only).
- **The Companion dashboard's navigation tabs fit on tablets and desktop:** the tab labels (including Preconditioning) no longer run out of space between 761 and 1020 px wide, and the bar is a little wider on large screens.
- **The hover and missing-data bubble on the charging curve always stays inside the graph**, also in a small Sessions popup.
- **Data options menu fits on phones:** Export JSON, Database backup, Import older Recorder charges and Deleted charges now wrap into two columns inside the screen instead of running off the left edge.
- **Preconditioning popup on small phones:** tighter spacing, a stacked duration row, a fitting live strip and a single-column schedule editor on narrow screens.

### Translations
- **Preconditioning is fully translated** into Greek, Spanish, German and Italian: the dashboard page, the card panel, every option and explanation, and the phone messages, activity entries and error explanations, which follow the Home Assistant language.
- **Sessions page in your language:** the page heading, session counts, daily energy chart, tooltips, period tiles (energy, cost, paid price, free share), card labels and the Edit button are now fully translated in Spanish, Greek, German and Italian.
- **Last updated** is translated in the setup lists.
- **Remaining English-only texts translated:** the entity-mapping list in card settings, the Add to dashboard dialog, notification test results, preview and demo messages, setup errors and the Greek names of the charging archive sensors now follow your language, using the same terms as the rest of the integration.
- The new layout names and labels are translated into Greek, Spanish, German and Italian.
- **Session list, Deleted charges and charge dialogs translated:** the filter and sort options, Load more, the export and backup buttons, table headings, the delete confirmation, the status messages and the days-left text now follow your language, including the Delete and Change type prompts in the charging curve.

### Documentation
- New preconditioning picture in the README and the Preconditioning guide, showing the current popup. The old links to pictures that no longer existed were removed.
- New [Preconditioning guide](docs/PRECONDITIONING.md), with matching updates to the README, the user guide, the settings reference, the notifications guide and troubleshooting.
- The README gallery now shows the settings pages, charging locations, charging profiles on the card and the health checks, with refreshed screenshots of the car view, confirmation window, Notifications page and Sessions page.
- The preconditioning guide now shows the card sheet and the Preconditioning settings page with screenshots.

## 0.2.0 — Charging profile order, Energy history and electric-car clean-up

### Updating
- Restart Home Assistant after updating (backend files changed), then hard-refresh the browser (Ctrl+F5). In the Companion app, reset the frontend cache if the old interface remains.
- Saved profiles, session prices, receipts, settings and notification choices are preserved.

### New features
- **Charging profile order:** drag the grip beside a charging profile to reorder it, or focus the grip and use Up/Down. The order saves automatically and is used by the session profile dropdowns. Charging profiles and card settings share the same drag behaviour.
- **Chart zoom:** pinch to change the data range on Energy history (including monthly views), energy-delivery bars and charging curves, with a small reset icon. Ctrl/Command + mouse wheel also zooms. One finger still inspects readings, and zooming never changes saved history or totals.
- **Charging-curve bubble:** hover, tap or use the arrow keys to see the time, current and battery level in a bubble inside the graph, in the card popup, the live card curve and the Sessions popup.
- **Custom entity actions:** choose a tap action for each custom info or diagnostic entity: more info, toggle, on/off, press, navigate, open a URL or none. Read-only sensors can control another entity through an optional target. Toggle, on/off and press can ask for confirmation using the card’s Cancel/Confirm dialog. Long press always opens the original entity’s info.
- **Ten new icons:** power on/off, wallbox, solar, garage, trip, location, timer, Wi-Fi and shield, in the existing card icon style.
- **Live notification activity:** each start and end appears as one entry with Home Assistant-time badges. New entries record what triggered them (items, parking inference, delay, sensor values and report times) and why they ended.
- **Phone notifications in your language:** alert titles and messages, the live charging, live climate and left-open notifications, their buttons (Dismiss, Lock vehicle, Open dashboard, Turn off) and their dates are written in Italian, Spanish, German or Greek when Home Assistant uses that language. Other languages stay English. Alerts you saved earlier keep their saved text until you re-save or reset them.
- **Health indicator:** the Health tab shows a pulsing red dot for warnings or errors and clears after healthy checks. It respects reduced-motion settings.
- **Vehicle connection warning:** a red banner over the vehicle image asks you to check the Deepal Alternative connection and entity prefix when the vehicle is offline or missing.
- **Translated health messages:** every Health check message and fix is now available in Italian, Spanish, German and Greek.

### Improvements
- **Electric vehicles show no fuel items:** a vehicle detected as, or set to, Electric no longer shows fuel in info tiles (including petrol volume), level-colour settings, the Energy history chart and title, or Health checks. Plug-in hybrids are unchanged.
- **Hybrid fuel readings:** the tank-capacity setting, the unused capacity sensor and the 51 L fallback are removed. Fuel percentage uses the fuel level, and litres used come from recorded fuel-volume decreases while driving, with transient drops filtered. No litres are shown when volume readings are unavailable. Saved sessions and settings are preserved.
- **Mobile charging curves:** taller plots, selected readings that stay visible after you lift your finger, and one-finger scrubbing without accidental text selection.
- **Custom entity editor:** action options start collapsed, use the shared field styling and show target, confirmation or path fields only for the chosen action. In the minimal layout the icon and title stay fixed while the settings expand below.
- **Settings navigation:** the tabs use four columns when the editor is wide, then three, two or one as space shrinks.
- **Profile header:** clicking anywhere on the header expands or collapses a profile; keyboard activation works too.
- **One loading animation:** a single, larger rotating ring is used for Energy, curve popups, activity and the dashboard, with reduced-motion support. Switching tabs shows the LK initials inside the ring.
- **Chart contrast:** darker series on light themes, brighter and thicker series on dark themes, shared by Energy history, daily bars and charging curves.
- **Notification page themes:** active notification cards have a pale green background in light mode, inactive switches have a solid grey track and white thumb, selected action buttons share the device-button look, and disabled alerts and live notifications are more muted while their switches stay usable.
- **Home Assistant time everywhere:** notification activity, Health checks, session dates, the card’s day/night fallback and the daily Energy and charging charts use Home Assistant’s configured time zone, including daylight-saving changes. Live notification times follow it too.
- **Energy delivery chart:** monthly charts show a date every five days; each bar keeps its full date in its tooltip.
- **Charging efficiency:** the setting is labelled as the battery-estimate efficiency, and the help explains that measured charger energy and receipt energy bypass it.
- **Faster updates:** the loader, panel and lazy-loaded card assets share one frontend revision, so browsers fetch new files after an update.
- **Italian wording:** corrected following tester feedback, including the Health tab’s “Check again” button.
- **Steadier totals while charging:** the dashboard and Sessions page read one consistent set of figures, so refreshing totals no longer waits for a session save. Repeated requests for the same figures share one calculation.

### Bug fixes
- **Left-open alerts follow your report interval:** a new setting, **Count as parked after**, sets how long the odometer must stay unchanged before the car counts as parked (default 6 minutes). A report that repeats the same odometer value no longer counts as driving, so a parked car now gets its alert even when the car reports every 5 minutes. Set it a little longer than how often your car reports.
- **Clear reason when a live notification ends:** Recent activity now says “Climate turned off”, “Vehicle moving” or “Everything closed and locked”, translated into Italian, Spanish, German and Greek.
- **Charges end 6 hours after the car goes offline:** while the car is unreachable, a running charge keeps its last readings for 6 hours and then closes at its last known reading. A reading from an unrelated sensor (for example the odometer) can no longer close a charge early.
- **English entity names:** the Companion sensors keep their English names in every Home Assistant language, so names no longer switch to Greek.
- **Unlocked alert with one missing sensor:** a stale or unavailable lock-state sensor no longer hides an unlocked car.
- **Electric cars no longer report missing fuel sensors:** Health no longer warns about fuel level or fuel volume on a vehicle without fuel.
- **Left-open and unlocked delay:** “Wait before showing” now uses exactly the seconds you set (default 5 minutes). The hidden five-minute floor and two-minute reduction are gone.
- **Waits restart after interruptions:** if the car is closed or locked, moves (with “Only when parked”), loses its connection or reports unknown or stale readings before the alert is sent, the wait starts again from zero. Restarting Home Assistant also discards a wait that was not yet confirmed. Running notifications keep their state.
- **Stale openings cannot start an alert:** stale, restored or unknown door, window and lock readings no longer trigger one. With parking filtering on, a stale or unknown odometer blocks the start. No new setting or migration is needed.
- **Charging costs update immediately:** switching a saved session to Manual, or saving an edited tariff or total, refreshes the session and the dashboard totals. Battery-based estimates are marked “≈”.
- **Energy units:** W/kW readings are integrated over elapsed time and Wh/kWh meters are differenced. Receipt energy and measured charger energy bypass efficiency.
- **Energy history dates:** “today” and the selected period follow Home Assistant’s time zone, including daylight-saving days.
- **Notification destination field:** its height now matches the adjacent control after a cold load, with the name, path, clear button and arrow centred.
- **Activity order:** notification activity entries recorded in the same instant stay newest first, so paging no longer skips or repeats entries.
- **Summary sensors no longer stall:** a summary calculation that takes too long is stopped, and the sensors recover on a later update instead of staying frozen.

### Good to know
- **Vehicle type is a view setting.** Automatic decides from the fuel sensors; choosing Electric on a hybrid only hides fuel items. The vehicle keeps recording fuel readings and still behaves as a hybrid, and choosing Plug-in hybrid again shows everything.
- **Parked detection is an estimate.** It uses the two-minute odometer-report rule and does not prove the gear is in P; delayed reports or long stops can look like parking.
- Phone notification texts follow the Home Assistant language, not the language of the browser you used to set them up.
- **Default battery capacity:** when you do not enter a kWh value, plug-in hybrids use 18.4 kWh and electric cars use 68.8 kWh. A value you enter is always used.

### Testing
- Added tests for the exact delay, brief closures, stale evidence, movement, disconnection and waits across a restart; manual tariff and total saves, receipt precedence, power integration, meter differences, unit validation and battery-only efficiency; Health checks for electric and hybrid vehicles; notification text translation; and activity ordering.
- Added tests for summary timeouts and recovery, reads that stay consistent during saves, shared repeated calculations and the default battery capacities.

## 0.1.9 — Update Spanish translations

### Changes
- Updated Spanish translations, contributed by **@Sunek0**.

### Contributors
- **@Sunek0** made their first contribution.

[Published release](https://github.com/rmxs/deepal-S05-Companion/releases/tag/v0.1.9) · [Full comparison: v0.1.8…v0.1.9](https://github.com/rmxs/deepal-S05-Companion/compare/v0.1.8...v0.1.9)

## 0.1.8 — German and Italian, light themes and local times

### Updating
- Restart Home Assistant after updating (translation and backend files changed), then hard-refresh the browser (Ctrl+F5). In the Home Assistant app on a phone, use **Settings → Companion app → Debugging → Reset frontend cache** if the pages still look old.
- Your settings, profiles, charging sessions and notification choices are kept.

### New features
- **German** and **Italian** translations for the card, the Companion panel, charging costs, energy history, health and notifications. German uses the formal “Sie”; Italian uses “tu”.
- The card follows the language set in Home Assistant. There is no separate language picker on the card.
- Live charging and status notifications show times in your Home Assistant time zone instead of UTC.

### Improvements
- **Greek and Spanish** now cover the same texts as the other languages, including the charging, energy, cost and notification screens.
- The activity panel, menu button, loading labels and empty-activity message are translated.
- **Cost dashboard:** the energy total shows “≈” when a charge in the period uses the battery-level estimate instead of a measured reading.
- **Energy sheet switch:** the manual explains the “Energy” sheet on the tile switch under Card Settings → Charging. It is on by default for new setups. When it is on, a tap opens the Energy sheet and a long press opens the battery sensor; when it is off, a tap opens the battery sensor.
- **Database backup:** the manual explains where the backup file is saved (`.storage/deepal_companion.backup.sqlite`) and that each backup replaces the previous one.

### Bug fixes
- **Light themes:** the Energy sheet input fields and standard dropdowns no longer appear dark on light Home Assistant themes.
- **Info colour:** the card's default info colour now matches the palette's info colour.

## 0.1.7 — Spanish translation fixes

### Updating to 0.1.7
- Restart Home Assistant after updating, then hard-refresh the browser (Ctrl+F5). In the Home Assistant app on a phone, use **Settings → Companion app → Debugging → Reset frontend cache** if the pages still look old.
- Your settings, profiles, charging sessions and notification choices are kept.

### Changes
- **Spanish texts reviewed for car terms and everyday wording.** Key is now “Llave”, Odometer is “Cuentakilómetros”, Parked is “Aparcado” everywhere, “Locked after” reads “Bloqueado tras”, and “hero” is replaced by “imagen principal”.
- **Charging wording:** “Manual charge” is now “Carga manual”, and the Notification Control Center is “Centro de notificaciones”.
- **Battery and fuel colour labels:** the Spanish names for the red, orange and yellow levels now show as Rojo, Naranja and Amarillo.
- **Other wording:** “Schedule” is “Programación”, “Rolling” is “Carrusel”, and “Database backup” is “Copia de seguridad de la base de datos”.

## 0.1.6 — New Sessions page, light and dark themes and safer saving

### Updating to 0.1.6
- Restart Home Assistant after updating (backend files changed), then hard-refresh the browser (Ctrl+F5) so the new card and panel load.  In the Home Assistant app on a phone, use **Settings → Companion app → Debugging → Reset frontend cache** if the pages still look old.
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
- **Notifications page on a light theme**: the alert rows, the device buttons (**Devices to notify**), the quiet-hours time boxes, the **Silent / No notification** switch, the filter tabs (**Basic / Recommended / All**), the live notification rows and the on/off switches kept a fixed dark colour, so their text was almost invisible on a white Home Assistant theme. They now use your theme colours, with a visible border on every row and a clear track on switches that are off.
- **Sessions page on a light theme**: the **Location** and **Sort by** lists and the **Grid / Table** switch were dark with dark text. They now follow the theme.
- **Time and list pickers** on these pages use the light or dark style of your theme, so the clock, the drop-down lists and the scrollbars match.
- **Interior view of the card** (the Climate tab): the temperature on the car screen (for example 23 °C), the **On / Off** label and the power button sat on a dark photo but used the theme text colour, so they disappeared on a light theme. They are now always white.
- **Dark themes look the same as before.** The colours that were fixed on the dark design now come from the theme, so a custom dark theme with other background colours is followed too.

### Checks and maintenance
- The automatic checks now match the shared car colour and wheels introduced in 0.1.6: two checks that still treated them as per-profile settings are corrected to use a real per-profile setting (card design and background), and a new check confirms that changing the car colour is shared by every display profile.
- Light and dark themes were checked on the Notifications and Sessions pages, the other Companion pages, the card designs and the interior view.

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
