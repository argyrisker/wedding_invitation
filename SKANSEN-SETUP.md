# Skansen ceremony version

Branch: `skansen-ceremony`. The original invitation remains on `main`.

Date: 5 June 2027. Ceremony: Swedenborgs lusthus, Skansen. All guests are invited to the ceremony. The time and venue booking are not yet confirmed for sending entrance cards.

## What is ready

- Venue photo, map, ceremony text, entrance information and calendar updated in Swedish, Greek, English and Croatian.
- Existing name, greeting, gender and language URL parameters continue to work. `inv=ceremony` is accepted but no longer needed in this version.
- Seven dress palette swatches, mobile layout and envelope retained.
- Swedish card preview: `assets/entrance-card.html`. The editable A5 Word card is delivered separately as a local download in the task.
- Email body uses the language selected at RSVP. The attached PDF is always Swedish and includes both full names, date, confirmed time and venue. It is a wedding invitation, not a separately issued Skansen ticket.
- RSVP storage uses the existing Apps Script endpoint. The old deployment can save replies, but cannot queue cards until the code below is deployed. The website reports this honestly after RSVP.

## Activate the Google Sheets email feature

No guest email was sent during development. Google sign-in was unavailable in the connected browser, so this installation step has not been performed.

1. Open the existing RSVP spreadsheet and choose **Extensions → Apps Script**. Preserve a copy of your current script.
2. Replace its `Code.gs` with `google-apps-script/Code.gs` from this branch. If the live script has custom logic beyond this repository version, merge the `queueEntranceCard` call and validation instead of overwriting it.
3. Add a script file named **EntranceCards** and paste `google-apps-script/EntranceCards.gs` into it. Its spreadsheet ID is already set to the sheet you supplied.
4. Leave `enabled: false` and `ceremonyTime: ''` for now. Run **installEntranceCardTrigger** once and grant Google’s requested Sheets, email, document, Drive and URL-fetch permissions. It creates an **Entrance cards** tab and a once-per-minute worker; it does not send while disabled.
5. Choose **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the existing web-app URL and execution/access settings. This adds card queuing for Skansen replies; main-site replies do not request cards.
6. When the venue and time are final, enter the same Stockholm `HH:mm` time in `ENTRANCE_CARD.ceremonyTime` and the website’s `RSVP_CONFIG.ceremonyTime`. Set `ENTRANCE_CARD.enabled: true`, save, and redeploy. Update the editable Word card’s time and remove its preview note.
7. First submit one RSVP using your own email on the Skansen version. Verify the saved row, email language, attached one-page PDF and time. Inspect that actual Google-generated PDF before enabling invitations for guests; local tests mock Google services and do not validate Google’s PDF rendering or account permissions.

## Delivery and recovery

The queue processes one card per minute, subject to Google’s account quota. A duplicate reply updates the same queue row. Guests who decline are skipped. Names are in the email greeting; the Swedish card only contains wedding details, so it is also suitable for couples and printed copies.

`pending` waits for confirmed settings and available quota. `sent` means Google accepted the send, not that inbox delivery is guaranteed. `uncertain` means a send may have happened: inspect delivery before manually changing it to `pending`; no automatic resend occurs. PDF preparation errors leave the row pending and appear in Apps Script execution logs. A changed confirmed time sends one updated card to previously sent, still-attending guests.

Replies received before the updated Apps Script deployment are not automatically enrolled. After verifying the venue change applies to those guests, invite them to update their reply on the new version, or add their email, first name, surname and language to **Entrance cards** with status `pending`. Do not blanket-mail the original City Hall guest list.

## Review and publication

Run `node scripts/build.cjs` and `node --test tests/*.test.cjs`. This branch is not merged or published over the original site. Preview locally with `python -m http.server 4173 --directory .`. Publishing a GitHub Pages branch change should wait until you select this version.

Source: [Skansen civil weddings and entrance instructions](https://www.skansen.se/se-och-gora/boka-en-upplevelse/brollop/borgerlig-vigsel/), checked 7 September 2026. The venue photograph is Maria Johansson / Skansen, from that page. Guests should bring their invitation; if no printed invitation is available, staff need the couple’s names, ceremony location and time. The card does not claim a QR code, booking identifier, or separate ticket validation.

Card artwork was created using the built-in image generator from the supplied reference. Prompt: two watercolor black tuxedos with ivory shirts and sage boutonnieres, landscape 3:2 on white, no text. Saved as `assets/img/wedding-tuxedos.jpg` so all invitation text remains editable.
