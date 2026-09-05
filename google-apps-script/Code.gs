/**
 * RSVP receiver for the Argyrios & Tomislav invitation page.
 * Writes one row per guest into the Google Sheet this script is bound to.
 *
 * SETUP (about five minutes, see README.md section 1 for screenshots of the wording)
 *  1. Create a Google Sheet. This is the guest database.
 *  2. In that Sheet: Extensions -> Apps Script. Delete the sample code and
 *     paste this whole file.
 *  3. Optional: put your address in NOTIFY_EMAIL to get a mail per answer.
 *  4. Deploy -> New deployment -> type "Web app"
 *       Execute as:     Me
 *       Who has access: Anyone
 *     Approve the permission prompt (it asks for the Sheet and, if you set
 *     NOTIFY_EMAIL, permission to send mail as you).
 *  5. Copy the /exec URL and paste it into assets/js/config.js as appsScriptUrl.
 *  6. Open the /exec URL in a browser. It should print {"ok":true,...}.
 *
 * After editing this file later, redeploy with
 * Manage deployments -> edit (pencil) -> Version: New version -> Deploy,
 * otherwise the old code keeps running on the same URL.
 */

var SHEET_NAME   = 'RSVP';
var NOTIFY_EMAIL = '';   // e.g. 'argyker@gmail.com', leave empty for no emails

/* Sheet layout: [key sent by the page, column header].
   'firstSeen' and 'updated' are filled in by this script, not by the page. */
var COLUMNS = [
  ['firstSeen',  'First reply'],
  ['updated',    'Last update'],
  ['firstName',  'First name'],
  ['lastName',   'Surname'],
  ['attending',  'Attending'],
  ['diet',       'Diet'],
  ['allergies',  'Allergies / notes'],
  ['email',      'Email'],
  ['message',    'Message'],
  ['language',   'Language']
];

/* One row per email address: a guest who changes their answer updates their
   own row instead of adding a second one. */
var KEY = 'email';

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Two guests pressing send at the same moment must not get the same row.
    lock.waitLock(20000);

    var data = readPayload(e);

    if (!String(data.firstName || '').trim() || !String(data.lastName || '').trim()) {
      return json({ ok: false, error: 'name missing' });
    }
    if (!String(data.email || '').trim()) {
      return json({ ok: false, error: 'email missing' });
    }

    var result = save(data);
    notify(data, result.updated);
    return json({ ok: true, row: result.row, updated: result.updated });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

/** Opening the /exec URL in a browser confirms the deployment is alive. */
function doGet() {
  var sheet = getSheet();
  return json({
    ok: true,
    service: 'rsvp',
    sheet: sheet.getName(),
    replies: Math.max(0, sheet.getLastRow() - 1)
  });
}

/** Accepts both a normal form post and a JSON body. */
function readPayload(e) {
  if (e && e.postData && String(e.postData.type).indexOf('application/json') === 0) {
    return JSON.parse(e.postData.contents);
  }
  return (e && e.parameter) || {};
}

function save(data) {
  var sheet = getSheet();
  var now = new Date();
  var keyIndex = indexOf(KEY);
  var wanted = String(data[KEY] || '').trim().toLowerCase();

  var existing = 0;
  if (sheet.getLastRow() > 1) {
    var keys = sheet.getRange(2, keyIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]).trim().toLowerCase() === wanted) {
        existing = i + 2; // +1 for the header, +1 because ranges are 1-based
        break;
      }
    }
  }

  var firstSeen = existing
    ? sheet.getRange(existing, indexOf('firstSeen') + 1).getValue() || now
    : now;

  var row = COLUMNS.map(function (col) {
    if (col[0] === 'firstSeen') return firstSeen;
    if (col[0] === 'updated')   return now;
    return String(data[col[0]] || '');
  });

  var target = existing || sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);

  return { row: target, updated: !!existing };
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    var headers = COLUMNS.map(function (col) { return col[1]; });
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#0f2440')
         .setFontColor('#f8f4ec');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
    buildSummary(ss);
  }
  return sheet;
}

/** A small second tab with live counts, handy when you talk to the caterer. */
function buildSummary(ss) {
  if (ss.getSheetByName('Summary')) return;

  var attending = a1(indexOf('attending'));
  var diet      = a1(indexOf('diet'));
  var email     = a1(indexOf('email'));
  var q = function (formula) { return formula; };

  var rows = [
    ['Replies received', q('=COUNTA(' + SHEET_NAME + '!' + email + '2:' + email + ')')],
    ['Coming',           q('=COUNTIF(' + SHEET_NAME + '!' + attending + ':' + attending + ',"Yes")')],
    ['Not coming',       q('=COUNTIF(' + SHEET_NAME + '!' + attending + ':' + attending + ',"No")')],
    ['', ''],
    ['Vegetarian',       dietCount(diet, 'Vegetarian')],
    ['Vegan',            dietCount(diet, 'Vegan')],
    ['Pescatarian',      dietCount(diet, 'Pescatarian')],
    ['Gluten-free',      dietCount(diet, 'Gluten-free')],
    ['Lactose-free',     dietCount(diet, 'Lactose-free')],
    ['No pork',          dietCount(diet, 'No pork')],
    ['Nut allergy',      dietCount(diet, 'Nut allergy')],
    ['Shellfish allergy', dietCount(diet, 'Shellfish allergy')],
    ['', ''],
    ['With a note',      q('=COUNTIF(' + SHEET_NAME + '!' +
                           a1(indexOf('allergies')) + '2:' + a1(indexOf('allergies')) + ',"?*")')]
  ];

  var sheet = ss.insertSheet('Summary');
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, rows.length, 1).setFontWeight('bold');
  sheet.setColumnWidth(1, 190);
}

function dietCount(dietCol, label) {
  // the diet column holds a comma separated list, so match on substring
  return '=COUNTIF(' + SHEET_NAME + '!' + dietCol + ':' + dietCol + ',"*' + label + '*")';
}

function indexOf(key) {
  for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === key) return i;
  return -1;
}

/** 0 -> A, 1 -> B, ... enough for any sane number of columns. */
function a1(index) {
  var letters = '';
  index += 1;
  while (index > 0) {
    var rem = (index - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    index = Math.floor((index - 1) / 26);
  }
  return letters;
}

function notify(data, wasUpdate) {
  if (!NOTIFY_EMAIL) return;
  var coming = String(data.attending) === 'Yes';
  var name = ((data.firstName || '') + ' ' + (data.lastName || '')).trim();
  var body = COLUMNS
    .filter(function (col) { return col[0] !== 'firstSeen' && col[0] !== 'updated'; })
    .map(function (col) { return col[1] + ': ' + (data[col[0]] || '-'); })
    .join('\n');

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: (coming ? '✓ ' : '✗ ') + 'RSVP: ' + name + (wasUpdate ? ' (changed answer)' : ''),
    body: body
  });
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
