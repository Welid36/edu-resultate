/* ============================================================
   قائمة الأوائل — نتائج البكالوريا 2026
   يحمّل data/results.json نفسه (بدون تعديل)، ويحسب في المتصفح
   أفضل 3 طلاب وطنيًا في كل شعبة من بين الناجحين ("Admis").
   عند رفع نتائج سنة جديدة (results.xlsx -> results.json) هذه
   الصفحة تُحدَّث تلقائيًا دون أي تعديل على الكود.
   ============================================================ */

(function () {
  "use strict";

  const DATA_URL = "data/results.json";
  const MEDALS = ["🥇", "🥈", "🥉"];

  const els = {
    status: document.getElementById("status-line"),
    board: document.getElementById("top-board"),
  };

  function setStatus(text, kind) {
    els.status.textContent = text || "";
    els.status.classList.remove("is-loading", "is-error");
    if (kind) els.status.classList.add(kind);
  }

  function fmtMoy(v) {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toFixed(2).replace(".", "٫");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (ch) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
  }

  function podiumItemHTML(r, c, dicts, place) {
    const etab = dicts.etab[r[c.etab]];
    const wilaya = dicts.wilaya[r[c.wilaya]];
    const nomAr = escapeHtml(r[c.nomAr]);
    const nomFr = escapeHtml(r[c.nomFr]);
    const etabLabel = escapeHtml(etab ? (etab[1] || etab[0]) : "");
    const wilayaLabel = escapeHtml(wilaya ? wilaya[1] : "");
    return `
      <div class="podium-item rank-${place}">
        <span class="medal" aria-hidden="true">${MEDALS[place - 1]}</span>
        <span class="podium-name">${nomAr || "—"}${nomFr ? `<span class="fr">${nomFr}</span>` : ""}</span>
        <span class="podium-meta">${etabLabel}${wilayaLabel ? ` · ${wilayaLabel}` : ""}</span>
        <span class="podium-moy">${fmtMoy(r[c.moy])} / 20</span>
      </div>`;
  }

  function serieBlockHTML(serieIdx, list, c, dicts) {
    const meta = dicts.serie[serieIdx]; // [code, fr, ar]
    const items = list
      .map((r, i) => podiumItemHTML(r, c, dicts, i + 1))
      .join("");
    return `
      <div class="serie-block">
        <h2 class="serie-block-title">${escapeHtml(meta[2])} <span class="fr">${escapeHtml(meta[1])}</span></h2>
        <div class="podium">${items}</div>
      </div>`;
  }

  async function run() {
    setStatus("جارٍ تحميل قائمة الأوائل…", "is-loading");
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error("network");
      const payload = await res.json();

      const dicts = payload.dicts;
      const rows = payload.rows;
      const c = {};
      payload.cols.forEach((name, i) => (c[name] = i));

      const admisIdx = dicts.decision.indexOf("Admis");
      if (admisIdx === -1) {
        setStatus("");
        els.board.innerHTML = `<div class="top-empty">لا توجد بيانات نجاح متاحة لعرض الأوائل.</div>`;
        return;
      }

      // تجميع الناجحين حسب الشعبة
      const bySerie = new Map();
      rows.forEach((r) => {
        if (r[c.decision] !== admisIdx) return;
        const s = r[c.serie];
        if (!bySerie.has(s)) bySerie.set(s, []);
        bySerie.get(s).push(r);
      });

      // ترتيب الشعب بنفس ترتيب ظهورها في قاموس البيانات
      const serieIdxs = Array.from(bySerie.keys()).sort((a, b) => a - b);

      const blocks = serieIdxs
        .map((sIdx) => {
          const top3 = bySerie
            .get(sIdx)
            .slice()
            .sort((a, b) => b[c.moy] - a[c.moy])
            .slice(0, 3);
          return serieBlockHTML(sIdx, top3, c, dicts);
        })
        .join("");

      els.board.innerHTML =
        blocks || `<div class="top-empty">لا توجد بيانات كافية لعرض الأوائل.</div>`;
      setStatus("");
    } catch (err) {
      setStatus("تعذّر تحميل بيانات الأوائل. تحقّق من الاتصال وأعد المحاولة.", "is-error");
    }
  }

  run();
})();
