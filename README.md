# Argyrios and Tomislav — Skansen version

Alternative wedding invitation for **Swedenborgs lusthus, Skansen, 5 June 2027**. All guests are invited to the ceremony. The ceremony time is still to be confirmed; dinner remains at 18:00 with venue to be announced.

This version is on `skansen-ceremony` in `argyrisker/wedding_invitation`. The original version remains on `main`. Creating this branch does not publish it over the original website.

## Features

Opening envelope, original colour palette, personalised greetings, Swedish/Greek/English/Croatian, interactive story chapters reflecting two years together, ceremony and dinner tabs, calendar download, mobile layout, formal dress code and seven colour swatches, and Google Sheets RSVP.

The Skansen version adds the venue photograph, map, entrance and arrival instructions, a printable Swedish invitation card, and a queue for emails in the guest’s RSVP language. The editable Word card is delivered separately in the task.

## Preview

Run `npm run build`, then `python -m http.server 4173 --bind 127.0.0.1 --directory dist`. Open `http://127.0.0.1:4173/`. This address works only on your computer. Serve the generated `dist` directory when publishing the selected version.

## Personalised links

Add these parameters to the actual published website address:

| Parameter | Meaning |
| --- | --- |
| `lang=sv`, `el`, `en`, `hr` | Guest language |
| `to=Maria` | Guest name in the salutation |
| `g=f`, `g=m`, `g=fp` | Feminine, masculine, or several women; Greek/Croatian grammatical agreement |
| No `g` | Plural/mixed salutation |
| `greet=...` | Exact custom salutation, displayed as literal text |
| `inv=ceremony` | Accepted for older links; all guests can attend the Skansen ceremony |

Example query: `?lang=el&to=Maria&g=f`. Language changes preserve the other guest parameters. Saved replies are isolated from the original version and by guest link. Each RSVP still represents one person and is updated by email address.

## Google Sheets and card emails

The original Apps Script endpoint is retained. The RSVP fields are preserved, with `venueVariant=skansen` added to request card delivery. Existing deployments can save replies but cannot queue cards until updated.

Follow [the installation and activation guide](SKANSEN-SETUP.md). Both `Code.gs` and `EntranceCards.gs` are required for the new feature. Emails stay disabled until the ceremony time is confirmed and an owner test has passed. A saved RSVP is not treated as failed when email delivery is unavailable or uncertain.

No live guest emails or Google Sheet test rows were sent during development. The local tests mock Google services; deployment permissions and the actual Google PDF require the owner test described in the guide.

## Editing and checks

Core translations: `assets/js/i18n.js`. Interactive and entrance translations: `assets/js/editorial-i18n.js`. Ceremony time: `assets/js/config.js` and the matching setting in `google-apps-script/EntranceCards.gs`. Keep both values synchronized.

Layout: `index.html`, `assets/css/editorial.css`, `assets/css/interactive.css`, `assets/css/mobile.css`. Printable card: `assets/entrance-card.html`. RSVP and interactions: `assets/js/app.js`, `assets/js/editorial.js`.

Run `npm test` and `npm run build`. The tests cover RSVP, localisation, personalization, interactions, calendar and card delivery failure/retry cases. The build validates translations, scripts and assets. Site browser visual testing has not been performed; the Word card was rendered and inspected.

Photograph and illustration credits are in [assets/img/CREDITS.md](assets/img/CREDITS.md). [Skansen’s wedding and entrance guidance](https://www.skansen.se/se-och-gora/boka-en-upplevelse/brollop/borgerlig-vigsel/) is the source for arrival information.
