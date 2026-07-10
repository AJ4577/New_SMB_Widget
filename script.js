/* =============================================================
 * Melissa Personator Search — ULTIMATE FINAL FIXED VERSION
 * Features: 8-Condition Ladder, Correct Mapping, No Field Errors
 * ============================================================= */

const PERSONATOR_ENDPOINT = "https://personatorsearch.melissadata.net/WEB/doPersonatorSearch";
const PERSONATOR_LICENSE_KEY = "NNyQiGBQttkIhzONLxAqXx**";
const ADDRESS_UPDATE_MODE = "separate";

const FIELD_API_NAMES = {
  street: "LOCATION_ADDRESS",
  state: "LOCATION_ADDRESS_STATE",
  city: "LOCATION_ADDRESS_CITY",
  zip: "Home_Address_Zip",
  phone: "Phone",
  email: "Email",
  yearOfBirth: "Year_of_Birth",
};

// State variables
let sdkReady = false;
let currentLeadId = null;
let currentLeadRecord = null;
let melissaRecords = [];
let filteredRecords = [];
let selectedMelissaRecord = null;
let selectedIndex = -1;
let melissaTableRendered = false;
let searchLeadRecord = null;

// Clean Cache Key
const LEAD_SNAPSHOT_STORAGE_PREFIX = "melissaWidget:leadSearch_VFINAL_FIXED_:";

// Initialization
ZOHO.embeddedApp.on("PageLoad", async function (data) {
  sdkReady = true;
  try { if (ZOHO?.CRM?.UI?.Resize) ZOHO.CRM.UI.Resize({ height: "1000", width: "1900" }); } catch (e) {}
  if (melissaTableRendered) return;

  if (data) {
    if (data.EntityId) currentLeadId = Array.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
  }

  if (!currentLeadId) { setLoading(false); showBanner("Lead ID not found.", "error"); return; }

  try {
    currentLeadRecord = await fetchCurrentLead(currentLeadId);
    searchLeadRecord = persistLeadSearchCriteria(currentLeadId, currentLeadRecord);

    const baseParams = buildMelissaSearchParams(searchLeadRecord);
    
    // 8-Step Search Ladder
    const searchAttempts = [
      { label: "email", params: { first: baseParams.first, last: baseParams.last, email: baseParams.email } },
      { label: "postal", params: { first: baseParams.first, last: baseParams.last, postal: baseParams.postal } },
      { label: "phone", params: { first: baseParams.first, last: baseParams.last, phone: baseParams.phone } },
      { label: "birth", params: { first: baseParams.first, last: baseParams.last, birthYear: baseParams.birthYear } },
      { label: "fallback", params: { first: baseParams.first, last: baseParams.last } },
      { label: "full+state", params: { full: baseParams.full, state: baseParams.state } },
      { label: "first+last+state", params: { first: baseParams.first, last: baseParams.last, state: baseParams.state } },
      { label: "full", params: { full: baseParams.full } }
    ].filter(a => Object.values(a.params).some(v => v));

    const allRecords = [];
    for (const attempt of searchAttempts) {
      try {
        const raw = await callMelissaSearchAPI(attempt.params);
        if (raw?.Records) allRecords.push(...raw.Records);
      } catch (e) { console.error(e); }
    }

    const matchedRaw = dedupRawMelissaRecords(allRecords);
    setLoading(false);

    if (matchedRaw.length === 0) { setEmptyMessage("No records found."); showEmpty(true); return; }

    melissaRecords = dedupMelissaRows(mapMelissaRecords(matchedRaw)).map(r => Object.freeze(r));
    filteredRecords = [...melissaRecords];
    renderResults(filteredRecords);
    showResults(true);
    melissaTableRendered = true;

  } catch (err) {
    setLoading(false);
    showBanner("Error: " + err.message, "error");
  }
});

// Helper: API Call
async function callMelissaSearchAPI(params) {
  const optional = (key, value) => value ? "&" + key + "=" + encodeURIComponent(value) : "";
  let url = `${PERSONATOR_ENDPOINT}?id=${encodeURIComponent(PERSONATOR_LICENSE_KEY)}&format=JSON&cols=GrpAll,PreviousAddress,DateOfBirth`;
  
  if (params.first) url += optional("first", params.first);
  if (params.last) url += optional("last", params.last);
  if (params.full) url += optional("full", params.full);
  if (params.state) url += optional("state", params.state);
  if (params.postal) url += optional("postal", params.postal);
  if (params.email) url += optional("email", params.email);
  if (params.phone) url += optional("phone", params.phone);
  if (params.birthYear) url += optional("dob", params.birthYear);
  
  url += "&opt=ReturnAllPages:True,SearchConditions:loose";
  const resp = await fetch(url);
  return await resp.json();
}

// Helper: Mapping Data
function mapMelissaRecords(records) {
  const rows = [];
  records.forEach((record, idx) => {
    const label = `Person #${idx + 1}`;
    const p = (record.PhoneRecords?.[0]?.Phone || record.Phone || "");
    const e = (record.EmailRecords?.[0]?.Email || record.Email || "");
    
    const rowBase = { 
        melissaRecordLabel: label, 
        firstName: record.FirstName || record.First || "", 
        lastName: record.LastName || record.Last || "", 
        phone: p, email: e 
    };

    if (record.CurrentAddress) {
        rows.push({ ...rowBase, dataType: "Current", homeAddressStreet: record.CurrentAddress.AddressLine1 || "", homeAddressState: record.CurrentAddress.State || "", homeAddressCity: record.CurrentAddress.City || "", homeAddressZip: record.CurrentAddress.PostalCode || "" });
    }
  });
  return rows;
}

// Boilerplate Functions (same as previous)
function fetchCurrentLead(id) { return ZOHO.CRM.API.getRecord({ Entity: "Leads", RecordID: id }).then(r => r.data[0]); }
function persistLeadSearchCriteria(id, rec) { /* Same as previous */ }
function renderResults(records) { /* Same as previous */ }
function selectRecord(idx) { /* Same as previous */ }
function updateLeadRecord() { /* Same as previous */ }
function buildUpdatePayload(id, rec) { /* Same as previous */ }

ZOHO.embeddedApp.init();
