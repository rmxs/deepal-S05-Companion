# User guide

[README](../README.md) · [All settings](SETTINGS.md) · [Notifications](NOTIFICATIONS.md)

## 1. Open Companion

1. Open **Deepal Companion** from the Home Assistant sidebar. For just the card, open **Deepal Card** (`/deepal-companion-card`) instead; it shows the profile you last chose in Card Settings. On a phone it fills the whole screen; on a computer it stays a normal card. To show it in the sidebar, turn on **Show “Deepal Card” in the sidebar** under **Card Settings → Advanced** (off by default).
2. Choose your vehicle if you have more than one configured.
3. Use the four pages at the top:
   - **Card Settings** — customise the dashboard card.
   - **Notifications** — choose phone alerts and Live notifications.
   - **Sessions** — browse charging sessions, curves and costs.
   - **Charging Profiles** — set up charging locations and prices.

The selected page is kept in the URL, so refreshing returns you to it.

## 2. Choose and name a card profile

1. Open **Card Settings → Profile** and use the arrow at the right of its header to open it. The badge shows whether Deepal Alternative is connected (**Active**, **Offline** or **No data**).
2. Open the arrow in **Card profile** to select a profile.
3. To rename it, edit the name in that same field and leave the field or press Enter.
4. Use **Duplicate** to copy a profile, **New profile** to start another, or **Delete** to remove one.
5. Under **Card design**, choose the **Design style**: Profile default, **Mobile**, **Tablet** or **Energy**.
6. Leave **Max width** at 0 for automatic, or enter a width in pixels.

Each dashboard card selects a profile. You can use a compact mobile profile and a wider tablet profile for the same vehicle. Charging history and charging locations remain shared.

## 3. Arrange the card

1. Open **Card Settings → Layout**.
2. Under **Sections**, switch sections on or off.
3. Drag a section, or use its up/down buttons, to change its position.
4. Under **On the image**, choose the name, plate, range, cloud connection and update details to show.
5. Arrange the top-right buttons and main control buttons.
6. Choose the control button layout, labels, size and main-row count.
7. Choose the information tiles you want below the main card content.
8. Drag the Info rows, or use their up/down buttons, to set their order.
9. Use the same controls to arrange your custom information tiles.

New/reset profiles use this section order: Vehicle image → Control buttons → Status → Charging → Charging curve → Temperature & battery → Info → Charging costs. The separate **Charging** and **Charging costs** sections start off; **Charging curve** starts on and appears while charging.

The charging text on the vehicle image is configured separately in **Card Settings → Charging**.

## 4. Check the preview

1. Select **Preview state → Live** to see current vehicle data.
2. Try **Parked**, **Plugged in**, **AC charging**, **DC charging**, **Charge complete**, **Alerts**, **Doors & boots open** or **Climate on** to check those appearances.
3. Enable **Allow clicks** to interact with the preview.
4. Use the view button on the image to switch between top and 3/4 views.
5. Return to **Live** when finished.

Simulated states use the same card display with example vehicle readings. Demo commands stay in the preview. With **Live** and **Allow clicks** selected, controls can send commands to your vehicle.

### Read the card status

- **Data age:** the small badge on the refresh button shows how old the vehicle data is (now, 1m, 3m, 1h …). It turns yellow after 2 hours and red after 4 hours. Turn it off with **Card Settings → Layout → On the image → Last update**.
- **Lock line:** the car’s cloud is read about every 5 minutes and an unlock lasts only seconds, so the exact lock time cannot always be known. While the engine or power is on, the card shows **In use** instead of a lock state, because the car may lock itself while driving. If the car was driven since the last lock change (the engine turned off, or the odometer changed), it shows **Locked after 21:14** instead of a time it cannot know. Otherwise it shows **Locked at …**.
- **Settings gear:** the gear at the bottom right of the image opens the Companion dashboard. It is shown to Home Assistant administrators only. Turn it off with **Card Settings → Layout → On the image → Settings button**.

## 5. Change the look

1. Open **Card Settings → Appearance**.
2. Choose **Photos** or **Car View**, and select the default view.
3. Adjust image zoom, aspect ratio and space around the car.
4. Choose a plain background, an automatic day/night background, or a fixed time of day. Morning and afternoon show a deeper blue sky that suits the dark theme, the evening shows a dusk sky, and the night keeps the moon and stars.
5. Set margins and on-screen messages.
6. Open **Card Settings → Colours**. Choose Green, Grey or Blue tile icons, or select **Custom** and pick a colour. Set airflow colours and battery/fuel level colours here too.
7. Open **Card Settings → Advanced** to change paint, wheels or custom photos.

Card appearance changes update the preview as you work. Check the save feedback before leaving a page. Where **Save** and **Cancel changes** are shown, save to keep edits or cancel to return to the saved values.

## 6. Use vehicle controls

1. Tap a control on the card, such as lock, windows, tailgate or climate.
2. Confirm the action if asked.
3. Check the card’s response message and the next vehicle update.
4. Open climate, cabin or tyres for the detailed controls and readings.

Every command that asks first (lock, unlock, windows, trunk, climate, lights, horn, locate and refresh) uses the same window as the lock on the car image: the current state, **Cancel** and **Confirm**, with the question underneath. To change which commands ask, open **Card Settings → Controls**. That menu also contains climate tile style, temperature selector and climate-on mode. Available actions depend on your vehicle entities.

## 7. Set up a charging location

1. Open **Charging Profiles**.
2. Expand a location, such as **Home** or **Work**, or choose **Add location**.
3. Enter its name. Start typing to choose a suggested charging network, or enter your own name. Suggestions do not set a tariff.
4. For a free location, enable **Free charging**.
5. For a paid location, enter the **€/kWh** price.
6. Choose its energy source:
   - **Battery estimate** — use the battery level increase and the configured charging efficiency.
   - **Total energy meter** — select the charger’s cumulative energy sensor.
   - **Session energy meter** — select the charger’s session energy sensor.
   - **Charger power** — select the charger’s power sensor.
7. Select the matching entity if the source needs one.
8. Set charging efficiency when using battery estimates. The field is also shown for free profiles, because it still sets the estimated kWh of those charges.
9. Choose **Save profiles**.

Each location can use a different charger sensor. Energy sensors use Wh or kWh; power sensors use W or kW. Choose a total or session energy meter rather than a daily energy meter.

Home, Work, Free, Ionity and Public are provided as starting locations. Work and Free start as free charging. Set the other tariffs before using them.

### Delete a charging profile

1. Expand the profile in **Charging Profiles**.
2. Choose **Delete profile** and read the confirmation.
3. Confirm deletion, then choose **Save profiles**.
4. Use **Cancel changes** before saving if you want to restore it.

Existing charging sessions and their saved costs remain unchanged. You can delete all profiles and continue recording one-off manual charges.

Charges linked to a deleted profile show a **Profile removed** icon beside their saved location. Select it to choose another profile, then save. Cancel keeps the original location and cost. Manual charges do not show this warning.

Suggested network names include Zunder, Iberdrola | bp pulse, Repsol, Wenea and Atlante for Spain; Plenitude On the Road, Ewiva, Free To X and A2A E-moving for Italy; and PPC blue, incharge, EKO Charge & Go, Blink Charging, EV Loader and Electrip for Greece. IONITY and Tesla Supercharger are included too. You can always use your own name and tariff.

## 8. Assign a cost to a charge

1. Open **Sessions** and find the charging session.
2. Choose **Edit charge**.
3. Select its charging location.
4. For a receipt or a one-off charge, open **Receipt or manual correction**.
5. Enter a price per kWh, measured energy, total paid or free charging as appropriate.
6. Save the charge.

You can enter a one-off payment without creating a location. Entering **Total paid** automatically selects **Manual charge (no profile)** and clears the free-charging selection. A total payment overrides the calculated amount. **Not priced** means a price has not been assigned; **Free charging** means zero cost. Changing a location’s tariff does not reprice charges already assigned to it.

If a **Charging detected** reminder appears on the card, select a profile and assign it, open charging costs, or dismiss it until the next charge. Assigning the cost from the Sessions page clears the reminder too. Enable **Card Settings → Layout → Sections → Charging reminder** to show these reminders. **Charging costs** controls the separate cost block. Either block can stay off while the other is on; your saved sessions and costs are kept.

### Test the charging-detected reminder

1. Open **Card Settings → Layout → Sections** and enable **Charging reminder**. Charging costs can stay off.
2. In **Live preview**, select **Charging detected**.
3. Enable **Allow clicks**.
4. Choose a sample profile and select **Assign**, or try **Dismiss until next charge**.
5. Switch to another preview state and back to reset the demo.

Preview actions do not save costs, dismiss real reminders or send vehicle commands. The sample profiles and prices are demonstration values.

On the real card, the reminder needs a finished charge that added at least the minimum set in **Card Settings → Advanced → Ask for a charging profile after at least (%)** (3 percentage points by default), without a data gap, and no location assigned. A charge that is still in progress does not ask. If you missed several charges, they are offered one at a time, oldest first, among the latest charges set in **Recent charges checked for the reminder** (10 by default). It is an on-card reminder. Assigning a location from Sessions clears it; dismissing a charge hides only that charge, for that user, and the next unanswered charge is shown.

**Ignore one-off battery jumps above (%)** (default 20) protects the recorded charge: a single battery reading far above the charge so far is ignored until the next reading confirms it. A real fast jump is counted as soon as one more reading agrees.

## 9. Browse sessions and charts

1. Open **Sessions**.
2. Choose **All locations**, **Not set**, or an individual location.
3. Choose newest/oldest first or highest/lowest cost.
4. Select **Grid** or **Table**.
5. Use **Load more** to fetch the next six sessions.
6. Change the chart period (it opens on the weekly view) and use its arrows to browse earlier dates.
7. Hover over or touch a chart or a bar to inspect its values.

Under the header, four figures follow the chart period: **Energy from charger**, **Charging cost**, **Paid price** per kWh and the **Free charging** share of energy. The boxes in the header show all-time totals. In each session card the bar spans only the battery levels the charge covered, and the pencil edits the charge.

Filtering and sorting apply to the saved archive, including sessions that have not been loaded on screen. The grid shows three cards per row on wide screens, two on medium screens and one on phones.

The card’s **Energy** view also includes weekly/monthly history, daily distance and estimated consumption, charges and cost assignments. Enable **Card Settings → Charging → “Energy” sheet on the tile**, then tap the Energy tile to open it.

In the costs dashboard, the energy total is labelled **Energy from charger**. It includes charging losses, so it is higher than the *Energy added to battery* sensor. A charge that loses its car connection for a while stays one session. If the car never reports again, the charge closes after 6 hours at its last known reading.

## 10. Open a charging curve

1. In **Sessions**, select the curve icon next to **Edit charge**.
2. In the card’s **Energy → Charges** list, choose **Curve** beside a charge.
3. Tap, drag or hover along the graph to inspect a recorded reading.
4. With a keyboard, focus the graph and use the arrow keys, Home or End.
5. Check **Low** and **High** for the charging-current range.
6. Close the popup using its X button or Escape.

Curves use amps over time and fit the recorded charging interval. Dots mark changed readings. Battery percentages appear below the time axis when battery readings are available. The final zero reading marks the charging stop; Low/High describe the active charging current.

To display the current charge on the main card, enable **Card Settings → Layout → Sections → Charging curve**. It appears while charging. Saved curves remain available from each archived charge when readings were captured or imported.

Dots on the curve mark the moments the charging current changed. While the car charges, the line continues from the last dot to the current time and battery level, so a steady current still shows progress. If the car reports nothing new, the line is refreshed every few minutes (**Card Settings → Advanced → Refresh the charging curve every (min)**, default 5).

### Correct or delete a charge (administrators)

Open the charging curve from **Sessions**; the tools under the graph let you:

1. **AC / DC** – change the charge type when it was recorded wrongly, for example a false DC reading at the end of an AC charge.
2. **Remove readings** – switch it on, then drag across the graph to choose a time range. The charging-current readings in that range are removed from every curve. Battery readings are kept. This cannot be undone.
3. **Delete charge** – removes the charge from the lists, totals, charts and export.

A deleted charge is kept for 30 days under **Data options → Deleted charges**, where **Restore** brings it back. After 30 days it is removed for good, together with its receipt. The bin icon next to a session does the same as **Delete charge**. A deleted charge is not brought back by **Import older Recorder charges**.

## 11. Keep and recover history

1. Open **Sessions** to load available older Recorder charges into Companion.
2. If an older session is missing, open **Data options → Import older Recorder charges**.
3. Reopen the session and check its curve.
4. Use **Data options → Database backup** regularly.

Saved sessions, prices and charging readings remain in Companion’s archive after Home Assistant Recorder purges its history. Older readings that were already deleted before import cannot be recovered. Historical sensor charts can contain gaps where neither source has readings.

### Archive storage

- Recent readings stay available directly; dense sensor history older than 30 days is compressed automatically in small background batches.
- Compression keeps the original timestamps, states and units. Sessions, saved costs and captured curves have no automatic expiry.
- Retained history still uses disk space over time. Integration diagnostics include archive size and stored-reading counts.
- On an existing database, freed space can be reused by future records even if the file does not immediately become smaller.
- Download a database backup before replacing or downgrading the integration. Keep Home Assistant backups too.

## 12. Set up notifications

1. Open **Notifications**.
2. Select your phones under **Devices to notify**.
3. Choose a preset and review the alerts.
4. Send a test and confirm it reaches the phone.
5. Configure quiet hours and save.
6. Follow the [notification guide](NOTIFICATIONS.md) to customise individual alerts and enable Live notifications.

## 13. Check that everything works

Open the **Health** tab in Companion. It lists the vehicle sensors, the charging recorder, the database, notification devices, the last notification and charging prices, each marked OK, Warning or Error. A problem says what is wrong and what to do. The page only reads; it never changes settings or sends a notification.

In **Notifications**, choose **Why isn’t it sending?** on an alert to see why it is or is not being sent right now: switches, condition (each part with its current value), delay, send limit, repeat, quiet hours and devices. Tap **?** beside a line to learn what the sensor is and when it changes.

The notifications button on the card shows a red number for alerts you have not opened yet. It is saved per Home Assistant user and clears when you open the list.

## Saved settings and updates

Your card profiles, notification preferences, charging locations and saved sessions are stored in Home Assistant and retained during updates. The dashboard remembers the selected card profile in your browser for your Home Assistant account. After changing Notifications, choose **Save Changes** and wait for the confirmation before leaving.
