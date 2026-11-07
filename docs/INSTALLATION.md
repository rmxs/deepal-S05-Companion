# Installation

[README](../README.md) · [User guide](USAGE.md)

## Before you start

1. Install and configure [**Deepal Alternative**](https://github.com/Sunek0/ha-deepal-alternative) in Home Assistant.
2. Confirm that your vehicle’s battery sensor and other entities appear in **Settings → Devices & services**.
3. Sign in to Home Assistant as an administrator.

## Install through Marketplace — Home Assistant 2026.11+

1. Open **Settings → Marketplace** as an administrator.
2. Select **Add from link** at the top right.
3. Enter `https://github.com/rmxs/deepal-S05-Companion` and select **Add**.
4. Connect GitHub when prompted. If a content type is requested, choose **Integration**.
5. Open **Deepal Companion** and select **Install**.
6. Restart if Home Assistant asks you to, then continue with **Set up your vehicle** below.

[Official Marketplace instructions](https://www.home-assistant.io/integrations/marketplace/#custom-repositories).

## Install through HACS — earlier supported versions

1. Open **HACS → ⋮ → Custom repositories**.
2. Add `https://github.com/rmxs/deepal-S05-Companion` as an **Integration**.
3. Find **Deepal Companion** and choose **Download**.
4. Restart Home Assistant, then continue below.

## Set up your vehicle

1. Open **Settings → Devices & services → Add integration**.
2. Search for **Deepal Companion**.
3. Select the detected vehicle if a list appears.
4. Confirm its name and detected **Electric / Plug-in hybrid** type.
5. Choose paint colour and wheels, then complete setup.
6. Open **Deepal Companion** in the sidebar.

Paint, wheels and vehicle type can be changed later in **Card Settings → Advanced**. Hybrid defaults are **940 km** full-tank range and **51 L** tank capacity; setup does not ask you to enter them.

## Add the card to a dashboard

1. Open **Deepal Companion → Card Settings**.
2. Select the card profile you want to use.
3. Choose **Add to dashboard** near the top of the page.
4. Select the destination dashboard and view, then confirm.
5. Open that dashboard and check the card.

You can also use **Dashboard → Edit → Add card → Deepal Companion**, then select the vehicle and profile in the visual editor.

## Manual installation

1. Download the project’s release archive.
2. Extract it and find `custom_components/deepal_companion`.
3. Copy that folder into Home Assistant’s `/config/custom_components/` directory.
4. Check that `/config/custom_components/deepal_companion/manifest.json` exists.
5. Restart Home Assistant.
6. Follow **Set up your vehicle** above.

The card is bundled and registered by Companion. A separate frontend download or Lovelace resource entry is not required.

## Update Companion

1. Install the update from **Settings → Marketplace → Deepal Companion**. On earlier versions, use **HACS → Deepal Companion**.
2. Restart Home Assistant.
3. Fully reload the browser or reopen the Home Assistant app.
4. Open Companion and check your card and notifications.

For manual updates, replace the `deepal_companion` component folder with the new release, then follow steps 2–4.

## Back up your data

1. Open **Deepal Companion → Sessions**.
2. Open **Data options** at the bottom.
3. Choose **Database backup** and save the file.
4. Use **Export JSON** if you also want a readable copy of the archive.

Keep Home Assistant backups as well. Companion’s archive is stored in `/config/.storage/deepal_companion.sqlite`.
