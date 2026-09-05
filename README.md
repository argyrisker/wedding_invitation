# Argyrios & Tomislav — 5 June 2027

An editorial redesign of [the original invitation](https://github.com/argyrisker/invitation), built independently in **invite_new**. The original repository is untouched.

Preserved: opening envelope, navy/cream/gold/brick/Aegean palette, Swedish/Greek/English/Croatian, personalised greetings, ceremony variants, countdown, dietary choices, hometown emblems, contact link and Google Sheets RSVP integration.

The revised invitation tells your story in three chapters, reflecting **two years together at the time of writing**, without inventing an anniversary date. Guests can tap, use arrow keys, or swipe through the chapters; explore the ceremony and dinner schedule; save a date-only calendar invitation; pull down the envelope seal; and review their RSVP before sending. All new copy and controls are translated into all four languages. Calendar downloads respect ceremony access and include no guest details.

## Preview and hosting

This is a static website with no runtime dependencies. Serve the directory with any static host, or run `python -m http.server 4173` and open `http://localhost:4173`.

GitHub Pages: **Settings → Pages → Deploy from a branch → main → / (root)**. The expected address is `https://argyrisker.github.io/invite_new/` after Pages is enabled; the address in the code does not itself enable hosting.

## Personalised links

Keep the original query parameters; change only `/invitation/` to `/invite_new/`.

| Parameter | Meaning |
| --- | --- |
| `lang=sv`, `el`, `en`, `hr` | Swedish, Greek, English, Croatian |
| `to=Maria` | Guest name in the greeting |
| `g=f` | One woman; grammatical agreement in Greek/Croatian |
| `g=m` | One man |
| `g=fp` | Several women |
| No `g` | Plural/mixed greeting |
| `greet=...` | Exact custom greeting, displayed as literal text |
| `inv=ceremony` | Welcome inside City Hall instead of the limited-seats message |

Example: `https://argyrisker.github.io/invite_new/?lang=el&to=Maria&g=f&inv=ceremony`

Language changes preserve every guest parameter and update `lang` in the address. A guest name is not automatically split into RSVP first/last names because a link can address several people.

## Google Sheets

`assets/js/config.js` retains the **existing Apps Script `/exec` URL**, contact email, dates and default language. No replacement Google deployment is needed for the redesign.

The form sends the original fields: `firstName`, `lastName`, `attending`, `diet`, `allergies`, `email`, `message`, `language`, `submittedAt`. Dietary values remain in English for the existing Sheet. `google-apps-script/Code.gs` is unchanged, including its email-based updates.

Success requires the script to return `{ "ok": true }`. Network/CORS failures and unreadable responses show an unconfirmed state and contact link. They never silently retry a POST. Explicit refusals show an error. The optional Google Form fallback remains, but its opaque response cannot confirm storage and therefore shows an unconfirmed state.

No test guests were submitted during development. `setup.html` remains an owner diagnostic: its button sends a real test response.

To configure a new deployment later, open your Sheet → Extensions → Apps Script, paste `google-apps-script/Code.gs`, deploy as a web app with **Execute as: Me** and **Who has access: Anyone**, then put the `/exec` URL in `assets/js/config.js`.

## Editing

- Wedding copy: `assets/js/i18n.js`.
- New interface translations: `assets/js/editorial-i18n.js`.
- Layout and styling: `index.html`, `assets/css/editorial.css`.
- Preserved envelope styling: `assets/css/envelope.css`.
- RSVP/personalisation: `assets/js/app.js`.
- Envelope/navigation: `assets/js/envelope.js`, `assets/js/editorial.js`.

English fallback text in the HTML remains readable if scripts fail; update it alongside translation changes.

The footer reopens the envelope. A new storage key lets visitors see it even after opening the old invitation. Reduced-motion guests get an immediate opening. Saved answers are scoped to `to` or the custom greeting, independently from the old site. People sharing the exact same link can use **Change my answer** or receive individual links.

## Development checks

There are no runtime packages. `jsdom` is a development-only dependency for functional tests that never contact Google.

```text
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

The build checks script syntax, translations and assets, then copies guest-facing files to `dist/`. The 33 tests cover language selection, gendered/custom greetings, ceremony variants, literal text handling, validation, exact RSVP fields, confirmed/unconfirmed/error responses, duplicate-submit protection, storage isolation, editing, keyboard/reduced-motion envelope opening, chapter gestures, schedule navigation, RSVP review and calendar export.

Browser visual testing and a real Sheet write were not performed.

## Photography

City Hall: SuperSwede88, public domain, via Wikimedia Commons. Source and details are in `assets/img/CREDITS.md`. The original hometown emblems, envelope and line drawing are retained.
