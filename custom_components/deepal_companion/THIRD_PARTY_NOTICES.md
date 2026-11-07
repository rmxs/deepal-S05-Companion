# Third-party notices

Deepal Companion code is distributed under GPL-3.0-only. Third-party assets retain the licences listed below.

## Vehicle layer images (`custom_components/deepal_companion/frontend/images/iso`, `custom_components/deepal_companion/frontend/images/interior`)

Derived from the **dec_deepal** project (<https://github.com/manuelem1984/dec_deepal>), distributed under the MIT License. Copyright (c) 2026 Comunidad Deepal España (DEC) - manuelem1984. The original licence is included in `licenses/DEC-Deepal-MIT.txt` within the component; upstream notices are preserved in `licenses/DEC-Deepal-upstream-NOTICE.md`.

The upstream project also retains this inherited MIT notice:

```
Copyright (c) 2026 Deepal Alternative contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in the
Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

The Car View layers (`dist/images/iso/<colour>`, front-left isometric view, 750×500) are the original renders of the five colours, converted from PNG to WebP (`tools/build_iso.py`) with one change: the layers of the black car go through the same tone curve (`deepen()` in `tools/build_iso.py`) that darkens shadows and mid-tones and removes the blue cast, leaving highlights and edges as they were; the other colours are unchanged. The red “open window” layers (`dist/images/iso/common/window_*_alert*.webp`) are recoloured copies of the glass layers made by `tools/build_iso.py`. The number plate layer is not used. The translucent charging view (`dist/images/carga`, 750×500: car, grey cable, green cable) comes from the same project (`vista_carga`) and is converted to WebP with `tools/build_carga.py`. The top view (`dist/images/top`, 750×750) comes from `vista_planta`: the project only has the silver paint, so every layer that shows paint (body, bonnet, tailgate, doors, their open states and the door frame of open windows) of the other four colours is a recoloured copy made by `tools/build_planta.py` (glass and shadows untouched; the red warning tint of the open-state layers is kept); only the low beam is used as it is. The interior layers were recoloured to black with `tools/build_layers.py`.

## Vehicle photos (`dist/images/car`)

Images of a black Deepal S05 used as the hero and dashboard images. They were created by the project author with an
AI image generator and are released under the same GPLv3 licence as the project’s own artwork.
They depict a real vehicle model; Deepal and Changan names and designs remain the property of their owners.

## Trademarks

Deepal, Changan and related names are trademarks of their respective owners. This project is independent and
unaffiliated.

## Brand artwork

The Companion car-and-remote icon was generated for this project and is distributed under GPL-3.0-only.

## Interface icons and fonts

- **Font Awesome Free 6.4.0**, Fonticons, Inc.: SVG icons used in the notification interface are licensed under **CC BY 4.0**. The icons are embedded in the generated design module and rendered in the application palette. The full package licence is included in `licenses/Font-Awesome-Free.txt` within the component. Source: https://fontawesome.com/license/free.
- **Inter** and **JetBrains Mono** font assets, distributed through Fontsource: **SIL Open Font License 1.1**. Their copyright and licence notices are included in `licenses/Inter-OFL.txt` and `licenses/JetBrains-Mono-OFL.txt` within the component.

- **Tailwind CSS**, Tailwind Labs, Inc.: generated interface styles include Tailwind CSS under its **MIT** licence. The copyright and licence notice is included in `licenses/Tailwind-CSS-MIT.txt` within the component. Source: https://tailwindcss.com.

## Buy Me a Coffee button

The support button uses Buy Me a Coffee branding from https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png to link to https://buymeacoffee.com/leftk. This third-party branding is not covered by the Companion code licence.
