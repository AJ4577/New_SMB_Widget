/* =============================================================
 * Melissa Personator Search — ULTIMATE 8-CONDITION LADDER
 * FIXED: Email and Phone extraction logic
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

let sdkReady = false;
let currentLeadId = null;
let currentLeadRecord = null;
let melissaRecords = [];
let filteredRecords = [];
let selectedMelissaRecord = null;
let selectedIndex = -1;
let melissaTableRendered = false;
let searchLeadRecord = null;

const LEAD_SNAPSHOT_STORAGE_PREFIX = "melissaWidget:leadSearch_VFINAL_FIXED_:";

// --- ZOHO INIT ---
ZOHO.embeddedApp.on("PageLoad", async function (data) {
  sdkReady = true;
  if (data?.EntityId) currentLeadId = Array.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
  
  if (!currentLeadId) return;

  try {
    currentLeadRecord = await ZOHO.CRM.API.getRecord({ Entity: "Leads", RecordID: currentLeadId }).then(r => r.data[0]);
    const baseParams = buildMelissaSearchParams(currentLeadRecord);
    
    // 8-Step Ladder
    const attempts = [
      { params: { first: baseParams.first, last: baseParams.last, email: baseParams.email } },
      { params: { first: baseParams.first, last: baseParams.last, postal: baseParams.postal } },
      { params: { first: baseParams.first, last: baseParams.last, phone: baseParams.phone } },
      { params: { first: baseParams.first, last: baseParams.last, birthYear: baseParams.birthYear } },
      { params: { first: baseParams.first, last: baseParams.last } },
      { params: { full: baseParams.full, state: baseParams.state } },
      { params: { first: baseParams.first, last: baseParams.last, state: baseParams.state } },
      { params: { full: baseParams.full } }
    ].filter(a => Object.values(a.params).some(v => v));

    let allRecords = [];
    for (const a of attempts) {
      try {
        const url = buildApiUrl(a.params);
        const res = await fetch(url).then(r => r.json());
        if (res?.Records) allRecords.push(...res.Records);
      } catch(e) { console.error(e); }
    }

    const uniqueRaw = [...new Map(allRecords.map(item => [getMelissaUniqueKey(item), item])).values()];
    melissaRecords = mapMelissaRecords(uniqueRaw);
    filteredRecords = [...melissaRecords];
    renderResults(filteredRecords);
    showResults(true);
    setLoading(false);
  } catch (err) { setLoading(false); showBanner("Error: " + err.message, "error"); }
});

// --- URL BUILDER (Fixed) ---
function buildApiUrl(params) {
  let url = `${PERSONATOR_ENDPOINT}?id=${encodeURIComponent(PERSONATOR_LICENSE_KEY)}&format=JSON&cols=GrpAll,PreviousAddress,DateOfBirth`;
  Object.keys(params).forEach(k => {
    if (params[k]) url += `&${k === 'birthYear' ? 'dob' : k}=${encodeURIComponent(params[k])}`;
  });
  return url + "&opt=ReturnAllPages:True,SearchConditions:loose";
}

// --- EMAIL/PHONE EXTRACTION (Fixed) ---
function mapMelissaRecords(records) {
  const rows = [];
  records.forEach((rec, i) => {
    // Robust extraction: Check PhoneRecords array or top-level phone
    const phone = rec.PhoneRecords?.[0]?.Phone || rec.PhoneRecords?.[0]?.PhoneNumber || rec.Phone || "";
    const email = rec.EmailRecords?.[0]?.Email || rec.EmailRecords?.[0]?.EmailAddress || rec.Email || "";
    
    const base = { 
      melissaRecordLabel: `Person #${i+1}`, 
      firstName: rec.FirstName || rec.First || "", 
      lastName: rec.LastName || rec.Last || "", 
      phone, email,
      birthYear: String(rec.DateOfBirth || "").substring(0, 4)
    };

    if (rec.CurrentAddress) {
      rows.push({ ...base, dataType: "Current", homeAddressStreet: rec.CurrentAddress.AddressLine1 || "", homeAddressState: rec.CurrentAddress.State || "", homeAddressCity: rec.CurrentAddress.City || "", homeAddressZip: rec.CurrentAddress.PostalCode || "" });
    }
  });
  return rows;
}

// --- BOILERPLATE HELPERS ---
function buildMelissaSearchParams(lead) {
  return {
    first: lead.First_Name || "", last: lead.Last_Name || "",
    full: (lead.First_Name + " " + lead.Last_Name).trim(),
    state: lead.State || lead.LOCATION_ADDRESS_STATE || "",
    postal: lead.Home_Address_Zip || lead.Zip_Code || "",
    email: lead.Email || "", phone: lead.Phone || lead.Mobile || "",
    birthYear: String(lead.Year_of_Birth || "")
  };
}
function getMelissaUniqueKey(r) { return (r.MelissaIdentityKey || "") + (r.CurrentAddress?.AddressLine1 || ""); }
function showResults(s) { document.getElementById("resultsWrapper").classList.toggle("hidden", !s); }
function setLoading(l) { document.getElementById("loadingState").classList.toggle("hidden", !l); }
function showBanner(m, t) { const b = document.getElementById("banner"); b.textContent = m; b.className = `banner banner-${t}`; }
function renderResults(records) {
    const body = document.getElementById("resultsBody");
    body.innerHTML = records.map((r, i) => `
        <tr onclick="selectRecord(${i})">
            <td>${r.melissaRecordLabel}</td><td>${r.firstName}</td><td>${r.lastName}</td>
            <td>${r.birthYear}</td><td>${r.dataType}</td><td>${r.homeAddressStreet}</td>
            <td>${r.homeAddressState}</td><td>${r.homeAddressCity}</td><td>${r.homeAddressZip}</td>
            <td>${r.phone || '—'}</td><td>${r.email || '—'}</td>
            <td><button>Select</button></td>
        </tr>
    `).join('');
}

ZOHO.embeddedApp.init();
