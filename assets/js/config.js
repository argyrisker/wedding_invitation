/* ─────────────────────────────────────────────────────────────────────────
   CONFIGURATION: this is the only file you normally need to edit.
   See README.md for step-by-step setup instructions.
   ───────────────────────────────────────────────────────────────────────── */

window.RSVP_CONFIG = {

  /* Where the answers are stored.
     Pick ONE of the two options below (Apps Script wins if both are filled). */

  /* Option A: Google Apps Script → Google Sheet (recommended).
     Paste the /exec web-app URL you get when you deploy google-apps-script/Code.gs */
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbyTSOFstzt6amXwBTc5N7nBGN3XR9Ul5ia-QkI10jO6xaKah0kmn3slBJSCcEoif7iC/exec",

  /* Option B: plain Google Form.
     formId is the long id in the form URL: .../forms/d/e/<FORM_ID>/viewform
     Each entry id looks like "entry.123456789". README explains how to find them. */
  googleForm: {
    formId: "",
    entries: {
      firstName: "",
      lastName:  "",
      attending: "",
      diet:      "",
      allergies: "",
      email:     "",
      message:   ""
    }
  },

  /* Fallback + "Questions" link. Used if neither option above is configured,
     or if a submission fails. The guest gets a pre-filled email instead. */
  contactEmail: "argyker@gmail.com",

  /* Event dates. Month is 1-12. Time is local Stockholm time. */
  weddingDate:  "2027-06-05T18:00:00+02:00",
  rsvpDeadline: "2026-12-31T23:59:59+01:00",

  /* Default language when the browser language is none of sv / el / en / hr */
  defaultLang: "en"
};
