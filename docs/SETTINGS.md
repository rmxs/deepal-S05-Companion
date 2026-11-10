# Settings reference

[README](../README.md) · [Step-by-step user guide](USAGE.md)

Open **Deepal Companion** from the sidebar. The paths below use the English menu names. Vehicle-specific controls and fields appear when the required entities are available.

## Card Settings → Profile and Card design

- **Vehicle:** choose the vehicle when more than one is configured.
- **Card profile:** select a profile or edit its name in the same field.
- **Duplicate / New profile / Delete:** manage independent card appearances.
- **Design:** Mobile, Tablet or Energy.
- **Maximum width:** automatic, or 280–1600 px. Dashboard column width still limits the card.

## Card Settings → Layout

| Setting | Available choices |
| --- | --- |
| Sections | Show/hide and reorder Vehicle image, Control buttons, Status, Charging, Charging curve, Temperature & battery, Info, Charging costs and Charging reminder |
| On the image | Show/hide Name, Plate, Total range, Cloud connection, Last update (the age badge on the refresh button) and the Settings button (the gear at the bottom right of the image) |
| Message under the status | None, Rolling or With dots |
| Top-right buttons | Show/hide and reorder Notifications, View, Diagnostics and Refresh |
| Control buttons | Show/hide and reorder Lock, Windows, Trunk, Climate, Tyres, Cabin, Flash, Sound signal and Locate |
| Button layout | Main buttons + More, Rows (5 per row), One row with scroll, or One row (everything fits) |
| Button labels | No labels, Status only, Title only or Title + status |
| Main buttons | Three, four or five buttons in the main row |
| Remaining buttons | Hidden under More or always visible |
| Button size | Small, Medium or Large |
| Info | Show/hide and reorder odometer, outside/inside temperature, humidity, fuel level, petrol volume, power status and charging status, when available |
| Custom info tiles | Reorder, add or remove a sensor; set its label and icon, including a Home Assistant icon |

**Defaults:** the separate Charging and Charging costs sections are off. Charging curve is on and is displayed while charging. Use the Charging curve switch here to control its visibility.

## Card Settings → Appearance

| Setting | Available choices |
| --- | --- |
| Image style | Photos or Car View |
| Default Car View | 3/4 or Top |
| Image zoom | Adjust the car image size |
| Aspect ratio | Automatic or a ratio such as 16 / 9 |
| Space around the car | Compact, Standard or Roomy |
| Car View background | Black, Automatic, Morning, Afternoon, Evening or Night |
| Card margins | Normal, Half or None |
| Popup margins | Normal, Half or None |
| On-screen messages | On/off |
| Message position | Up or Down |
| Message duration | 3, 5, 8 or 12 seconds |

The view button changes the view on the device you are using. The default view setting selects the opening view.

## Card Settings → Controls

| Setting | Available choices |
| --- | --- |
| Climate tile | Target with − / +, or Large circle |
| Temperature selector | Wheel or Bar |
| Climate on-mode | HVAC mode used when turning climate on |
| Confirm temperature change while climate is off | On/off |
| Action confirmations | Choose confirmation for Lock, Unlock, Open windows, Open trunk, Climate, Lights, Horn, Locate and Refresh data |

## Card Settings → Charging

| Setting | Available choices |
| --- | --- |
| Charging details style | Line, Text, Large or At the port |
| Charging effect | Cable flow + port pulse, cable flow, port pulse, light sweep or None |
| Energy sheet on the tile | Open energy history when tapping the Energy tile |
| Alternate charging text | Alternate Charging now and reported time left |

The image’s charging details remain visible when the separate Charging section is hidden. The charging-curve switch is in **Layout → Sections**.

## Card Settings → Colours

| Setting | Available choices |
| --- | --- |
| Bottom tile icons | Green, Grey, Blue or a custom colour |
| Cool airflow | Colour and upper temperature limit |
| Mild airflow | Colour and upper temperature limit |
| Warm airflow | Colour above the mild limit |
| Level colours | Red, Orange, Yellow and Green |
| Battery thresholds | Three percentage boundaries for the four level colours |
| Fuel thresholds | Three percentage boundaries for the four level colours, on hybrids |

## Card Settings → Diagnostics & tyres

| Setting | Available choices |
| --- | --- |
| Diagnostic indicators | Enable/disable individual available warning indicators |
| All / None | Enable or disable the diagnostic selection together |
| Tyre unit | bar, kPa or psi |
| Pressure check | From the vehicle, My own limits or Both |
| Minimum / Maximum pressure | Custom limits in the selected unit |

Built-in indicators include Airbag, ABS, Brakes, Brake fluid, 12V battery, Low traction battery, Power system, Power limited, Power steering, Tyre pressure, the four individual tyre alarms and Key battery.

New warning sensors and custom diagnostic indicators are managed in Advanced.

## Card Settings → Advanced

| Setting | What you can change |
| --- | --- |
| Card name | Name shown on the card |
| Entity prefix | Vehicle entity prefix |
| Vehicle type | Automatic, Plug-in hybrid or Electric |
| Paint colour | Black, blue, grey, silver or white |
| Wheels | 20-inch with covers, 20-inch without covers or 18-inch Pro |
| Battery capacity | Automatic capacity or a kWh override, when Energy history is enabled |
| Ask for a charging profile after at least (%) | Minimum battery gain a finished charge needs before the Charging detected reminder appears. 0–100, default 3; 0 asks after every charge that adds battery. Shared by all cards of the vehicle |
| Recent charges checked for the reminder | How many of the latest charges the reminder looks at, so earlier unanswered charges are still offered. 1–20, default 10 |
| Ignore one-off battery jumps above (%) | A single battery reading this many percent above the charge so far is ignored until the next reading confirms it, so one wrong reading cannot inflate a charge. 5–50, default 20 |
| Refresh the charging curve every (min) | While charging, the curve's line follows the latest car report. When the car reports nothing new, the line still moves to the current time this often. 1–60, default 5 |
| Full-tank fuel range | Automatic 940 km for hybrids, or a positive override |
| Tank capacity | Automatic sensor value/51 L fallback, or a litres override |
| Hero photos folder | Automatic image folder or a custom folder |
| State-specific photos | Replace individual available vehicle-state images and check their previews |
| New sensors | Discover, add, add all, ignore or restore ignored diagnostic suggestions |
| My diagnostics | Reorder, add or remove custom entities; choose their labels and icons |
| Entity mapping | Choose a sensor role, select its HA entity and add/remove the mapping |

Empty numeric fields display the default as a hint. Enter your own value to override it. Clearing an override restores the default. For hybrid range and tank capacity, 0 selects automatic values.

## Card Settings → Live preview

- **Preview state:** Live, Parked, Plugged in, AC charging, DC charging, Charge complete, Alerts, Doors & boots open or Climate on.
- **Allow clicks:** enable or disable preview interaction.
- **View switch:** top or 3/4 view, using the same card control.
- **Live mode:** uses vehicle data; enabled controls can operate the vehicle.
- **Simulated modes:** use demo states and keep commands inside the preview.

## Charging Profiles → Locations

| Setting | What you can change |
| --- | --- |
| Location name | Name shown on charges |
| Free charging | Zero-cost charging; hides paid fields |
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

## Notifications

The **Notifications** page contains the integration’s notification controls:

- Master on/off switch.
- Mobile App recipients.
- Basic, Recommended and All presets.
- Quiet hours: enable, start/end times and Silent/No notification behaviour.
- Individual alert enable switches.
- Per-alert delay, repeat interval and maximum notifications where available.
- Alert thresholds and relevant away/parked conditions.
- Information, Important or Critical severity.
- Notification icon, title and message, with supported vehicle-value tags.
- Supported action buttons, including Lock vehicle and Dismiss.
- Per-alert reset, preview and test.
- Ignore old data threshold.
- Save and Cancel changes.
- Live notifications (Live charging, Live climate, Left open or unlocked): switches, options, title, icon and tests.
- Where the phone opens when you tap a notification.
- Recent activity pagination, delete and delete all.

Configure alerts, phones, quiet hours and Live notifications on the separate **Notifications** page. Settings need Home Assistant administrator rights: the gear on the card opens the Companion dashboard and is hidden for other users.

See [Notifications](NOTIFICATIONS.md) for each alert, its purpose and full setup steps.

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
- Charging-detected reminders for every unanswered recent charge, oldest first; dismissal applies to one charge and one user, and a reminder clears after assignment elsewhere. The minimum battery gain and the number of recent charges checked are set in Card Settings → Advanced.
- Background notification checks, repeats, quiet hours and stopping reminders after their condition clears or they are dismissed.
- Live charging start/update/end handling from reported charging state.
- Settings updates across cards using the same profile.
- Date and time display using Home Assistant preferences.

## Charging profile names and deletion

In **Charging Profiles**, start typing a network name to see suggestions, or enter any custom name. Choose **Delete profile** inside an expanded profile, confirm, then save. Earlier sessions retain their saved location and cost. **Total paid** in a session selects **Manual charge** automatically.

To test the on-card cost reminder, choose **Charging detected** under **Card Settings → Live preview**, enable **Charging costs** in Layout and turn on **Allow clicks**. The scenario uses sample data and never saves real assignments.

**Independent card blocks:** In Layout → Sections, Charging costs (saved as `charging_cost`) controls the cost block, which disappears from the card when it is off; saved prices, receipts and the Costs dashboard are kept and Charging reminder controls charging-detected assignment reminders. These choices are saved per card profile and do not remove charging history.
