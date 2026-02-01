/* Trasporti PWA — logica base + Batch/Convertitori + GEO + km/disagiata
   - Carica JSON (articoli + tariffe + geo province)
   - Calcolo: PALLET / GROUPAGE  (GLS disabilitato se non configurato)
*/

const $ = (id) => document.getElementById(id);

let DB = {
  articles: [],
  palletRates: null,
  groupageRates: null,
};

let GEO = null; // geo_provinces.json (Regione -> Province)

const UI = {
  // Core
  service: $("service"),
  region: $("region"),
  province: $("province"),
  provinceField: $("provinceField"),
  q: $("q"),
  article: $("article"),
  qty: $("qty"),
  palletType: $("palletType"),
  palletTypeField: $("palletTypeField"),
  lm: $("lm"),
  lmField: $("lmField"),
  quintali: $("quintali"),
  quintaliField: $("quintaliField"),
  palletCount: $("palletCount"),
  palletCountField: $("palletCountField"),

  // New fields
  kmOver: $("kmOver"),
  optDisagiata: $("optDisagiata"),

  optPreavviso: $("optPreavviso"),
  optAssicurazione: $("optAssicurazione"),
  optSponda: $("optSponda"),
  extraNote: $("extraNote"),
  btnCalc: $("btnCalc"),
  btnCopy: $("btnCopy"),
  markupMode: $("markupMode"),
  markupPct: $("markupPct"),
  outClientPrice: $("outClientPrice"),

  outCost: $("outCost"),
  outText: $("outText"),
  outAlerts: $("outAlerts"),

  dbgArticle: $("dbgArticle"),
  dbgRules: $("dbgRules"),
  dbgData: $("dbgData"),
  pwaStatus: $("pwaStatus"),

  // Batch / Convertitori
  fileArticlesCsv: $("fileArticlesCsv"),
  fileGeoCsv: $("fileGeoCsv"),
  fileOfferCsv: $("fileOfferCsv"),
  batchPickCheapest: $("batchPickCheapest"),
  batchUseArticlePallet: $("batchUseArticlePallet"),
  btnExportArticles: $("btnExportArticles"),
  btnExportGeo: $("btnExportGeo"),
  btnRunBatch: $("btnRunBatch"),
  btnExportBatch: $("btnExportBatch"),
  batchLog: $("batchLog"),
};

const MEM = {
  generatedArticlesJSON: null,
  generatedGeoJSON: null,
  batchCSVResult: null
};

function moneyEUR(v){
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("it-IT", { style:"currency", currency:"EUR" }).format(v);
}

// --- Prezzo cliente (Client-ready) ---
// In questa variante il cliente non vede Ricarico/Margine:
// il totale mostrato è sempre costo * 1,30.
const CLIENT_MULTIPLIER = 1.30;

// Keep last computed "costo interno" (non mostrato)
let LAST_COST = 0;

function round2(n){ return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

function computeClientPrice(cost){
  const c = Number(cost);
  if(!isFinite(c)) return 0;
  return round2(c * CLIENT_MULTIPLIER);
}

function hideMarkupControls(){
  const modeEl = document.getElementById('markupMode');
  const pctEl  = document.getElementById('markupPct');
  const clientEl = document.getElementById('outClientPrice');

  if(modeEl && modeEl.closest('.price')) modeEl.closest('.price').style.display = 'none';
  if(pctEl  && pctEl.closest('.price'))  pctEl.closest('.price').style.display  = 'none';
  if(clientEl && clientEl.closest('.price')) clientEl.closest('.price').style.display = 'none';
}

function updateClientPriceDisplay(){
  // compat: chiamata da varie parti, qui serve solo a nascondere i controlli
  hideMarkupControls();
}

  if(UI.markupPct)  UI.markupPct.addEventListener('change', () => updateClientPriceDisplay());

  updateClientPriceDisplay();

  // Flag/opzioni: ricalcolo costo + prezzo cliente in tempo reale
  const flagEls = [UI.optPreavviso, UI.optAssicurazione, UI.optSponda, UI.chkZona, UI.distKm, UI.qty, UI.palletType, UI.region, UI.province, UI.article, UI.search];
  flagEls.forEach(el => {
    if(!el) return;
    el.addEventListener('input',  () => triggerLiveRecalc());
    el.addEventListener('change', () => triggerLiveRecalc());
  });


  // Filter provinces when region changes
  UI.region.addEventListener("change", () => {
    const regRaw = UI.region.value;
    const reg = regRaw; // GEO potrebbe essere in formato diverso
    const allowed = (GEO && reg && GEO[reg]) ? GEO[reg].map(normalizeProvince) : null;

    if(allowed && allowed.length){
      fillSelect(UI.province, uniq(allowed), { placeholder: "— Seleziona Provincia —" });
    } else {
      fillSelect(UI.province, allProvincesFallback, { placeholder: "— Seleziona Provincia —" });
    }
  });

  UI.province.addEventListener("change", () => {
    const v = normalizeProvince(UI.province.value);
    if(UI.province.value !== v) UI.province.value = v;
  });

  applyServiceUI();
  UI.outText.textContent = "Pronto. Seleziona servizio, destinazione e articolo, poi Calcola.";
  UI.dbgData.textContent = `articoli=${DB.articles.length} | regioni=${regions.length} | province=${(allProvincesFallback||[]).length}`;
}

window.addEventListener("DOMContentLoaded", init);