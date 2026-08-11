/* ============================================================
   نتائج البكالوريا 2026 — منطق التطبيق
   يحمّل data/results.json (نسخة مضغوطة بالفهرسة من results.xlsx)
   ثم يبني فهرسًا للبحث برقم الباكالوريا أو بالاسم الكامل.
   ============================================================ */

(function () {
  "use strict";

  const DATA_URL = "data/RESULTATS_BAC_SC_2025_7072_Ap_CT.json";

  const els = {
    form: document.getElementById("search-form"),
    input: document.getElementById("search-input"),
    hint: document.getElementById("field-hint"),
    status: document.getElementById("status-line"),
    tabs: Array.from(document.querySelectorAll(".tab")),
    resultZone: document.getElementById("result-zone"),
    resultCard: document.getElementById("result-card"),
  };

  let mode = "numbac"; // or "name"
  let ready = false;
  let admisIdx = -1;

  // populated once data loads
  let dicts = null;   // { wilaya, centre, etab, serie, lieu, decision }
  let rows = [];       // array of raw row arrays
  let colIndex = {};   // column name -> position in a row
  let byNumBac = new Map(); // numbac string -> row array

  /* ---------------- audio & confetti helper ---------------- */

  function triggerSuccess() {
    // 1. تشغيل صوت النجاح
    const successAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
    successAudio.play().catch((error) => {
      console.warn("لم يتم تشغيل الصوت تلقائياً بسبب إعدادات المتصفح:", error);
    });

    // 2. إطلاق القصاصات الملونة (إذا كانت مكتبة confetti محمّلة)
    if (typeof confetti === "function") {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 }
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 }
      });
    }
  }

  /* ---------------- data loading ---------------- */

  function setStatus(text, kind) {
    els.status.textContent = text || "";
    els.status.classList.remove("is-loading", "is-error");
    if (kind) els.status.classList.add(kind);
  }

  async function loadData() {
    setStatus("جارٍ تحميل قاعدة النتائج…", "is-loading");
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error("network");
      const payload = await res.json();

      dicts = payload.dicts;
      rows = payload.rows;
      payload.cols.forEach((name, i) => (colIndex[name] = i));

      const nbIdx = colIndex["numbac"];
      rows.forEach((r) => byNumBac.set(String(r[nbIdx]), r));

      computeRanks();
      renderStats();

      ready = true;
      setStatus("");
    } catch (err) {
      setStatus("تعذّر تحميل ملف النتائج. تحقّق من الاتصال وأعد المحاولة.", "is-error");
    }
  }

  /* ---------------- header statistics strip ---------------- */

  function fmtInt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function renderStats() {
    const c = colIndex;
    const total = rows.length;
    let admisCount = 0;
    let topMoy = null;

    rows.forEach((r) => {
      if (r[c.decision] === admisIdx) {
        admisCount++;
        if (topMoy === null || r[c.moy] > topMoy) topMoy = r[c.moy];
      }
    });

    const successRate = total ? Math.round((admisCount / total) * 100) : 0;
    const wilayaCount = dicts.wilaya.length;

    setText("stat-total", fmtInt(total));
    setText("stat-success", successRate + "%");
    setText("stat-wilayas", fmtInt(wilayaCount));
    setText("stat-top", topMoy !== null ? fmtMoy(topMoy) + " / 20" : "—");
  }

  /* ---------------- ranking ---------------- */

  function computeRanks() {
    const c = colIndex;
    admisIdx = dicts.decision.indexOf("Admis");
    if (admisIdx === -1) return;

    const groups = {
      nat: new Map(),
      wil: new Map(),
      cen: new Map(),
      eta: new Map(),
    };

    function push(map, key, i, moy) {
      let arr = map.get(key);
      if (!arr) { arr = []; map.set(key, arr); }
      arr.push({ i, moy });
    }

    rows.forEach((r, i) => {
      if (r[c.decision] !== admisIdx) return;
      const serie = r[c.serie];
      const moy = r[c.moy];
      push(groups.nat, serie, i, moy);
      push(groups.wil, serie + "_" + r[c.wilaya], i, moy);
      push(groups.cen, serie + "_" + r[c.centre], i, moy);
      push(groups.eta, serie + "_" + r[c.etab], i, moy);
    });

    function assign(map, prop) {
      map.forEach((arr) => {
        arr.sort((a, b) => b.moy - a.moy);
        let rank = 0;
        let prevMoy = null;
        arr.forEach((item, idx) => {
          if (item.moy !== prevMoy) {
            rank = idx + 1;
            prevMoy = item.moy;
          }
          rows[item.i][prop] = { rank, total: arr.length };
        });
      });
    }

    assign(groups.nat, "__rankNat");
    assign(groups.wil, "__rankWil");
    assign(groups.cen, "__rankCen");
    assign(groups.eta, "__rankEta");
  }

  /* ---------------- row -> record helpers ---------------- */

  function rec(r) {
    const c = colIndex;
    const wilaya = dicts.wilaya[r[c.wilaya]];
    const centre = dicts.centre[r[c.centre]];
    const etab = dicts.etab[r[c.etab]];
    const serie = dicts.serie[r[c.serie]];
    const lieu = dicts.lieu[r[c.lieu]];
    const decision = dicts.decision[r[c.decision]];
    return {
      noreg: r[c.noreg],
      wilayaFr: wilaya[0], wilayaAr: wilaya[1],
      centreFr: centre[0], centreAr: centre[1],
      etabFr: etab[0], etabAr: etab[1],
      numbac: r[c.numbac],
      serieCode: serie[0], serieFr: serie[1], serieAr: serie[2],
      nomFr: r[c.nomFr], nomAr: r[c.nomAr],
      lieuFr: lieu[0], lieuAr: lieu[1],
      moy: r[c.moy],
      decision: decision,
      rankNat: r.__rankNat || null,
      rankWil: r.__rankWil || null,
      rankCen: r.__rankCen || null,
      rankEta: r.__rankEta || null,
    };
  }

  /* ---------------- search ---------------- */

  function normalizeArabic(s) {
    return String(s)
      .trim()
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function searchByNumBac(query) {
    const hit = byNumBac.get(query.trim());
    return hit ? [hit] : [];
  }

  function searchByName(query) {
    const q = normalizeArabic(query);
    if (!q) return [];
    const c = colIndex;
    const out = [];
    for (const r of rows) {
      const ar = normalizeArabic(r[c.nomAr] || "");
      const fr = normalizeArabic(r[c.nomFr] || "");
      if (ar.includes(q) || fr.includes(q)) {
        out.push(r);
        if (out.length >= 25) break;
      }
    }
    return out;
  }

  /* ---------------- rendering ---------------- */

  const DECISION_META = {
    "Admis": { word: "ناجح", cls: "status-admis" },
    "Ajourné": { word: "غير ناجح", cls: "status-ajourne" },
    "Annulation de l’examen": { word: "ملغى", cls: "status-annule" },
    "Annulation de l'examen": { word: "ملغى", cls: "status-annule" },
  };

  function decisionMeta(decision) {
    return (
      DECISION_META[decision] || {
        word: decision || "—",
        cls: "status-sessionnaire",
      }
    );
  }

  function fmtMoy(v) {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toFixed(2).replace(".", "٫");
  }

  function fieldHTML(label, valueAr, valueFr) {
    return `
      <div class="rc-field">
        <span class="rc-field-label">${label}</span>
        <span class="rc-field-value">${valueAr || "—"}${
      valueFr ? `<span class="fr">${valueFr}</span>` : ""
    }</span>
      </div>`;
  }

  function rankBadgeHTML(label, rankObj) {
    if (!rankObj) return "";
    return `
      <div class="rank-badge">
        <span class="rank-badge-label">${label}</span>
        <span class="rank-badge-value">${rankObj.rank}<span class="of"> من ${rankObj.total}</span></span>
      </div>`;
  }

  function ranksHTML(r) {
    if (!r.rankNat) return "";
    return `
      <div class="rc-ranks">
        ${rankBadgeHTML("الترتيب الوطني", r.rankNat)}
        ${rankBadgeHTML("ترتيب الولاية", r.rankWil)}
        ${rankBadgeHTML("ترتيب المركز", r.rankCen)}
        ${rankBadgeHTML("ترتيب المؤسسة", r.rankEta)}
      </div>`;
  }

  function renderRecord(row) {
    const r = rec(row);
    const meta = decisionMeta(r.decision);

    els.resultCard.innerHTML = `
      <div class="rc-top">
        <div class="rc-names">
          <span class="rc-name-ar">${r.nomAr || ""}</span>
          <span class="rc-name-fr">${r.nomFr || ""}</span>
          <span class="rc-numbac">رقم الباكالوريا: ${r.numbac}</span>
        </div>
        <div class="rc-stamp ${meta.cls}">
          <span class="rc-stamp-word">${meta.word}</span>
        </div>
      </div>
      <div class="rc-body">
        <div class="rc-grid">
          ${fieldHTML("الشعبة", r.serieAr, r.serieFr)}
          ${fieldHTML("الولاية", r.wilayaAr, r.wilayaFr)}
          ${fieldHTML("مركز الامتحان", r.centreAr, r.centreFr)}
          ${fieldHTML("المؤسسة", r.etabAr, r.etabFr)}
        
          <div class="rc-moy">
            <span class="rc-moy-label">المعدل العام</span>
            <span class="rc-moy-value">${fmtMoy(r.moy)} / 20</span>
          </div>
        </div>
        ${ranksHTML(r)}
      </div>`;
      
    els.resultZone.hidden = false;
    els.resultZone.scrollIntoView({ behavior: "smooth", block: "start" });

    // تشغيل تفاعل الصوت والاحتفال عند النجاح فقط (Admis)
    if (r.decision === "Admis") {
      triggerSuccess();
    }
  }

  function renderMultiple(list, query) {
    const rowsHtml = list
      .map((row) => {
        const r = rec(row);
        const meta = decisionMeta(r.decision);
        return `
        <button type="button" class="rc-pick" data-numbac="${r.numbac}">
          <span class="rc-pick-name">${r.nomAr || ""} <span class="fr">${
          r.nomFr || ""
        }</span></span>
          <span class="rc-pick-meta ${meta.cls}">${meta.word}</span>
        </button>`;
      })
      .join("");

    els.resultCard.innerHTML = `
      <div class="rc-notfound" style="text-align:right;padding:22px 24px;">
        <strong>عُثر على ${list.length} نتيجة مطابقة لـ «${query}»</strong>
        <div class="rc-pick-list">${rowsHtml}</div>
      </div>`;
    els.resultZone.hidden = false;
    els.resultZone.scrollIntoView({ behavior: "smooth", block: "start" });

    els.resultCard.querySelectorAll(".rc-pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = byNumBac.get(btn.dataset.numbac);
        if (row) renderRecord(row);
      });
    });
  }

  function renderNotFound(query) {
    els.resultCard.innerHTML = `
      <div class="rc-notfound">
        <strong>لم يُعثر على نتيجة</strong>
        <span>تحقّق من رقم الباكالوريا أو الاسم «${query}» وأعد المحاولة.</span>
      </div>`;
    els.resultZone.hidden = false;
    els.resultZone.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------- events ---------------- */

  function setMode(next) {
    mode = next;
    els.tabs.forEach((t) => {
      const active = t.dataset.mode === mode;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", String(active));
    });
    if (mode === "numbac") {
      els.input.setAttribute("inputmode", "numeric");
      els.input.placeholder = "مثال: 12345";
      els.hint.textContent = "رقم الباكالوريا مكوّن من 5أرقام فقط، ويوجد على استدعاء الامتحان.";
    } else {
      els.input.setAttribute("inputmode", "text");
      els.input.placeholder = "مثال: أحمد سالم أحمد";
      els.hint.textContent = "اكتب الاسم الكامل كما هو مسجَّل، بالعربية أو الفرنسية.";
    }
    els.input.value = "";
    els.input.focus();
  }

  els.tabs.forEach((t) => {
    t.addEventListener("click", () => setMode(t.dataset.mode));
  });

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = els.input.value.trim();
    if (!query) return;

    if (!ready) {
      setStatus("لا تزال قاعدة النتائج قيد التحميل، رجاءً انتظر لحظة…", "is-loading");
      return;
    }
    setStatus("");

    if (mode === "numbac") {
      const hits = searchByNumBac(query);
      hits.length ? renderRecord(hits[0]) : renderNotFound(query);
    } else {
      const hits = searchByName(query);
      if (hits.length === 0) renderNotFound(query);
      else if (hits.length === 1) renderRecord(hits[0]);
      else renderMultiple(hits, query);
    }
  });

  loadData();
})();