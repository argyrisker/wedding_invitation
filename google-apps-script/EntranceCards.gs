/** Add this file alongside Code.gs in the existing bound Apps Script project.
 * Run installEntranceCardTrigger once. Set enabled and ceremonyTime only after
 * the Skansen booking and time are confirmed. No guest emails are sent before then.
 */
var ENTRANCE_CARD = {
  enabled: false,
  ceremonyTime: '', // Confirmed Stockholm local time HH:mm. Never a placeholder.
  date: '19 juni 2027',
  couple: ['ARGYRIOS KEREZIS', 'TOMISLAV POSAVAC'],
  venue: 'SWEDENBORGS LUSTHUS',
  site: 'SKANSEN',
  replyTo: 'argyker@gmail.com',
  artUrl: 'https://raw.githubusercontent.com/argyrisker/wedding_invitation/skansen-ceremony/assets/img/wedding-tuxedos.jpg',
  spreadsheetId: '1-2woxpwDUuhf-WCfStYmC60hyfVqW7kvoIoyZ_TR2pM'
};
var CARD_COLUMNS = ['Email', 'First name', 'Surname', 'Language', 'Status', 'Sent for', 'Updated', 'Error'];
var CARD_EMAIL_COPY = {
  en: {
    subject: 'Your wedding invitation for the Skansen entrance',
    hello: 'Hello {name},',
    intro: 'We are so happy you will celebrate with us! Your Swedish wedding invitation card is attached as a PDF.',
    instructions: 'Please print the card and bring it to the Skansen entrance on 5 June 2027. If you do not have a printed copy, give the staff our full names, Swedenborgs lusthus, and the ceremony time shown on the card. Keep a copy on your phone so you have the details to hand.',
    language: 'The card is in Swedish to help the entrance staff. This email is in the language you chose when replying.',
    closing: 'With love,\nArgyrios & Tomislav'
  },
  sv: {
    subject: 'Din bröllopsinbjudan för entrén till Skansen',
    hello: 'Hej {name},',
    intro: 'Vad glada vi är att du kommer och firar med oss! Ditt svenska inbjudningskort finns bifogat som PDF.',
    instructions: 'Skriv gärna ut kortet och ta med det till Skansens entré den 19 juni 2027. Om du saknar en utskrift, uppge våra fullständiga namn, Swedenborgs lusthus och vigseltiden som står på kortet. Spara gärna en kopia i mobilen så att du har uppgifterna till hands.',
    language: 'Kortet är på svenska för att underlätta för entrépersonalen. Det här meddelandet är på språket du valde när du svarade.',
    closing: 'Med kärlek,\nArgyrios & Tomislav'
  },
  el: {
    subject: 'Η πρόσκλησή σου για την είσοδο στο Skansen',
    hello: 'Γεια σου {name},',
    intro: 'Χαιρόμαστε πολύ που θα γιορτάσεις μαζί μας! Σου επισυνάπτουμε την κάρτα της πρόσκλησης στα σουηδικά, σε μορφή PDF.',
    instructions: 'Εκτύπωσε την κάρτα και έχε τη μαζί σου στην είσοδο του Skansen στις 19 Ιουνίου 2027. Αν δεν έχεις εκτυπωμένο αντίγραφο, ανάφερε στο προσωπικό τα πλήρη ονόματά μας, τον χώρο Swedenborgs lusthus και την ώρα της τελετής που αναγράφεται στην κάρτα. Αποθήκευσέ τη και στο κινητό σου, για να έχεις εύκολα διαθέσιμα τα στοιχεία.',
    language: 'Η κάρτα είναι στα σουηδικά για τη διευκόλυνση του προσωπικού στην είσοδο. Το μήνυμα αυτό είναι στη γλώσσα που επέλεξες όταν απάντησες.',
    closing: 'Με αγάπη,\nΑργύρης & Τόμισλαβ'
  },
  hr: {
    subject: 'Tvoja pozivnica za ulaz u Skansen',
    hello: 'Pozdrav, {name}!',
    intro: 'Jako nam je drago što ćeš slaviti s nama! U privitku je tvoja pozivnica na švedskom, u PDF formatu.',
    instructions: 'Ispiši karticu i ponesi je na ulaz u Skansen 19. lipnja 2027. Ako nemaš ispisanu kopiju, osoblju navedi naša puna imena, mjesto Swedenborgs lusthus i vrijeme obreda navedeno na kartici. Spremi kopiju i na mobitel kako bi ti podaci bili pri ruci.',
    language: 'Kartica je na švedskom kako bi olakšala ulazak osoblju na ulazu. Ova je poruka na jeziku koji si odabrao/la pri odgovoru.',
    closing: 'S ljubavlju,\nArgyrios i Tomislav'
  }
};

function cardTimeConfirmed() { return /^([01]\d|2[0-3]):[0-5]\d$/.test(ENTRANCE_CARD.ceremonyTime); }
function cardReady() { return ENTRANCE_CARD.enabled === true && cardTimeConfirmed(); }
function cardVersion() { return [ENTRANCE_CARD.date, ENTRANCE_CARD.ceremonyTime, ENTRANCE_CARD.venue].join('|'); }
function cardQueue() {
  var ss = SpreadsheetApp.openById(ENTRANCE_CARD.spreadsheetId);
  var sheet = ss.getSheetByName('Entrance cards') || ss.insertSheet('Entrance cards');
  if (sheet.getLastRow() === 0) { sheet.appendRow(CARD_COLUMNS); sheet.setFrozenRows(1); }
  return sheet;
}
function cardLanguage(language) { return Object.prototype.hasOwnProperty.call(CARD_EMAIL_COPY, language) ? language : 'en'; }
function cardCell(value) {
  var text = String(value || '');
  return /^[=+@-]/.test(text) ? "'" + text : text;
}
/** Runs under doPost's lock, and only enrolls replies from the Skansen branch. */
function queueEntranceCard(data) {
  if (data.venueVariant !== 'skansen') return 'not_requested';
  var sheet = cardQueue(), email = String(data.email).trim().toLowerCase();
  var rows = sheet.getDataRange().getValues(), target = 0;
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]).toLowerCase() === email) { target = i + 1; break; }
  var old = target ? rows[target - 1] : [], status = old[4] || 'pending';
  if (data.attending !== 'Yes') status = 'cancelled';
  else if (status === 'cancelled') status = 'pending';
  var values = [email, cardCell(data.firstName), cardCell(data.lastName), cardLanguage(data.language), status, old[5] || '', new Date(), old[7] || ''];
  sheet.getRange(target || sheet.getLastRow() + 1, 1, 1, CARD_COLUMNS.length).setValues([values]);
  if (data.attending !== 'Yes') return 'not_requested';
  if (status === 'uncertain') return 'uncertain';
  if (status === 'sent' && old[5] === cardVersion()) return 'sent';
  return cardReady() ? 'queued' : 'waiting_confirmation';
}
function entranceMail(data) {
  var copy = CARD_EMAIL_COPY[cardLanguage(data.language)];
  var hello = copy.hello.replace('{name}', String(data.firstName || '').replace(/[\r\n]/g, ' '));
  return {subject: copy.subject, body: [hello, copy.intro, copy.instructions, copy.language, copy.closing].join('\n\n')};
}
function entrancePdf() {
  if (!cardTimeConfirmed()) throw new Error('Confirm the ceremony time before creating entrance cards.');
  var doc = DocumentApp.create('Wedding invitation card'), id = doc.getId();
  try {
    var body = doc.getBody(); body.clear();
    body.setPageWidth(419.53).setPageHeight(595.28).setMarginTop(28).setMarginBottom(15).setMarginLeft(28).setMarginRight(28);
    function line(text, size, after, italic) {
      var p = body.appendParagraph(text).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(0).setSpacingAfter(after).setLineSpacing(1);
      p.editAsText().setFontFamily('Georgia').setFontSize(size).setForegroundColor('#000000').setItalic(!!italic);
      return p;
    }
    line('BRÖLLOPSINBJUDAN', 9, 20);
    line(ENTRANCE_CARD.couple[0], 23, 3);
    line('&', 23, 3, true);
    line(ENTRANCE_CARD.couple[1], 23, 18);
    line('Vi bjuder in dig att fira vårt bröllop', 13, 20, true);
    line('Datum: ' + ENTRANCE_CARD.date, 14, 7);
    line('Tid: kl. ' + ENTRANCE_CARD.ceremonyTime, 14, 20);
    line(ENTRANCE_CARD.venue, 17, 4);
    line(ENTRANCE_CARD.site, 15, 16);
    line('Visa denna inbjudan i Skansens entré.', 10, 0);
    var blob = UrlFetchApp.fetch(ENTRANCE_CARD.artUrl).getBlob();
    var p = body.appendParagraph('').setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(0).setSpacingAfter(0);
    // DocumentApp image dimensions use pixels; the A5 body width is 363 points.
    p.appendInlineImage(blob).setWidth(484).setHeight(323);
    doc.saveAndClose();
    return DriveApp.getFileById(id).getAs(MimeType.PDF).setName('Brollopsinbjudan-Skansen-5-juni-2027.pdf');
  } finally { DriveApp.getFileById(id).setTrashed(true); }
}
function isStillAttending(email) {
  var rows = getSheet().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (String(rows[i][indexOf('email')]).trim().toLowerCase() === email) return rows[i][indexOf('attending')] === 'Yes';
  return false;
}
/** One queued message per minute; preparation happens before the final lock.
 * An uncertain send is never retried automatically. Review it in Entrance cards.
 */
function processEntranceCards() {
  if (!cardReady() || MailApp.getRemainingDailyQuota() < 1) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  var sheet, rows, target = 0;
  try {
    sheet = cardQueue(); rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var status = rows[i][4];
      if (status === 'pending' || (status === 'sent' && rows[i][5] !== cardVersion())) { target = i + 1; break; }
    }
  } finally { lock.releaseLock(); }
  if (!target) return;
  // Reuse the same Swedish invitation for every guest; no guest data in the PDF.
  var pdf = entrancePdf();
  if (!lock.tryLock(1000)) return;
  try {
    var row = sheet.getRange(target, 1, 1, CARD_COLUMNS.length).getValues()[0];
    if (row[4] !== 'pending' && !(row[4] === 'sent' && row[5] !== cardVersion())) return;
    if (!isStillAttending(String(row[0]))) { sheet.getRange(target, 5).setValue('cancelled'); return; }
    if (!cardReady() || MailApp.getRemainingDailyQuota() < 1) return;
    var message = entranceMail({firstName: row[1], language: row[3]});
    // Persist before send: if execution stops during send, a later run cannot duplicate it.
    sheet.getRange(target, 5).setValue('uncertain'); SpreadsheetApp.flush();
    try {
      MailApp.sendEmail({to: row[0], subject: message.subject, body: message.body, attachments: [pdf], name: 'Argyrios & Tomislav', replyTo: ENTRANCE_CARD.replyTo});
      sheet.getRange(target, 5, 1, 4).setValues([['sent', cardVersion(), new Date(), '']]);
    } catch (err) { sheet.getRange(target, 8).setValue('Check delivery before retrying: ' + String(err).slice(0,300)); }
  } finally { lock.releaseLock(); }
}
function installEntranceCardTrigger() {
  cardQueue();
  var exists = ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction() === 'processEntranceCards';});
  if (!exists) ScriptApp.newTrigger('processEntranceCards').timeBased().everyMinutes(1).create();
}

/** Owner-only editor helpers, never exposed by the web-app endpoints. */
function previewEntranceCard() {
  var file = DriveApp.createFile(entrancePdf());
  console.log('Private card preview: ' + file.getUrl());
  return file.getUrl();
}
function sendEntranceCardTest() {
  if (ENTRANCE_CARD.enabled) throw new Error('Disable guest delivery while testing.');
  var message = entranceMail({firstName:'Argyrios', language:'en'});
  MailApp.sendEmail({to:ENTRANCE_CARD.replyTo,subject:'TEST — '+message.subject,body:message.body,attachments:[entrancePdf()],name:'Argyrios & Tomislav'});
}
