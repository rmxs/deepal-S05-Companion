# Settings reference

[README](../README.md) · [Step-by-step user guide](USAGE.md)

Open **Deepal Companion** from the sidebar. The paths below use the English menu names. Vehicle-specific controls and fields appear when the required entities are available.

## Card Settings → Card profile and Card design

The **Profile** box starts closed. Use the arrow next to the connection badge to open or close it; the badge stays visible.

- **Connection badge:** shows whether Deepal Alternative is connected to the vehicle cloud. **Active** (green): connected. **Offline** (red): the connection is lost or unavailable. **No data** (grey): the status is not available yet. It updates live.
- **Vehicle:** choose the vehicle when more than one is configured.
- **Card profile:** select a profile or edit its name in the same field.
- **Duplicate / New profile / Delete:** manage independent card appearances.
- **Design style:** Profile default, Mobile, Tablet or Energy.
- **Max width:** automatic (0), or 280–1600 px. Dashboard column width still limits the card.

Card Settings has six tabs: **Layout**, **Appearance**, **Controls**, **Charging**, **Vehicle** and **Advanced**. Advanced groups the less-often-changed settings into four categories: **App**, **Vehicle and sensors**, **Look** and **Charging records**.

Every settings section starts closed. Tap a section title to open or close it, or use **Expand all**. Your choice is remembered in this browser.

## Card Settings → Layout

| Setting | Available choices |
| --- | --- |
| Sections | Show/hide and reorder Vehicle image, Status (on the image), Control buttons, Status, Charging, Temperature & battery, Info and Charging costs. Charging curve and Charging reminder are in **Advanced → Charging records** |
| On the image | Show/hide Name, Plate, Total range, Cloud connection, Last update (the age badge on the refresh button) and the Settings button (the gear at the bottom right of the image) |
| Top-right buttons | Show/hide and reorder Notifications, View, Diagnostics and Refresh |
| Control buttons | Show/hide and reorder Lock, Windows, Trunk, Climate, Preconditioning, Tyres, Cabin, Flash, Sound signal and Locate |
| Button layout | Main buttons + More, Main buttons + More on the image (More opens a panel under the image, or takes a free slot in the row), All buttons in More on the image, Swipe pages, or Rows (5 per row) |
| Button labels | No labels, Status only, Title only or Title + status |
| Main buttons | Three, four or five buttons in the main row (for Swipe pages: buttons per page) |
| Remaining buttons | Hidden under More or always visible |
| Button size | Small, Medium or Large |
| Info | Show/hide and reorder odometer, outside/inside temperature, humidity, fuel level, petrol volume, power status and charging status, when available |
| Custom info tiles | Add, reorder or remove entities; choose a label, built-in/HA icon and tap action. Optional action targets let a read-only sensor control a switch or button. Long press always opens the original entity’s info |

**Defaults:** the separate Charging and Charging costs sections are off. Charging curve is on and is displayed while charging; its switch is in **Advanced → Charging records**.

**Status (on the image)** is its own tile right after Vehicle image, with its own switch. It is greyed out, and its switch is disabled, while the vehicle image is off; its saved value is kept.

## Card Settings → Appearance

Appearance has three sections: **Style**, **Car image and Car View** and **Messages**.

### Style

| Setting | Available choices |
| --- | --- |
| Theme colour | Green, Blue, Violet, Amber, Rose, Cyan, Lime, Coral or Silver. Colours buttons, bars, selected pills and icons; status colours (OK, warning, error) stay the same |

### Car image and Car View

| Setting | Available choices |
| --- | --- |
| Image style | Photos or Car View |
| Default Car View | 3/4 or Top |
| Car View background | Black, Automatic, Neon city, Morning, Afternoon, Evening or Night. Neon city is a palm-lined coastal city that follows day, afternoon and night. Morning and afternoon are a deeper blue sky, evening is a dusk sky, night keeps the moon and stars. Automatic follows the sun. |

### Messages

| Setting | Available choices |
| --- | --- |
| Message under the status | None, Rolling or With dots (under Locked / Unlocked) |
| On-screen messages | On/off |
| Message position | Up or Down |
| Message duration | 3, 5, 8 or 12 seconds |

Image zoom, aspect ratio and space around the car are in **Advanced → Look → Size and margins**.

The view button changes the view on the device you are using. The default view setting selects the opening view.

## Card Settings → Controls

| Setting | Available choices |
| --- | --- |
| Climate tile | Target with − / +, or Large circle |
| Temperature selector | Wheel or Bar |
| Confirm temperature change while climate is off | On/off |

### Button behaviour

| Setting | Available choices |
| --- | --- |
| Waiting effect | Spinning arc, Soft pulse or Neon ring while a command waits for the car |
| Action confirmations | Choose confirmation for Lock, Unlock, Open windows, Open trunk, Climate, Lights, Horn, Locate and Refresh data |

Climate on-mode (the HVAC mode used when turning climate on) is in **Advanced → Vehicle and sensors**.

## Card Settings → Charging

### Charging on the card

| Setting | Available choices |
| --- | --- |
| Charging details | Line, Text, Large or At the port |
| Charging effect | Cable flow + port pulse, cable flow, port pulse, light sweep or None |

The image’s charging details remain visible when the separate Charging section is hidden. The charging-curve switch is in **Advanced → Charging records**.

### Energy tile

| Setting | Available choices |
| --- | --- |
| Alternate charging text | Alternate Charging now and reported time left |
| Energy tile style | Ring or Half gauge |
| Charge plan button | On/off. Shows the clock button on the Energy tile for setting the charging schedule |
| Cost selector while charging | On/off. Shows the cost selector while the car charges |

**“Energy” sheet on the tile** (on by default for new setups):

- **On:** a tap on the Energy or Battery tile opens the Energy sheet with battery, charging and driving history. A long press opens the battery sensor’s more-info window.
- **Off:** a tap opens the battery sensor’s more-info window instead. The Energy sheet is not available from the tile.

Charging reminder, charge detection and charging curve settings are in **Advanced → Charging records**.

## Card Settings → Vehicle

| Setting | What you can change |
| --- | --- |
| Entity prefix | Vehicle entity prefix |
| Vehicle type | Automatic, Plug-in hybrid or Electric. Automatic treats the car as a hybrid when it has a fuel level, fuel range or fuel volume sensor, and as electric otherwise. Electric hides fuel tiles, fuel colour settings, fuel history and fuel health checks. See [Vehicle type](#vehicle-type) |
| Battery capacity | Automatic capacity (18.4 kWh for plug-in hybrids, 68.8 kWh for electric cars) or a kWh override, when Energy history is enabled |
| Car colour | Black, blue, grey, silver or white (used by the Car View image) |
| Wheels (Car View) | 20-inch with covers, 20-inch without covers or 18-inch Pro |
| Diagnostic indicators | Enable/disable individual available warning indicators |
| All / None | Enable or disable the diagnostic selection together |
| Tyre unit | bar, kPa or psi |
| Pressure check | From the vehicle, My own limits or Both |
| Minimum / Maximum pressure | Custom limits in the selected unit |

Empty numeric fields display the default as a hint. Enter your own value to override it. Clearing an override restores the default.

Built-in indicators include Airbag, ABS, Brakes, Brake fluid, 12V battery, Low traction battery, Power system, Power limited, Power steering, Tyre pressure, the four individual tyre alarms and Key battery.

## Card Settings → Advanced

Advanced holds the settings most people set once. It has four categories: **App**, **Vehicle and sensors**, **Look** and **Charging records**.

### App

| Setting | What you can change |
| --- | --- |
| Card name | Name shown on the card |
| Card page | The profile and design the Deepal Card page always uses, whatever is chosen elsewhere |
| Show “Deepal Card” in the sidebar | Lists the **Deepal Card** page (just the card) in the sidebar. Off by default; an administrator changes it, then reloads the browser. The page keeps working from its address (`/deepal-companion-card`) and from notifications while hidden |
| Data update rate | Live, 5 min or 10 min. See [Data update rate](#data-update-rate) |

### Vehicle and sensors

| Setting | What you can change |
| --- | --- |
| Full-tank fuel range | Automatic 940 km for hybrids, or a positive override. For hybrid range, 0 selects the automatic value. Fuel litres are read from the fuel-volume sensor; there is no tank-capacity setting |
| Hero photos folder | Automatic image folder or a custom folder |
| State-specific photos | Replace individual available vehicle-state images and check their previews |
| Climate on-mode | HVAC mode used when turning climate on |
| New sensors | Search for new sensors, ignore suggestions and restore ignored ones |
| Entity mapping | Choose a sensor role, select its HA entity and add/remove the mapping |

### Look

#### Size and margins

| Setting | Available choices |
| --- | --- |
| Image zoom | Adjust the car image size |
| Aspect ratio | Automatic or a ratio such as 16 / 9 |
| Space around the car | Compact, Standard or Roomy |
| Card margins | Normal, Half or None |
| Popup margins | Normal, Half or None |

#### Colours

| Setting | Available choices |
| --- | --- |
| Cool airflow | Colour and upper temperature limit |
| Mild airflow | Colour and upper temperature limit |
| Warm airflow | Colour above the mild limit |
| Level colours | Red, Orange, Yellow and Green |
| Notification colours | For each live notification state (Left open or unlocked, Closed and locked, Climate, Charging) choose Red, Orange, Yellow or Green. The colour comes from your level colours |
| Battery thresholds | Three percentage boundaries for the four level colours |
| Fuel thresholds | Three percentage boundaries for the four level colours, on plug-in hybrids only; electric cars show only the battery thresholds |

### Charging records

#### Charging reminder

| Setting | Available choices |
| --- | --- |
| Ask for a charging profile after at least (%) | Minimum battery gain a finished charge needs before the Charging detected reminder appears. 0–100, default 3; 0 asks after every charge that adds battery. Shared by all cards of the vehicle |
| Recent charges checked for the reminder | How many of the latest charges the reminder looks at, so earlier unanswered charges are still offered. 1–20, default 10 |

#### Charge detection

| Setting | Available choices |
| --- | --- |
| Ignore one-off battery jumps above (%) | A single battery reading this many percent above the charge so far is ignored until the next reading confirms it, so one wrong reading cannot inflate a charge. 5–50, default 20 |
| A stop longer than this starts a new charge (min) | In the live curve, a stop shorter than this stays part of the same charge, so a charge you stopped and restarted shows as one curve. It is also the silent time after which a stretch with no battery progress counts as missing data. 1–120, default 15 |

#### Charging curve

| Setting | Available choices |
| --- | --- |
| Refresh the charging curve every (min) | While charging, the curve's line follows the latest car report. When the car reports nothing new, the line still moves to the current time this often. 1–60, default 5 |
| Highlight Missing Data | On by default. Gaps between readings where the car reported no battery progress are joined by a lighter grey line and shaded area, and hovering or touching one explains that data is missing with its start, end and duration. Off keeps one plain continuous line. Applies to the card and to saved charges |

## Card Settings → Live preview

- **Preview state:** Live, Parked, Plugged in, AC charging, DC charging, Charge complete, Alerts, Doors & boots open or Climate on.
- **Allow clicks:** enable or disable preview interaction.
- **View switch:** top or 3/4 view, using the same card control.
- **Live mode:** uses vehicle data; enabled controls can operate the vehicle.
- **Simulated modes:** use demo states and keep commands inside the preview.

## Charging page → Locations

| Setting | What you can change |
| --- | --- |
| Location name | Name shown on charges |
| Free charging | Zero-cost charging; hides paid fields |
| Suggest for new charges | Marks one charging profile as the usual place. The Charging detected reminder then has it preselected, so one tap confirms. Nothing is assigned until you save, and past charges are never changed. Only one profile can be suggested. |
| Price | Euro price per kWh |
| Energy source | Battery estimate, Total energy meter, Session energy meter or Charger power |
| Charger entity | Matching energy or power sensor for that location |
| Charging efficiency | Percentage used for battery estimates; default 90% |
| Add location | Add another named charging location |
| Save profiles / Cancel changes | Keep or discard location edits |

## Sessions

- **Location filter:** All locations, Not set or a saved location.
- **Sort:** newest, oldest, highest cost or lowest cost.
- **View:** Grid or Table.
- **Load more:** fetch six additional sessions from the database.
- **History period and arrows:** weekly/monthly and earlier/later chart periods.
- **Edit charge:** location, free charging, price/kWh, measured kWh and total paid.
- **Curve:** inspect the saved current readings for a charge.
- **Data options:** Export JSON, Database backup and Import older Recorder charges.

## Preconditioning

The **Preconditioning** page (and the card’s Preconditioning panel) controls remote climate. Settings need Home Assistant administrator rights; everyone can read the status.

| Setting | Available choices |
| --- | --- |
| Temperature | 18–32 °C in 0.5 °C steps. The last value you use is remembered for the next Start and for new schedules |
| Duration | 1–15 minutes (the car limits remote climate to 15 minutes). The last value you use is remembered |
| Start / Stop | Not on this page; use the card's Preconditioning panel. Start is disabled while an operation runs or when battery protection blocks it |
| Scheduled preconditioning | Main switch for all schedules. Off by default; manual Start still works |
| Schedules (up to 20) | Name, Repeat (Once, Daily, Mon–Fri, Custom days), Mode (Start at, Ready by), Date (Once), Start or Ready time, Duration or Preparation time, Temperature and an on/off switch |
| Battery protection | Off by default. Minimum battery 10–50 % in 5 % steps, Block START at or below the minimum, Request STOP at the minimum, Apply while charging (on by default) |
| Notifications | A row that opens **Notifications → Preconditioning**, where the main switch, phones, events and test button are set |
| Advanced: retries and checks | Attempts 1–3 (default 3), Wait between attempts 10–120 s (default 30 s), Wait for the car to answer 30–180 s (default 90 s) |
| Diagnostics | Current operation and session IDs, last confirmed state, last successful Start and Stop, last failure, retry count and session history (kept for 30 days, scrolls when long, with a Clear history button for administrators) |

Preconditioning notifications (the switch, phones, events and test) are set only on **Notifications → Preconditioning**. **Summary** at the top of the page explains the current choices in plain words. See the [Preconditioning guide](PRECONDITIONING.md).

## Charging page → Charger limit

The **Charger limit** block, under the charging profiles on the **Charging** page, stops charging at the **charging target**, which you set here with **Stop charging at** (Off, 70, 80, 90 % or a slider from 50 to 95 %). A limit of 100 % does nothing, and the block says so. The card's ring, estimate and notices use the same target. Companion needs no charger brand: you only pick your charger and it finds the rest. Settings need Home Assistant administrator rights; everyone can see the status. The same status also shows as the **Charger limit** tile in the card's info row, which you can hide or move under Card Settings → Layout → Info.

| Setting | Available choices |
| --- | --- |
| Stop charging at | The charging target: **Off**, **70%**, **80%**, **90%** or the slider (50–95 %). Shared by every display profile of the car and shown on the card |
| Charger | The device of your wallbox. Choosing it fills in the stop control, the power and energy sensors, and which way it stops, from the device's own lock or switch. Changing it resets only the stop control and its direction; the power and energy sensors you chose are kept |
| Charger type | **Auto (switch or lock)** (default) works as before. **Feyree (Tuya Local)** is for a wallbox that takes Start and Stop commands. Companion picks the charger's Start/Stop charging command (a dropdown or buttons), its power sensor and its status sensor. A line shows which command stops and which restarts the charge. Two small pickers appear only if the commands cannot be found. The stop is confirmed by the power and status sensors |
| Stop control | The lock or switch that stops the charging, from any device. Filled in automatically from the charger, and you can change it. **Choose another…** (last in the list) lists every lock and switch except the car's own door lock |
| Power sensor (optional) | A power sensor from any device. Filled in automatically from the charger when it has one, and you can change it. **None / not used** clears it. kW is converted automatically. Its current value shows beside its name |
| Energy sensor (optional) | An energy sensor from any device. Filled in automatically from the charger, preferring a "this charge" counter over a lifetime total, and you can change it. Wh is converted automatically. Its current value shows beside its name. The card shows the energy after the limit has stopped the charger |
| Stops charging when it is | **Locked / Unlocked** for a lock, **On / Off** for a switch. Filled in by itself from the entity type and name. A short note under it says when Companion guessed the position from the names |
| Mode | **Off**, **Dry run** (decides and tells you, never touches the charger) or **Live** |

How it behaves:

- It acts when the car is plugged in and charging, the battery has been at or above the target for about 45 seconds, and the battery reading is recent. One wrong reading cannot stop a charge. The car reports now and then, so the battery can pass the target by a little before the stop.
- It stops **once per plug-in**. When the car is unplugged, everything starts over.
- **If you restart the charger yourself** after Companion stopped it (for example you unlock it), Companion sees that and **pauses the limit until the next plug-in**. It never fights you. **Charge anyway** does the same.
- If you **raise the target** above the battery, turn the target off, leave Live mode, or **unplug the car**, Companion puts the control back to "charging allowed", so an earlier stop should not hold the next charge.
- A stop is checked: the control must read "stopped" and, if the charger has a power sensor, the power must drop. If not, Companion tries up to three times, puts the control back, tells you and waits. Health shows the error.
- The stop is saved before it is sent, so a Home Assistant restart cannot lose track of it. If the charger cannot be put back to charging (for example it is offline), Companion keeps trying, Health shows a warning and your phone is told once.
- Messages go to the phones of your enabled alerts (see **Notifications**), and to **Notifications → Recent activity**.
- **On the main card**, the charging block shows one row while the limit is on and the car is plugged in: the power while it waits, `Stopped at 80% · 12.4 kWh` with a **Charge anyway** button (administrators) once stopped, or the dry run, paused, failed and unavailable states. Nothing shows when the limit is off.
- **Health** has a Charger limit check. It warns when the car's plug sensor has not answered for 10 minutes, when the energy sensor looks like a lifetime total, when the car's last report is too old for the limit to act, and when the target is 100 %, which does nothing.

## Notifications

The **Notifications** page contains the integration’s notification controls:

- Master on/off switch.
- Mobile App recipients.
- Basic, Recommended and All presets.
- Quiet hours: enable, start/end times and Silent/No notification behaviour.
- Individual alert enable switches.
- Per-alert delay, repeat interval and maximum notifications where available.
- Alert thresholds and relevant away/parked conditions, **Car on, not moving for** and **Advanced conditions** (your own sensor rules for the parked alerts).
- Information, Important or Critical severity.
- Notification icon, title and message, with supported vehicle-value tags.
- Supported action buttons, including Lock vehicle and Dismiss.
- Per-alert reset, preview and test.
- Ignore old data threshold.
- Save and Cancel changes.
- Live notifications (Live charging, Live climate, Left open or unlocked): switches, options, title, icon and tests. For Live climate and Left open or unlocked: **Only when the car is parked** (on by default) and **Count as parked after** (6 minutes by default). For Left open or unlocked, also **Wait before showing** (5 minutes by default).
- Where the phone opens when you tap a notification.
- Recent activity pagination, delete and delete all.

Configure alerts, phones, quiet hours and Live notifications on the separate **Notifications** page. Settings need Home Assistant administrator rights: the gear on the card opens the Companion dashboard and is hidden for other users.

See [Notifications](NOTIFICATIONS.md) for each alert, its purpose and full setup steps.

**Notification settings:** alerts, timing, messages, devices and quiet hours are set only on the Notifications page. The colour of each live notification state is the only notification setting in Card Settings (**Advanced → Look → Colours**).

## Automatic features

- Discovery of supported Deepal vehicles and detection of vehicle type for confirmation at setup.
- Matching of source entities, with manual mapping available when needed.
- Vehicle image, door/window/trunk state and supported control status updates.
- Battery and fuel colour changes at the selected thresholds.
- Airflow colour changes at the selected temperature thresholds.
- Optional automatic day/night background.
- Charging animations, time-left text and current curve while charging.
- Charging-session recording with dashboards closed.
- Charging cost estimates from the selected energy source, with an estimate label when applicable.
- Import of available Recorder charging sessions/readings on the Sessions page.
- Saved tariff/payment assignments and saved charging curves in the archive.
- Charging-detected reminders for every unanswered recent charge, oldest first; dismissal applies to one charge and one user, and a reminder clears after assignment elsewhere. The minimum battery gain and the number of recent charges checked are set in Card Settings → Advanced → Charging records.
- Background notification checks, repeats, quiet hours and stopping reminders after their condition clears or they are dismissed.
- Live charging start/update/end handling from reported charging state.
- Preconditioning: fresh vehicle data before and after every start and stop and while waiting for the car’s answer, confirmation from the car’s own report, limited retries, schedules, battery protection and a hand-over to the driver when the car is switched on.
- Settings updates across cards using the same profile.
- Date and time display using Home Assistant preferences.

## Charging profile names and deletion

In **Charging**, start typing a network name to see suggestions, or enter any custom name. Choose **Delete profile** inside an expanded profile, confirm, then save. Earlier sessions retain their saved location and cost. **Total paid** in a session selects **Manual charge** automatically.

To test the on-card cost reminder, choose **Charging detected** under **Card Settings → Live preview**, enable **Charging costs** in Layout and turn on **Allow clicks**. The scenario uses sample data and never saves real assignments.

**Independent card blocks:** In Layout → Sections, Charging costs (saved as `charging_cost`) controls the cost block, which disappears from the card when it is off; saved prices, receipts and the Costs dashboard are kept and Charging reminder controls charging-detected assignment reminders. These choices are saved per card profile and do not remove charging history.

Custom tap actions include More info, Toggle, Turn on, Turn off, Press, Navigate, Open URL and None. For Navigate or Open URL, fill in the path/URL. Toggle and on/off need a controllable entity; for a binary sensor, choose the corresponding switch in Action target. Existing advanced actions are preserved and shown as Custom action.

Custom entity action options start collapsed. Expand Tap action to edit them; only the relevant target or path fields appear. Enable Ask for confirmation for Toggle, Turn on, Turn off or Press to use the same Cancel/Confirm dialog as vehicle commands. Cancelling sends no command.

### Vehicle type

The vehicle type is chosen at setup from the vehicle’s registered entities and can be changed under **Card Settings → Vehicle**.

- **Automatic** follows the vehicle: with a fuel level, fuel range or fuel volume sensor it is a plug-in hybrid, otherwise it is electric. It re-checks whenever the sensors change.
- **Plug-in hybrid** always shows battery and fuel items.
- **Electric** hides every fuel item: fuel and petrol tiles, fuel colours and thresholds, the fuel range, petrol history in Energy and the fuel checks in Health. The default battery capacity also switches to the electric value (68.8 kWh instead of 18.4 kWh); a capacity you entered is kept.

The choice only changes what is shown. A hybrid set to Electric still records fuel readings and keeps its data, so switching back restores everything.

### Language of phone notifications

Alert titles and messages, the Live charging, Live climate and Left open or unlocked notifications, their buttons and the dates in them use the Home Assistant language (**Settings → System → General**): English, Italian, Spanish, German or Greek. Other languages stay English. An alert is stored in the language that was active when it was saved; edited titles and messages are sent exactly as you typed them. Times use the Home Assistant time zone.

### Notification language

At the top of the Notifications page, **Notification language** sets the language of every notification Companion writes: alerts, charging and live updates, and preconditioning. **Automatic** (the default) follows the Home Assistant language; you can also pick English, Greek, German, Spanish or Italian. Only administrators can change it. Texts you wrote yourself are sent as written.


### Data update rate

In **Card Settings → Advanced → App**, **Data update rate** sets how often Companion saves the car's readings and refreshes live notifications. It applies to every vehicle and to the whole integration, and only an administrator can change it.

- **Live** (the default): every change the car reports is saved and shown. Notifications follow their own **Update at most every** setting.
- **5 min** or **10 min**: a reading is saved at most once in that time, and live notifications are never sent more often than that. A change that arrives sooner is not lost; it is saved as soon as the time has passed. Charging curves and history become coarser, but use less storage.

This does not change how often the car itself is read. That is set in the Deepal Alternative integration: with its live connection (MQTT) the car reports within seconds, and the scan interval (300 seconds by default) is the fallback and refreshes the readings that only come from the periodic scan.

## Fixed times

These times are built in because they protect against false alarms and wrong charge records, and they stay correct whether the car reports live or every 5 minutes. They are not settings.

| Time | What it does |
| --- | --- |
| 15 seconds | How often Companion checks your alerts. Delays, repeats and cooldowns you set are counted from these checks. |
| 30 seconds | Live charging ends this long after the car stops charging, so a short pause does not end the notification. |
| 5 minutes | A charger reading that does not change is still saved at least this often (every 10 minutes with the 10 min update rate), so the energy of a long constant charge is counted correctly. |
| 5 and 10 minutes | A live notification whose content has not changed is refreshed at most this often when the car reports newer readings: 5 minutes for Live charging, 10 minutes for Live climate and Left open or unlocked. The data update rate and **Update at most every** can only make this slower. |
| 10 minutes | A DC current reading that starts within 10 minutes of AC current is ignored unless the battery then rises, because some cars report a false DC current when an AC charge ends. |
| 15 minutes | A charge is finished when charging has been off for 15 minutes, and a charge is closed when readings stop for 15 minutes (for example while Home Assistant is off). A shorter stop stays part of the same charge. |
| 6 hours | An unreachable car keeps its charge open and its last value for up to 6 hours. After that the outage is shown as it is and the charge is closed at its last reading. The Health page also marks a battery reading older than 6 hours. |
| 2 minutes | Car logs: door, window and lock changes within 2 minutes form one entry, "data unavailable" is logged only after 2 minutes without a battery reading, and a charge shorter than 2 minutes that added nothing is ignored. |
| 15 and 45 seconds | Preconditioning: **Refresh vehicle data** can be pressed once in 15 seconds, and a start or stop waits up to 45 seconds for a newer report before it decides. |

Times you can change have their own settings, for example **Wait before showing**, **Count as parked after**, **Update at most every**, the reading age limit and the repeat and cooldown of alerts.

### Chart navigation

Pinch with two fingers to zoom the Energy history, energy-delivery and charging-curve time axes. Move both fingers together to pan while zoomed, and use the small reset icon to show the full range. Ctrl/Command + mouse wheel also zooms. One finger inspects readings; zooming changes the view without changing saved data or period totals.

Live notification activity combines each start/end lifecycle into one entry. Expand its details to inspect triggering openings/unlocked state, captured sensor values and report times, and the end reason. “Only when parked” counts the car as parked when its odometer has stayed the same for **Count as parked after** (6 minutes by default, 1–60 minutes); it does not confirm gear P. A long stop or delayed API reports may therefore qualify. Without an odometer, engine/power status is used. Historical entries cannot recover trigger evidence that was never recorded.

For live left-open/unlocked alerts, **Wait before showing** is the full continuous delay (5 min = 300 seconds) after the condition first qualifies. Before delivery, clearing the condition, detected movement (when parking filtering is enabled), disconnection, stale or unknown evidence resets the timer. HA restart also restarts a pending wait. A zero-minute setting skips this delay, but still requires a qualifying fresh condition. **Count as parked after** only decides moving versus stationary; it is not subtracted from your delay. Existing live activities keep their end-delay behavior.
