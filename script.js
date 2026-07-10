/* =============================================================
 * Melissa Personator Search — Lead Update Widget (8-Condition Ladder)
 * ============================================================= */

const PERSONATOR_ENDPOINT = "https://personatorsearch.melissadata.net/WEB/doPersonatorSearch";
const PERSONATOR_PROXY_URL = ""; 
const PERSONATOR_LICENSE_KEY = "NNyQiGBQttkIhzONLxAqXx**";
const ADDRESS_UPDATE_MODE = "separate"; 

const FIELD_API_NAMES = {
  street:       "LOCATION_ADDRESS",
  state:        "LOCATION_ADDRESS_STATE",
  city:         "LOCATION_ADDRESS_CITY",
  zip:          "Home_Address_Zip",
  phone:        "Phone",
  email:        "Email",
  yearOfBirth:  "Year_of_Birth",
};

let sdkReady = false;
let currentLeadId = null;
let currentLeadRecord = null;
let melissaRecords = [];
let filteredRecords = [];
let selectedMelissaRecord = null;
let selectedIndex = -1;
let melissaTableRendered = false;
let searchLeadRecord = null;

// FORCE CACHE CLEAR
const LEAD_SNAPSHOT_STORAGE_PREFIX = "melissaWidget:leadSearch_V8_:";

function getLeadSnapshotStorageKey(leadId) { return LEAD_SNAPSHOT_STORAGE_PREFIX + String(leadId); }

function loadSavedLeadSearchCriteria(leadId) {
  try {
    const raw = localStorage.getItem(getLeadSnapshotStorageKey(leadId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) { return null; }
}

function persistLeadSearchCriteria(leadId, leadRecord) {
  try {
    const snapshot = {
      First_Name:       String(leadRecord?.First_Name       || ""),
      Last_Name:        String(leadRecord?.Last_Name        || ""),
      Full_Name:        String(leadRecord?.Full_Name        || ""),
      Email:            String(leadRecord?.Email            || ""),
      Phone:            String(leadRecord?.Phone            || ""),
      Mobile:           String(leadRecord?.Mobile           || ""),
      Year_of_Birth:    String(leadRecord?.Year_of_Birth    || ""),
      Date_of_Birth:    String(leadRecord?.Date_of_Birth    || ""),
      DOB:              String(leadRecord?.DOB              || ""),
      Home_Address_Zip: String(leadRecord?.Home_Address_Zip || ""),
      Zip_Code:         String(leadRecord?.Zip_Code         || ""),
      State:            String(leadRecord?.State || leadRecord?.LOCATION_ADDRESS_STATE || leadRecord?.Home_Address_State || ""),
    };
    localStorage.setItem(getLeadSnapshotStorageKey(leadId), JSON.stringify(snapshot));
    return snapshot;
  } catch (e) { return null; }
}

const els = {
  banner: document.getElementById("banner"),
  leadContext: document.getElementById("leadContext"),
  loading: document.getElementById("loadingState"),
  empty: document.getElementById("emptyState"),
  resultsWrap: document.getElementById("resultsWrapper"),
  resultsBody: document.getElementById("resultsBody"),
  previewSec: document.getElementById("previewSection"),
  previewGrid: document.getElementById("previewGrid"),
  previewCancelBtn: document.getElementById("previewCancelBtn"),
  previewUpdateBtn: document.getElementById("previewUpdateBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  filterInput: document.getElementById("filterInput"),
  successModal: document.getElementById("successModal"),
  successClose: document.getElementById("successCloseBtn"),
};

function showBanner(message, type = "info") { els.banner.textContent = message; els.banner.className = `banner banner-${type}`; }
function hideBanner() { els.banner.className = "banner banner-hidden"; els.banner.textContent = ""; }
function setLoading(isLoading) { els.loading.classList.toggle("hidden", !isLoading); }
function showEmpty(show) { els.empty.classList.toggle("hidden", !show); }
function setEmptyMessage(msg) { const p = els.empty.querySelector("p"); if (p) p.textContent = msg; }
function showResults(show) { els.resultsWrap.classList.toggle("hidden", !show); }
function showPreview(show) { els.previewSec.classList.toggle("hidden", !show); }
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

let updateLeadBtn = null;
function refreshUpdateButton() {
  const disabled = !sdkReady || !currentLeadId || !selectedMelissaRecord;
  if (updateLeadBtn) updateLeadBtn.disabled = disabled;
  if (els.previewUpdateBtn) els.previewUpdateBtn.disabled = disabled;
}

/* ===============================
 * ZOHO SDK INIT & THE 8-STEP LADDER
 * =============================== */

ZOHO.embeddedApp.on("PageLoad", async function (data) {
  sdkReady = true;
  try { if (ZOHO?.CRM?.UI?.Resize) ZOHO.CRM.UI.Resize({ height: "1000", width: "1900" }); } catch (e) {}
  if (melissaTableRendered) return;

  if (data) {
    if (data.EntityId) currentLeadId = Array.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
    else if (data.Entity) currentLeadId = Array.isArray(data.Entity) ? data.Entity[0] : data.Entity;
  }

  if (!currentLeadId) { setLoading(false); showBanner("Current Lead ID not found.", "error"); return; }

  try {
    currentLeadRecord = await fetchCurrentLead(currentLeadId);
    const savedCriteria = loadSavedLeadSearchCriteria(currentLeadId);
    if (savedCriteria) searchLeadRecord = savedCriteria;
    else searchLeadRecord = persistLeadSearchCriteria(currentLeadId, currentLeadRecord) || currentLeadRecord;

    const baseParams = buildMelissaSearchParams(searchLeadRecord);
    
    // -------------------------------------------------------------
    // EXACTLY 8 CONDITIONS (Original 5 + New 3)
    // -------------------------------------------------------------
    const searchAttempts = [];
    
    // 1. first + last + email
    if (baseParams.email) {
      searchAttempts.push({ label: "first + last + email", params: { first: baseParams.first, last: baseParams.last, email: baseParams.email } });
    }
    // 2. first + last + postal(zip)
    if (baseParams.postal) {
      searchAttempts.push({ label: "first + last + postal", params: { first: baseParams.first, last: baseParams.last, postal: baseParams.postal } });
    }
    // 3. first + last + phone
    if (baseParams.phone) {
      searchAttempts.push({ label: "first + last + phone", params: { first: baseParams.first, last: baseParams.last, phone: baseParams.phone } });
    }
    // 4. first + last + birth year
    if (baseParams.birthYear) {
      searchAttempts.push({ label: "first + last + birth year", params: { first: baseParams.first, last: baseParams.last, birthYear: baseParams.birthYear } });
    }
    // 5. first + last fallback
    if (baseParams.first && baseParams.last) {
      searchAttempts.push({ label: "first + last fallback", params: { first: baseParams.first, last: baseParams.last } });
    }
    // 6. fullname + state (NEW)
    if (baseParams.full && baseParams.state) {
      searchAttempts.push({ label: "fullname + state", params: { full: baseParams.full, state: baseParams.state } });
    }
    // 7. first + last + state (NEW)
    if (baseParams.first && baseParams.last && baseParams.state) {
      searchAttempts.push({ label: "first + last + state", params: { first: baseParams.first, last: baseParams.last, state: baseParams.state } });
    }
    // 8. fullname fallback (NEW)
    if (baseParams.full) {
      searchAttempts.push({ label: "fullname fallback", params: { full: baseParams.full } });
    }
    // -------------------------------------------------------------

    const allRecords = [];
    let licenseIssueDetected = false;

    for (const attempt of searchAttempts) {
      console.log(`Running Attempt: ${attempt.label}`, attempt.params);
      let rawResponse = null;
      try {
        rawResponse = await callMelissaSearchAPI(attempt.params);
      } catch (attemptErr) {
        console.error(`Attempt "${attempt.label}" failed:`, attemptErr);
        continue;
      }

      if (hasLicenseError(rawResponse)) { licenseIssueDetected = true; break; }
      const recs = Array.isArray(rawResponse?.Records) ? rawResponse.Records : [];
      allRecords.push(...recs);
    }

    if (licenseIssueDetected) { setLoading(false); setEmptyMessage("Melissa license key issue."); showEmpty(true); return; }

    const matchedRaw = dedupRawMelissaRecords(allRecords); 
    setLoading(false);

    if (matchedRaw.length === 0) { setEmptyMessage("No records found in any of the 8 search conditions."); showEmpty(true); return; }

    const flattenedMelissaRows = mapMelissaRecords(matchedRaw);
    const uniqueRows = dedupMelissaRows(flattenedMelissaRows);

    if (uniqueRows.length === 0) { setEmptyMessage("No valid address records found to display."); showEmpty(true); return; }

    melissaRecords = uniqueRows.map((r) => Object.freeze({ ...r }));
    filteredRecords = melissaRecords.slice();

    renderResults(filteredRecords);
    showResults(true);
    els.filterInput.disabled = false;
    melissaTableRendered = true;

  } catch (err) {
    console.error("Widget load error:", err);
    setLoading(false);
    showBanner(`Failed to load results: ${err.message || err}`, "error");
  }
});

function hasLicenseError(response) {
  if (!response) return false;
  const tr = String(response.TransmissionResults || "");
  return /\bGE0[5-8]\b/.test(tr) || /\bSE01\b/.test(tr);
}

ZOHO.embeddedApp.init();

/* ===============================
 * HELPER FUNCTIONS
 * =============================== */

async function fetchCurrentLead(leadId) {
  const resp = await ZOHO.CRM.API.getRecord({ Entity: "Leads", RecordID: leadId });
  if (resp && resp.data && resp.data.length > 0) return resp.data[0];
  throw new Error("Lead not found in CRM.");
}

function buildMelissaSearchParams(lead) {
  const first = String(lead?.First_Name || "").trim();
  const last = String(lead?.Last_Name || "").trim();
  const fullName = (first + " " + last).trim();
  const birthYear = String(lead?.Year_of_Birth || "").trim();

  return {
    first: first,
    last: last,
    full: fullName,
    state: String(lead?.State || lead?.LOCATION_ADDRESS_STATE || lead?.Home_Address_State || "").trim(),
    postal: String(lead?.Home_Address_Zip || lead?.Zip_Code || "").trim(),
    email: String(lead?.Email || "").trim(),
    phone: String(lead?.Phone || lead?.Mobile || "").trim(),
    birthYear: String(lead?.Year_of_Birth || "").trim() || extractYear(lead?.Date_of_Birth || lead?.DOB),
  };
}

function extractYear(value) {
  if (!value) return "";
  const m = String(value).match(/(19|20)\d{2}/);
  return m ? m[0] : "";
}

function normalizeName(value) { return String(value || "").trim().toLowerCase(); }
function normalizeText(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
function normalizeZip(value) { return String(value || "").replace(/\D/g, "").slice(0, 5); }
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function getMelissaUniqueKey(record) {
  const mik = record?.MelissaIdentityKey || record?.melissaIdentityKey || "";
  if (mik) return `mik:${String(mik).trim()}`;
  const phones = (record?.PhoneRecords || []).map((p) => normalizePhone((typeof p === "string" ? p : p?.phoneNumber || p?.Phone) || "")).filter(Boolean).sort().join("|");
  const emails = (record?.EmailRecords || []).map((e) => normalizeEmail((typeof e === "string" ? e : e?.email || e?.Email) || "")).filter(Boolean).sort().join("|");
  const fullName = record?.FullName || [ record?.Name?.FirstName || record?.First || "", record?.Name?.MiddleName || record?.Middle || "", record?.Name?.LastName || record?.Last || "" ].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
  return [ "combined", normalizeText(fullName), String(record?.DateOfBirth || "").trim(), normalizeText(record?.CurrentAddress?.AddressLine1 || ""), normalizeZip(record?.CurrentAddress?.PostalCode || ""), phones, emails ].join("||");
}

function dedupRawMelissaRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return [];
  const uniqueRecordsMap = new Map();
  records.forEach((record) => {
    const key = getMelissaUniqueKey(record);
    if (!uniqueRecordsMap.has(key)) uniqueRecordsMap.set(key, record);
  });
  return Array.from(uniqueRecordsMap.values());
}

function dedupMelissaRows(rows) {
  const seen = new Set();
  const unique = [];
  rows.forEach((row) => {
    const key = [ String(row.melissaRecordLabel || "").trim(), normalizeName(row.firstName), normalizeName(row.lastName), String(row.birthYear || "").trim(), normalizeName(row.dataType), normalizeName(row.homeAddressStreet), normalizeName(row.homeAddressCity), normalizeName(row.homeAddressState), normalizeZip(row.homeAddressZip), normalizePhone(row.phone), normalizeEmail(row.email) ].join("|");
    if (seen.has(key)) return;
    seen.add(key); unique.push(row);
  });
  return unique;
}

/* ===============================
 * API CALL (Dynamic URL Builder)
 * =============================== */
/* ===============================
 * API CALL (Fixed URL Builder)
 * =============================== */
async function callMelissaSearchAPI(params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    // 1. Base URL
    let url = PERSONATOR_ENDPOINT + "?id=" + encodeURIComponent(PERSONATOR_LICENSE_KEY) + "&format=JSON&cols=GrpAll,PreviousAddress,DateOfBirth";
    
    // 2. Sirf wahi add karo jo is attempt mein exist karta hai
    if (params.first) url += "&first=" + encodeURIComponent(params.first);
    if (params.last) url += "&last=" + encodeURIComponent(params.last);
    if (params.full) url += "&full=" + encodeURIComponent(params.full);
    if (params.state) url += "&state=" + encodeURIComponent(params.state);
    if (params.postal) url += "&postal=" + encodeURIComponent(params.postal);
    if (params.email) url += "&email=" + encodeURIComponent(params.email);
    if (params.phone) url += "&phone=" + encodeURIComponent(params.phone);
    if (params.birthYear) url += "&dob=" + encodeURIComponent(params.birthYear);
    
    // 3. Loose setting
    url += "&opt=ReturnAllPages:True,SearchConditions:loose";

    console.log("URL Triggered (Masked):", url.replace(/([?&]id=)[^&]+/i, "$1***MASKED***"));

    const response = await fetch(url, { method: "GET", signal: controller.signal });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("Search timed out.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ===============================
 * RESPONSE MAPPING & UI
 * =============================== */

function toDisplayString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function mapMelissaRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return [];
  const snapshotForLabels = searchLeadRecord || currentLeadRecord || {};
  const leadPhone = normalizePhone(snapshotForLabels.Phone || snapshotForLabels.Mobile || "");
  const leadEmail = normalizeEmail(snapshotForLabels.Email || "");
  const rows = [];

  records.forEach((record, recordIndex) => {
    const groupLabel = `Person #${recordIndex + 1}`;
    const firstName = toDisplayString(record.Name?.FirstName || record.FirstName || record.First || "");
    const middleName = toDisplayString(record.Name?.MiddleName || record.MiddleName || record.Middle || "");
    const lastName = toDisplayString(record.Name?.LastName || record.LastName || record.Last || "");
    const rawDob = String(record.DateOfBirth || "");
    const birthYear = rawDob && rawDob.length >= 4 ? rawDob.substring(0, 4) : "";

    const blankRow = { melissaRecordLabel: groupLabel, firstName, middleName, lastName, birthYear, dataType: "", homeAddressStreet: "", homeAddressState: "", homeAddressCity: "", homeAddressZip: "", phone: "", email: "" };
    const buildAddressRow = (addr, label, phoneStr, emailStr) => ({ ...blankRow, dataType: label, homeAddressStreet: toDisplayString(addr?.AddressLine1 || addr?.Street || ""), homeAddressState: toDisplayString(addr?.State || addr?.StateProvince || ""), homeAddressCity: toDisplayString(addr?.City || addr?.Locality || ""), homeAddressZip: toDisplayString(addr?.PostalCode || addr?.ZipCode || ""), phone: phoneStr || "", email: emailStr || "" });

    const allPhones = (record.PhoneRecords || []).map((entry) => typeof entry === "string" ? entry : entry?.PhoneNumber || entry?.Phone || "").map(toDisplayString).filter(Boolean);
    const allEmails = (record.EmailRecords || []).map((entry) => typeof entry === "string" ? entry : entry?.Email || entry?.EmailAddress || "").map(toDisplayString).filter(Boolean);
    
    const workingEmails = [...allEmails];
    let currentEmail = "";

    if (record.CurrentAddress) {
      const currentPhone = allPhones[0] || "";
      currentEmail = (leadEmail && allEmails.find((e) => normalizeEmail(e) === leadEmail)) || allEmails[0] || "";
      if (currentEmail) {
        const idx = workingEmails.findIndex((e) => normalizeEmail(e) === normalizeEmail(currentEmail));
        if (idx !== -1) workingEmails.splice(idx, 1);
      }
      rows.push(buildAddressRow(record.CurrentAddress, "Current Address", currentPhone, currentEmail));
    }

    const prevAddresses = record.PreviousAddresses || [];
    const phoneOffset = record.CurrentAddress ? 1 : 0;
    prevAddresses.forEach((addr, i) => { rows.push(buildAddressRow(addr, "Previous Address", allPhones[phoneOffset + i] || "", workingEmails[i] || "")); });

    const extraPhoneStart = phoneOffset + prevAddresses.length;
    const extraPhones = allPhones.slice(extraPhoneStart);
    const extraEmails = workingEmails.slice(prevAddresses.length);
    const additionalCount = Math.max(extraPhones.length, extraEmails.length);

    for (let i = 0; i < additionalCount; i++) {
      const phone = extraPhones[i] || "";
      const email = extraEmails[i] || "";
      if (!phone && !email) continue;
      rows.push({ ...blankRow, dataType: "Additional Contact", phone, email });
    }
  });
  return rows;
}

function renderResults(records) {
  els.resultsBody.innerHTML = "";
  if (!records.length) { showEmpty(true); showResults(false); return; }
  showEmpty(false); showResults(true);

  let prevGroup = null;
  records.forEach((rec, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;
    tr.dataset.melissaRecord = rec.melissaRecordLabel || "";

    if (rec.melissaRecordLabel && rec.melissaRecordLabel !== prevGroup) {
      tr.style.borderTop = "2px solid #c5cee0";
      tr.style.backgroundColor = "#f5f8fc";
      prevGroup = rec.melissaRecordLabel;
    }

    tr.innerHTML = `
      <td>${escapeHtml(rec.melissaRecordLabel) || "—"}</td>
      <td>${escapeHtml(rec.firstName) || "—"}</td>
      <td>${escapeHtml(rec.middleName) || "—"}</td>
      <td>${escapeHtml(rec.lastName) || "—"}</td>
      <td>${escapeHtml(rec.birthYear) || "—"}</td>
      <td>${escapeHtml(rec.dataType) || "—"}</td>
      <td>${escapeHtml(rec.homeAddressStreet) || "—"}</td>
      <td>${escapeHtml(rec.homeAddressState) || "—"}</td>
      <td>${escapeHtml(rec.homeAddressCity) || "—"}</td>
      <td>${escapeHtml(rec.homeAddressZip) || "—"}</td>
      <td>${escapeHtml(rec.phone) || "—"}</td>
      <td>${escapeHtml(rec.email) || "—"}</td>
      <td class="action-cell"><button class="btn btn-select" data-action="select" data-index="${index}">Select</button></td>
    `;
    tr.addEventListener("click", () => selectRecord(index));
    els.resultsBody.appendChild(tr);
  });
  if (selectedIndex >= 0) markSelectedRow(selectedIndex);
}

function selectRecord(index) {
  const record = filteredRecords[index];
  if (!record) return;
  if (selectedIndex === index) { selectedIndex = -1; selectedMelissaRecord = null; markSelectedRow(-1); showPreview(false); refreshUpdateButton(); return; }
  selectedIndex = index; selectedMelissaRecord = record;
  markSelectedRow(index); renderPreview(record); showPreview(true); refreshUpdateButton();
}

function markSelectedRow(index) {
  const rows = els.resultsBody.querySelectorAll("tr");
  rows.forEach((row) => {
    const isSel = parseInt(row.dataset.index, 10) === index;
    row.classList.toggle("selected", isSel);
    const btn = row.querySelector(".btn-select");
    if (btn) { btn.classList.toggle("is-selected", isSel); btn.textContent = isSel ? "Selected" : "Select"; }
  });
}

function renderPreview(rec) {
  const fields = [ ["Melissa Record", rec.melissaRecordLabel], ["First Name", rec.firstName], ["Last Name", rec.lastName], ["Year of Birth", rec.birthYear], ["Data Type", rec.dataType], ["Home Address Street", rec.homeAddressStreet], ["Home Address State", rec.homeAddressState], ["Home Address City", rec.homeAddressCity], ["Home Address Zip", rec.homeAddressZip], ["Phone", rec.phone], ["Email", rec.email] ];
  els.previewGrid.innerHTML = fields.map(([label, value]) => `<div class="preview-item"><span class="preview-label">${escapeHtml(label)}</span><span class="preview-value ${value ? "" : "empty"}">${value ? escapeHtml(value) : "—"}</span></div>`).join("");
}

els.filterInput.addEventListener("input", (e) => {
  const q = (e.target.value || "").trim().toLowerCase();
  filteredRecords = !q ? [...melissaRecords] : melissaRecords.filter((r) => [r.melissaRecordLabel, r.firstName, r.lastName, r.birthYear, r.dataType, r.homeAddressStreet, r.homeAddressState, r.homeAddressCity, r.homeAddressZip, r.phone, r.email].join(" ").toLowerCase().includes(q));
  selectedIndex = -1; selectedMelissaRecord = null; showPreview(false); refreshUpdateButton(); renderResults(filteredRecords);
});

function attachUpdateLeadHandler() {
  updateLeadBtn = document.getElementById("updateLeadBtn");
  if (updateLeadBtn) updateLeadBtn.addEventListener("click", async function () { await updateLeadRecord(); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attachUpdateLeadHandler); else attachUpdateLeadHandler();

async function updateLeadRecord() {
  if (!sdkReady || !currentLeadId || !selectedMelissaRecord) { showBanner("Error: Missing selection.", "error"); return; }
  const updateSnapshot = { homeAddressStreet: String(selectedMelissaRecord.homeAddressStreet || ""), homeAddressState: String(selectedMelissaRecord.homeAddressState || ""), homeAddressCity: String(selectedMelissaRecord.homeAddressCity || ""), homeAddressZip: String(selectedMelissaRecord.homeAddressZip || ""), phone: String(selectedMelissaRecord.phone || ""), email: String(selectedMelissaRecord.email || ""), yearOfBirth: String(selectedMelissaRecord.birthYear || "") };
  
  hideBanner();
  if (updateLeadBtn) { updateLeadBtn.disabled = true; updateLeadBtn.textContent = "Updating..."; }
  if (els.previewUpdateBtn) { els.previewUpdateBtn.disabled = true; els.previewUpdateBtn.textContent = "Updating..."; }

  try {
    const updatePayload = buildUpdatePayload(currentLeadId, updateSnapshot);
    const updateResponse = await ZOHO.CRM.API.updateRecord({ Entity: "Leads", APIData: updatePayload });
    showPreview(false); selectedIndex = -1; selectedMelissaRecord = null; markSelectedRow(-1); refreshUpdateButton();
    const success = updateResponse?.data?.[0]?.code === "SUCCESS" || updateResponse?.data?.[0]?.status === "success";
    if (!success) throw new Error(updateResponse?.data?.[0]?.message || "Zoho update failed.");
    showSuccessModal("Record updated successfully");
  } catch (error) {
    showBanner("Update failed: " + (error.message || error), "error");
  } finally {
    if (updateLeadBtn) { updateLeadBtn.disabled = false; updateLeadBtn.textContent = "Update Lead"; }
    if (els.previewUpdateBtn) els.previewUpdateBtn.textContent = "Update Lead";
    refreshUpdateButton();
  }
}

function buildUpdatePayload(leadId, rec) {
  const yobStr = String(rec.yearOfBirth || "").trim();
  const yobNum = /^\d{4}$/.test(yobStr) ? Number(yobStr) : null;
  if (ADDRESS_UPDATE_MODE === "compound") {
    const payload = { id: leadId }; const homeAddress = {};
    if (rec.homeAddressStreet) homeAddress.Street = rec.homeAddressStreet;
    if (rec.homeAddressState)  homeAddress.State  = rec.homeAddressState;
    if (rec.homeAddressCity)   homeAddress.City   = rec.homeAddressCity;
    if (rec.homeAddressZip)    homeAddress.Zip    = rec.homeAddressZip;
    if (Object.keys(homeAddress).length) payload.Home_Address = homeAddress;
    if (rec.phone) payload[FIELD_API_NAMES.phone] = rec.phone;
    if (rec.email) payload[FIELD_API_NAMES.email] = rec.email;
    if (yobNum !== null) payload[FIELD_API_NAMES.yearOfBirth] = yobNum;
    return payload;
  }
  const updatePayload = { id: leadId };
  if (rec.homeAddressStreet) updatePayload[FIELD_API_NAMES.street] = rec.homeAddressStreet;
  if (rec.homeAddressState)  updatePayload[FIELD_API_NAMES.state]  = rec.homeAddressState;
  if (rec.homeAddressCity)   updatePayload[FIELD_API_NAMES.city]   = rec.homeAddressCity;
  if (rec.homeAddressZip)    updatePayload[FIELD_API_NAMES.zip]    = rec.homeAddressZip;
  if (rec.phone)             updatePayload[FIELD_API_NAMES.phone]  = rec.phone;
  if (rec.email)             updatePayload[FIELD_API_NAMES.email]  = rec.email;
  if (yobNum !== null)       updatePayload[FIELD_API_NAMES.yearOfBirth] = yobNum;
  return updatePayload;
}

function showSuccessModal(message) {
  const modal = document.getElementById("successModal");
  if (!modal) { alert(message || "Record updated successfully"); return; }
  const msgEl = document.getElementById("successMessage") || modal.querySelector(".success-message, .modal-message, h3, p");
  if (msgEl) msgEl.textContent = message || "Record updated successfully";
  modal.classList.remove("hidden"); modal.style.display = "flex";
}

if (els.successClose) els.successClose.addEventListener("click", closeWidget);
if (els.cancelBtn) els.cancelBtn.addEventListener("click", closeWidget);
if (els.previewCancelBtn) els.previewCancelBtn.addEventListener("click", function () { selectedIndex = -1; selectedMelissaRecord = null; markSelectedRow(-1); showPreview(false); refreshUpdateButton(); });
if (els.previewUpdateBtn) els.previewUpdateBtn.addEventListener("click", async function () { await updateLeadRecord(); });

function closeWidget() {
  try { ZOHO.CRM.UI.Popup.closeReload().catch(() => { if (ZOHO.CRM.UI.Popup.close) ZOHO.CRM.UI.Popup.close(); }); } 
  catch (e) {}
}
