// ===============================================================
//  Pagina de verificare a rapoartelor (pentru profesor)
// ===============================================================

(() => {
  const esc = Common.escapeHtml;
  const box = document.getElementById("rezultat");

  async function verifica(text) {
    const cod = (text.includes("#") ? text.split("#").pop() : text).trim();
    if (!cod) { box.innerHTML = ""; return; }
    const { valid, rezultat: r } = await Common.verificaCod(cod);

    if (!valid || !r) {
      box.innerHTML = `
        <div class="card verif-banner invalid">
          <h2>✗ Raport NEVALID</h2>
          <p>Codul nu corespunde datelor. Raportul a fost modificat sau codul a fost copiat greșit.</p>
        </div>`;
      return;
    }

    const teme = await Common.incarcaTeme().catch(() => []);
    const tema = teme.find((t) => t.id === r.t);
    let detalii = "";
    let banca = null;
    try { banca = await Common.incarcaIntrebari(r.t, r.f); } catch {}

    if (banca) {
      const dupaId = Object.fromEntries(banca.map((q) => [q.id, q]));
      const randuri = r.a.map(([id, alegere], i) => {
        const q = dupaId[id];
        if (!q) return `<li class="rez-item"><span class="rez-nr">${i + 1}</span> Întrebarea „${esc(id)}” nu mai există în bancă.</li>`;
        const st = Common.stare(q, alegere);
        return `<li class="rez-item ${st}">
          <div class="rez-cap"><span class="rez-nr">${i + 1}</span><span class="insigna ${st}">${Common.ETICHETE[st]}</span></div>
          ${q.imagine ? `<img class="rez-img" src="intrebari/${esc(r.t)}/${esc(q.imagine)}" alt="">` : ""}
          <p class="rez-intrebare">${esc(q.intrebare)}</p>
          <p class="rez-rasp">Răspunsul elevului: <strong>${alegere >= 0 ? esc(q.variante[alegere]) : "<em>niciun răspuns</em>"}</strong></p>
          ${st !== "corect" ? `<p class="rez-rasp">Răspuns corect: <strong>${esc(q.variante[q.corect])}</strong></p>` : ""}
        </li>`;
      });
      detalii = `<div class="card"><h2>Răspunsurile originale</h2><ol class="rez-lista">${randuri.join("")}</ol></div>`;
    }

    box.innerHTML = `
      <div class="card verif-banner valid">
        <h2>✓ Raport autentic</h2>
        <p>Comparați datele de mai jos cu cele din PDF. Dacă diferă, PDF-ul a fost modificat.</p>
        <dl class="verif-date">
          <dt>Elev</dt><dd>${esc(r.n)} ${esc(r.p)}</dd>
          <dt>Școala</dt><dd>${esc(r.s)}</dd>
          <dt>Clasa</dt><dd>${esc(r.c)}</dd>
          <dt>Tema</dt><dd>${esc(tema ? tema.titlu : r.t)}</dd>
          <dt>Nivel</dt><dd>${esc(r.l)}</dd>
          <dt>Data</dt><dd>${Common.formatData(r.d * 1000)}</dd>
          <dt>Scor</dt><dd class="verif-scor">${r.k} / ${r.x}</dd>
          <dt>Cod</dt><dd>${Common.codScurt(cod)}</dd>
        </dl>
      </div>${detalii}`;
  }

  const input = document.getElementById("cod");
  document.getElementById("form-verif").addEventListener("submit", (e) => {
    e.preventDefault();
    verifica(input.value);
  });

  if (location.hash.length > 1) {
    input.value = location.hash.slice(1);
    verifica(location.hash.slice(1));
  }
  window.addEventListener("hashchange", () => verifica(location.hash.slice(1)));
})();
