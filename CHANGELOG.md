# Changelog

## 0.1.2 — Charging profiles and reminder preview

- Delete charging profiles with a confirmation and preservation notice; earlier charging sessions and saved costs stay intact.
- Keep deleted presets removed after reload, including an empty profile list.
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
