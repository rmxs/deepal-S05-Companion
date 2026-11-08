<p align="center"><img src="docs/images/header.png" alt="Deepal Companion: the card standing on a stage" width="100%"></p>

# Deepal Companion

Your Deepal S05 in Home Assistant: vehicle controls, a customisable dashboard, charging sessions, energy history, costs and phone alerts.

Deepal Companion works with [**Deepal Alternative**](https://github.com/Sunek0/ha-deepal-alternative) (`deepal`) for electric and plug-in hybrid vehicles. Install it as an **integration through Home Assistant Marketplace** (HACS on earlier Home Assistant versions). The Companion dashboard and Lovelace card are included in the same package.

[Installation](docs/INSTALLATION.md) · [User guide](docs/USAGE.md) · [All settings](docs/SETTINGS.md) · [Notifications and Live notifications](docs/NOTIFICATIONS.md) · [Changelog](CHANGELOG.md)

<p align="center"><img src="docs/images/showcase.png" alt="Deepal Companion: live notifications, notifications, charging curve, charging costs and charging networks" width="100%"></p>

## Latest release — v0.1.4

- **Live notifications** on the Lock Screen for charging, climate and left-open doors, each with its own settings page.
- New charging alerts: started, almost finished and reached target.
- A notifications popup on the card, a data-age badge on the refresh button, a clearer lock status and a round Settings gear on the image.
- A Health tab that checks sensors, the recorder, the database, notification devices and prices.
- Saving from two devices now merges both sets of changes instead of losing one.

[Release notes](https://github.com/rmxs/deepal-S05-Companion/releases/tag/v0.1.4) · [Full changelog](CHANGELOG.md)

## Release highlights

- **Live notifications:** keep **Live charging**, **Live climate** and **Left open or unlocked** on your phone’s Lock Screen with iPhone Live Activities or Android Live Updates. Each has its own settings page and follows the car’s reported readings, even while the dashboard is closed.
- **Clearer card status:** the age of the vehicle data sits on the refresh button, the lock line says **In use** while the engine runs, and the Settings gear sits on the image.
- **Saved charging curves:** inspect current readings, charging time and recorded battery percentages for each session. Captured curves stay in Companion’s archive alongside the charge and its cost.
- **Charging networks for Spain, Italy and Greece:** when you name a charging profile, pick a ready-made network such as Zunder, Iberdrola | bp pulse, Plenitude On the Road, PPC blue or EKO Charge & Go, or type your own name and tariff.
- **Charging expenses:** organise Home, Work, Public and custom locations, set tariffs or free charging, enter receipt totals and review your charging energy and costs in session cards and charts.

## Gallery

### Your card

<table>
<tr><td width="50%"><img src="docs/images/feature-vehicle-overview.png" alt="Your whole car on one card"></td><td width="50%"><img src="docs/images/feature-battery-range.png" alt="Range, battery and fuel"></td></tr>
<tr><td width="50%"><img src="docs/images/feature-controls-state.png" alt="Buttons that show the state"></td><td width="50%"><img src="docs/images/feature-climate.png" alt="Climate controls"></td></tr>
<tr><td width="50%"><img src="docs/images/feature-tyres-warnings.png" alt="Tyre pressure and warnings"></td><td width="50%"><img src="docs/images/feature-diagnostics.png" alt="Diagnostic warnings"></td></tr>
</table>

### Car view and interior

<table>
<tr><td width="50%"><img src="docs/images/presentation-car-colour.png" alt="Car colours"></td><td width="50%"><img src="docs/images/presentation-climate.png" alt="Cabin climate"></td></tr>
<tr><td width="50%"><img src="docs/images/presentation-seats.png" alt="Seat heating and ventilation"></td><td width="50%"><img src="docs/images/presentation-custom.png" alt="Custom sensors and buttons"></td></tr>
</table>

### Charging and costs

<table>
<tr><td width="50%"><img src="docs/images/feature-charging.png" alt="Charging on the card"></td><td width="50%"><img src="docs/images/presentation-charging.png" alt="Assign a charging profile"></td></tr>
<tr><td width="50%"><img src="docs/images/presentation-curve.png" alt="Saved charging curve"></td><td width="50%"><img src="docs/images/presentation-live-curve.png" alt="Live charging curve"></td></tr>
</table>

### Live notifications and alerts

<table>
<tr><td width="50%"><img src="docs/images/presentation-live-iphone.png" alt="iPhone Live Activity"></td><td width="50%"><img src="docs/images/presentation-live-android.png" alt="Android Live Update"></td></tr>
<tr><td width="50%"><img src="docs/images/presentation-notifications.png" alt="Choose your alerts"></td></tr>
</table>

### Control panel

<table>
<tr><td width="50%"><img src="docs/images/control-panel-feature.png" alt="Set up the card and see it live"></td><td width="50%"><img src="docs/images/feature-panel-layout.png" alt="Layout settings"></td></tr>
<tr><td width="50%"><img src="docs/images/feature-panel-advanced.png" alt="Vehicle setup and sensors"></td><td width="50%"><img src="docs/images/feature-panel-charging-profiles.png" alt="Charging profiles"></td></tr>
</table>

## How it started

Deepal Companion started as a personal project: a Home Assistant card I made for my own Deepal S05. I wanted a place to see the car’s status, use its controls and make the dashboard feel like something designed for the car.

As I used it, the project grew. A card became a companion for everyday things: checking the battery, looking back at charging sessions, keeping track of charging costs and getting an alert when the car needed attention. I decided to share it so other Deepal owners could use it and make it their own.

This release is the next step in that journey. More features and improvements will come as the project develops. Ideas, feedback and real-world experiences from other owners are welcome through [GitHub Issues](https://github.com/rmxs/deepal-S05-Companion/issues).

Made for my car, shared for yours.

## Features

### Your vehicle

- Lock, windows, tailgate, climate, lights, horn and locate controls, where supported by your vehicle entities.
- Battery and fuel levels, electric and fuel range, odometer, temperatures and humidity.
- Climate temperature controls, seat heating and ventilation, and steering-wheel heating where available.
- Tyre pressures in bar, kPa or psi, with vehicle warnings and adjustable pressure limits.
- Vehicle diagnostics, selectable warning indicators and custom sensor tiles.
- Car View with five paint colours, three wheel choices, and 3/4 or top views.
- Vehicle images that reflect doors, windows, bonnet, tailgate, lights and charging state.

### Make the card your own

- Mobile, Tablet and Energy designs with adjustable width.
- Independent card profiles with editable names, duplication and profile management.
- Show, hide and reorder card sections, control buttons, top-right buttons and information tiles.
- Reorder user-added information tiles and diagnostic entities.
- Choose button layouts, sizes, labels and action confirmations.
- Select Photos or Car View, backgrounds, image zoom, spacing, aspect ratio and custom photos.
- Green, Grey and Blue tile icon presets, plus a custom colour picker.
- Custom airflow colours, battery/fuel colours and percentage thresholds.
- Interactive preview with live data and simulated vehicle states, including a charging-detected reminder demo.
- Settings updates shared between Companion and cards using the same profile.
- Add to dashboard button and visual Home Assistant card editor.
- English interface with Greek and Spanish translations on supported screens.

### Charging, energy and costs

- Automatic charging-session recording while dashboards are closed.
- A permanent charging archive containing sessions, saved prices and available charging curves.
- Weekly and monthly battery/fuel history with previous-period navigation.
- Daily distance, charged energy, estimated battery use and estimated petrol use.
- Smooth charging-current curves with changed-reading dots, touch/keyboard inspection, Low/High current and battery percentages when recorded.
- Optional on-card charging curve while charging.
- Charging details, cable flow, charge-port pulse and light-sweep effects.
- Charging locations with individual tariffs, free charging and optional charger entities.
- Searchable charging-network name suggestions, custom names and profile deletion that preserves saved charges.
- Energy calculation from battery estimates, total energy meters, session energy meters or charger power.
- Per-session location, price per kWh, measured energy and total-payment editing.
- Euro cost totals and energy/cost charts with historical date navigation.
- Grid and table views, location and Not set filters, and date/cost sorting across the archive.
- Six sessions fetched per page, with up to three cards per row on wide screens.
- Charging-detected reminders with location assignment or dismissal until the next charge.
- Import of available Home Assistant Recorder sessions and charging readings.
- JSON export and database backup.

### Notifications

- Background alerts that work while the card and dashboard are closed.
- Fifteen alert types covering charging, security, openings, tyres, vehicle warnings, battery, fuel, climate, comfort functions and connection loss.
- Recipients selected from your Home Assistant Mobile App devices.
- Basic, Recommended and All presets.
- Quiet hours, alert delays, repeat intervals and maximum notification counts.
- Configurable thresholds and supported away-from-home or parked conditions.
- Information, Important and Critical severity.
- Editable titles, messages and icons, with vehicle-value tags and message previews.
- Supported action buttons, including Lock vehicle and Dismiss.
- Test notifications and recent activity with Load more, Delete and Delete all.
- Live charging, Live climate and Left open or unlocked as Live Activities on iPhone and Live Updates on supported Android devices.

## Live notifications on your phone

> [!IMPORTANT]
> **Keep the car on your Lock Screen.** Open **Deepal Companion → Notifications**, select your receiving phone and open one of the three **Live notifications**: **Live charging**, **Live climate** or **Left open or unlocked**. Turn on **Alert enabled**, adjust the options and use **Send test** to check your phone. iPhone Live Activities and Android Live Updates keep working while the dashboard is closed.
>
> Updates follow the car’s reported readings. These settings control notification updates; vehicle polling is configured in your vehicle integration, and the car’s cloud is read about every 5 minutes.
>
> Live notifications require **Home Assistant 2026.7.0 or newer**, a compatible Companion App, and **iOS/iPadOS 17.2+** or **Android 16+**. [Full setup and test instructions](docs/NOTIFICATIONS.md#live-notifications-on-the-lock-screen).

## Requirements

- Home Assistant **2026.3.0 or newer**.
- [**Deepal Alternative**](https://github.com/Sunek0/ha-deepal-alternative), configured with your vehicle and its entities enabled.
- **Marketplace** on Home Assistant 2026.11 or newer, or **HACS** on earlier supported versions.
- The **Home Assistant Companion App** for phone notifications.
- Administrator access for integration setup and notification configuration.

Available controls and readings depend on the entities supplied by your vehicle integration.

## Install through Marketplace

1. Open **Settings → Marketplace → Add from link**.
2. Enter `https://github.com/rmxs/deepal-S05-Companion`, choose **Add**, and connect GitHub if prompted.
3. Open **Deepal Companion** and select **Install**. Follow any restart prompt.
4. Open **Settings → Devices & services → Add integration → Deepal Companion**.
5. Select your vehicle and confirm its name, detected type, paint colour and wheels.
6. Open **Deepal Companion → Card Settings** in the sidebar.
7. Choose a profile, select **Add to dashboard**, and choose your dashboard and view.

On Home Assistant versions before 2026.11, use **HACS → ⋮ → Custom repositories**, add the same repository as an **Integration**, download it and restart Home Assistant before setup.

[Detailed installation, manual setup and updates](docs/INSTALLATION.md).

## Find your settings

The dashboard has four main pages: **Card Settings → Notifications → Sessions → Charging Profiles**.

| Open | What you can configure |
| --- | --- |
| **Card Settings → Profile / Card design** | Profile name, Mobile/Tablet/Energy design and maximum width |
| **Card Settings → Layout** | Section order and visibility, buttons, information tiles and items on the vehicle image |
| **Card Settings → Appearance** | Image style, view, background, zoom, spacing and on-screen messages |
| **Card Settings → Controls** | Climate controls, temperature selector and action confirmations |
| **Card Settings → Charging** | Charging text, visual effects and Energy-tile behaviour |
| **Card Settings → Colours** | Tile icon presets/custom colour, airflow colours and battery/fuel thresholds |
| **Card Settings → Diagnostics & tyres** | Warning indicators, tyre units and pressure limits |
| **Card Settings → Advanced** | Vehicle type, paint, wheels, capacities, custom photos, sensor mapping, custom diagnostics and configuration backup/reset |
| **Notifications** | Devices, alerts, timing, messages, quiet hours, Live notifications, tests and recent activity |
| **Sessions** | Charging history, costs, curves, filters, sorting, charts and data options |
| **Charging Profiles** | Charging locations, tariffs, free charging, energy sources and charger sensors |

For every available option, see the [settings reference](docs/SETTINGS.md). For practical tasks, follow the [step-by-step user guide](docs/USAGE.md).

## Your charging archive

Sessions, saved cost assignments and captured charging readings are stored in Companion’s database. They remain available after Home Assistant Recorder purges its history.

Older sensor readings are compressed automatically without discarding their values. Saved history continues to grow as you use the car, so keep database backups and allow space for the archive.

Use **Sessions → Data options** to import available Recorder charges, export JSON or download a database backup. Battery-based energy and fuel consumption figures are estimates. Charging curves depend on recorded current readings.

## Help

- [Installation and updates](docs/INSTALLATION.md)
- [Step-by-step user guide](docs/USAGE.md)
- [Complete settings reference](docs/SETTINGS.md)
- [Phone alerts and Live notifications](docs/NOTIFICATIONS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Report an issue](https://github.com/rmxs/deepal-S05-Companion/issues)

## Support the project

If you enjoy using Deepal Companion, you can [buy me a coffee](https://buymeacoffee.com/leftk) to support the time I spend on the project. Support is optional, and every feature is available to everyone.

<a href="https://buymeacoffee.com/leftk"><img src="custom_components/deepal_companion/frontend/support/buy-me-a-coffee.png" alt="Buy me a coffee" width="157" height="44"></a>

## Credits and licence

Vehicle Car View images are adapted from [DEC Deepal](https://github.com/manuelem1984/dec_deepal), by Comunidad Deepal España (DEC) / manuelem1984. Thank you for sharing this work with the Deepal community.

Deepal Companion code is licensed under the [GNU General Public License v3.0](LICENSE). The DEC Deepal vehicle images and other third-party assets retain their original licences and notices; see [Third-party notices](THIRD_PARTY_NOTICES.md).

Unofficial project. Not affiliated with Deepal or Changan.

Made with ♥ in Greece · L.K.
