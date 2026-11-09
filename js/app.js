// ===============================================================
//  Aplicația principală: date elev → nivel → temă → test → rezultat
// ===============================================================

(() => {
  const CHEIE_STARE = "englishtest_stare";
  const CHEIE_ELEV = "englishtest_elev";
  const LITERE = ["A", "B", "C", "D"];

  const $ = (id) => document.getElementById(id);
  const esc = Common.escapeHtml;

  let teme = [];
  let stare = null;        // starea testului (salvată în browser)
  let intrebari = [];      // întrebările complete ale testului curent
  let selectie = null;     // indexul original al variantei selectate
  let termen = 0;          // momentul în care expiră întrebarea curentă
  let cronometru = null;
  let bancaTema = [];      // toate întrebările temei alese

  // ---------- stocare (protejată, poate lipsi) ----------
  const stocare = {
    citeste(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    scrie(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    sterge(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const salveaza = () => stocare.scrie(CHEIE_STARE, stare);

  function arata(id) {
    document.querySelectorAll(".ecran").forEach((s) => (s.hidden = s.id !== id));
    window.scrollTo(0, 0);
  }

  function notifica(text) {
    const n = $("notificare");
    n.textContent = text;
    n.hidden = false;
    clearTimeout(notifica.t);
    notifica.t = setTimeout(() => (n.hidden = true), 5000);
  }

  function eroare(text) {
    $("text-eroare").textContent = text;
    arata("ecran-eroare");
  }

  function afiseazaElev() {
    const e = stare?.elev;
    $("info-elev").textContent = e ? `${e.prenume} ${e.nume} · ${e.clasa}` : "";
  }

  // ---------- 1. Datele elevului ----------
  function initDate() {
    const f = $("form-date");
    const salvat = stocare.citeste(CHEIE_ELEV);
    if (salvat) for (const k in salvat) if (f.elements[k]) f.elements[k].value = salvat[k];

    f.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const elev = {};
      let ok = true;
      for (const k of ["nume", "prenume", "scoala", "clasa"]) {
        elev[k] = f.elements[k].value.trim().replace(/\s+/g, " ");
        f.elements[k].classList.toggle("invalid", !elev[k]);
        if (!elev[k]) ok = false;
      }
      $("eroare-date").hidden = ok;
      if (!ok) return;
      stocare.scrie(CHEIE_ELEV, elev);
      stare = { elev };
      afiseazaElev();
      arataNiveluri();
    });

    document.querySelectorAll("[data-inapoi]").forEach((b) =>
      b.addEventListener("click", () => arata(b.dataset.inapoi))
    );
  }

  // ---------- 2. Nivelul ----------
  function arataNiveluri() {
    const box = $("lista-niveluri");
    box.innerHTML = "";
    CONFIG.niveluri.forEach((nivel) => {
      const nrTeme = teme.filter((t) => Common.fisierPentru(t, nivel)).length;
      const b = document.createElement("button");
      b.className = "btn-nivel";
      b.disabled = nrTeme === 0;
      b.innerHTML = `<span class="nivel-cod">${nivel}</span><span class="nivel-info">${
        nrTeme ? nrTeme + (nrTeme === 1 ? " temă" : " teme") : "în curând"
      }</span>`;
      b.addEventListener("click", () => {
        stare.nivel = nivel;
        arataTeme();
      });
      box.appendChild(b);
    });
    arata("ecran-nivel");
  }

  // ---------- 3. Tema ----------
  function arataTeme() {
    $("nivel-ales").textContent = stare.nivel;
    const box = $("lista-teme");
    box.innerHTML = "";
    teme
      .filter((t) => Common.fisierPentru(t, stare.nivel))
      .forEach((t) => {
        const b = document.createElement("button");
        b.className = "btn-tema";
        b.innerHTML = `<strong>${esc(t.titlu)}</strong>${t.descriere ? `<span>${esc(t.descriere)}</span>` : ""}`;
        b.addEventListener("click", () => alegeTema(t));
        box.appendChild(b);
      });
    arata("ecran-tema");
  }

  async function alegeTema(t) {
    const fisier = Common.fisierPentru(t, stare.nivel);
    try {
      const banca = await Common.incarcaIntrebari(t.id, fisier);
      stare.tema = { id: t.id, titlu: t.titlu, fisier };
      bancaTema = banca;
      $("titlu-tema-instr").textContent = t.titlu;
      $("nr-intrebari-banca").textContent = banca.length;
      $("nr-intrebari").textContent = Math.min(CONFIG.intrebariPeTest, banca.length);
      $("nr-secunde").textContent = CONFIG.secundePeIntrebare;
      arata("ecran-instructiuni");
    } catch (e) {
      eroare("Nu am putut încărca întrebările pentru această temă. " + e.message);
    }
  }

  // ---------- 4. Pornirea testului ----------
  const amesteca = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function startTest() {
    const banca = bancaTema;
    const alese = amesteca(banca).slice(0, Math.min(CONFIG.intrebariPeTest, banca.length));
    intrebari = alese;
    stare.intrebari = alese.map((q) => ({ id: q.id, ordine: amesteca([0, 1, 2, 3]) }));
    stare.raspunsuri = [];
    stare.curent = 0;
    stare.inceput = new Date().toISOString();
    salveaza();
    construiesteBaraProgres();
    arataIntrebare();
    arata("ecran-test");
  }

  function construiesteBaraProgres() {
    const b = $("bara-progres");
    b.innerHTML = stare.intrebari.map(() => "<span></span>").join("");
  }

  // ---------- 5. Desfășurarea testului ----------
  function arataIntrebare() {
    const i = stare.curent;
    const q = intrebari[i];
    const ordine = stare.intrebari[i].ordine;
    selectie = null;

    $("progres-text").textContent = `Întrebarea ${i + 1} din ${intrebari.length}`;
    [...$("bara-progres").children].forEach((s, k) =>
      s.className = k < i ? "facut" : k === i ? "curent" : ""
    );

    const img = $("imagine-intrebare");
    if (q.imagine) {
      img.innerHTML = `<img src="intrebari/${stare.tema.id}/${esc(q.imagine)}" alt="Ilustrație pentru întrebare">`;
      img.hidden = false;
    } else {
      img.hidden = true;
      img.innerHTML = "";
    }

    $("text-intrebare").innerHTML = formateazaText(q.intrebare);

    const box = $("variante");
    box.innerHTML = "";
    ordine.forEach((orig, poz) => {
      const b = document.createElement("button");
      b.className = "varianta";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.innerHTML = `<span class="litera">${LITERE[poz]}</span><span>${esc(q.variante[orig])}</span>`;
      b.addEventListener("click", () => {
        selectie = orig;
        box.querySelectorAll(".varianta").forEach((x) => {
          x.classList.toggle("selectat", x === b);
          x.setAttribute("aria-checked", x === b ? "true" : "false");
        });
        $("btn-valideaza").disabled = false;
      });
      box.appendChild(b);
    });
    $("btn-valideaza").disabled = true;

    pornesteCronometru();
  }

  // Textul întrebării: "______" devine un spațiu de completat evidențiat
  function formateazaText(t) {
    return esc(t).replace(/_{3,}/g, '<span class="gol">______</span>').replace(/\n/g, "<br>");
  }

  function pornesteCronometru() {
    clearInterval(cronometru);
    termen = Date.now() + CONFIG.secundePeIntrebare * 1000;
    actualizeazaTimp();
    cronometru = setInterval(actualizeazaTimp, 100);
  }

  function actualizeazaTimp() {
    const ramas = Math.max(0, termen - Date.now());
    const sec = Math.ceil(ramas / 1000);
    $("timer").textContent = sec + " s";
    $("timer").classList.toggle("urgent", sec <= 5);
    const plin = $("bara-timp-plin");
    plin.style.width = (ramas / (CONFIG.secundePeIntrebare * 1000)) * 100 + "%";
    plin.classList.toggle("urgent", sec <= 5);
    if (ramas <= 0) {
      // Timpul a expirat: contează varianta selectată, dacă există
      inregistreaza(selectie !== null ? selectie : -2);
    }
  }

  function inregistreaza(alegere) {
    clearInterval(cronometru);
    stare.raspunsuri[stare.curent] = alegere;
    stare.curent++;
    salveaza();
    if (stare.curent >= intrebari.length) finalizeaza();
    else arataIntrebare();
  }

  // ---------- 6. Rezultatul ----------
  async function finalizeaza() {
    clearInterval(cronometru);
    const scor = intrebari.filter((q, i) => Common.stare(q, stare.raspunsuri[i]) === "corect").length;
    stare.scor = scor;
    stare.final = new Date().toISOString();
    stare.terminat = true;
    const e = stare.elev;
    stare.cod = await Common.creeazaCod({
      v: 1, n: e.nume, p: e.prenume, s: e.scoala, c: e.clasa,
      l: stare.nivel, t: stare.tema.id, f: stare.tema.fisier,
      d: Math.floor(new Date(stare.final).getTime() / 1000),
      k: scor, x: intrebari.length,
      a: stare.intrebari.map((q, i) => [q.id, stare.raspunsuri[i]]),
    });
    salveaza();
    arataRezultat();
  }

  function mesajScor(proc) {
    if (proc >= 90) return "Excelent!";
    if (proc >= 75) return "Foarte bine!";
    if (proc >= 50) return "Bine!";
    return "Mai exersează!";
  }

  function arataRezultat() {
    const total = intrebari.length;
    const proc = Math.round((stare.scor / total) * 100);
    $("rez-tema").textContent = `${stare.tema.titlu} · Nivel ${stare.nivel}`;
    $("rez-scor").textContent = stare.scor;
    $("rez-total").textContent = "din " + total;
    $("rez-mesaj").textContent = mesajScor(proc);
    $("rez-detalii").textContent = `${proc}% răspunsuri corecte · ${Common.formatData(stare.final)}`;
    $("rez-cod").textContent = Common.codScurt(stare.cod);

    const lista = $("rez-lista");
    lista.innerHTML = "";
    intrebari.forEach((q, i) => {
      const alegere = stare.raspunsuri[i];
      const st = Common.stare(q, alegere);
      const li = document.createElement("li");
      li.className = "rez-item " + st;
      const raspElev = alegere >= 0 ? esc(q.variante[alegere]) : "<em>niciun răspuns</em>";
      li.innerHTML = `
        <div class="rez-cap"><span class="rez-nr">${i + 1}</span><span class="insigna ${st}">${Common.ETICHETE[st]}</span></div>
        ${q.imagine ? `<img class="rez-img" src="intrebari/${stare.tema.id}/${esc(q.imagine)}" alt="">` : ""}
        <p class="rez-intrebare">${formateazaText(q.intrebare)}</p>
        <p class="rez-rasp">Răspunsul tău: <strong>${raspElev}</strong></p>
        ${st !== "corect" ? `<p class="rez-rasp">Răspuns corect: <strong>${esc(q.variante[q.corect])}</strong></p>` : ""}
        ${q.explicatie ? `<p class="rez-expl">${esc(q.explicatie)}</p>` : ""}`;
      lista.appendChild(li);
    });
    arata("ecran-rezultat");
  }

  // ---------- PDF ----------
  let pdfCache = null;
  async function obtinePdf() {
    if (!pdfCache) pdfCache = await Raport.genereaza(stare, intrebari);
    return pdfCache;
  }
  function numeFisier() {
    const curat = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const e = stare.elev;
    return `Raport_${curat(e.nume)}_${curat(e.prenume)}_${curat(stare.tema.titlu)}_${stare.nivel}.pdf`;
  }
  function descarca(blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = numeFisier();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  function mesajPdf(t) {
    $("mesaj-pdf").textContent = t;
    $("mesaj-pdf").hidden = false;
  }

  async function trimite() {
    const btn = $("btn-trimite");
    btn.disabled = true;
    try {
      const blob = await obtinePdf();
      const file = new File([blob], numeFisier(), { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Raport test engleză", text: `Raportul meu: ${stare.tema.titlu}, ${stare.nivel}` });
          mesajPdf("Gata! Alege WhatsApp și conversația cu profesorul, dacă nu ai făcut-o deja.");
        } catch (e) {
          if (e.name !== "AbortError") throw e;
        }
      } else {
        descarca(blob);
        mesajPdf("PDF-ul a fost descărcat. Deschide WhatsApp, intră în conversația cu profesorul și atașează fișierul descărcat (📎 → Document).");
      }
    } catch (e) {
      mesajPdf("Nu am putut crea PDF-ul: " + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function descarcaPdf() {
    try {
      descarca(await obtinePdf());
    } catch (e) {
      mesajPdf("Nu am putut crea PDF-ul: " + e.message);
    }
  }

  function testNou() {
    if (!confirm("Începi un test nou? Rezultatul de acum rămâne doar în PDF, dacă l-ai salvat.")) return;
    stocare.sterge(CHEIE_STARE);
    pdfCache = null;
    stare = { elev: stare.elev };
    arataNiveluri();
  }

  // ---------- Reluare după reîncărcarea paginii ----------
  async function reia(salvat) {
    stare = salvat;
    afiseazaElev();
    try {
      const banca = await Common.incarcaIntrebari(stare.tema.id, stare.tema.fisier);
      const dupaId = Object.fromEntries(banca.map((q) => [q.id, q]));
      intrebari = stare.intrebari.map((x) => dupaId[x.id]);
      if (intrebari.some((q) => !q)) throw new Error("întrebările s-au schimbat");
    } catch {
      stocare.sterge(CHEIE_STARE);
      stare = { elev: stare.elev };
      return false;
    }
    if (stare.terminat) {
      arataRezultat();
      return true;
    }
    // Pagina a fost reîncărcată în timpul testului: întrebarea curentă se pierde
    stare.raspunsuri[stare.curent] = -2;
    stare.curent++;
    salveaza();
    notifica("Pagina a fost reîncărcată. Întrebarea la care erai a fost marcată ca „Timp expirat”.");
    if (stare.curent >= intrebari.length) {
      await finalizeaza();
    } else {
      construiesteBaraProgres();
      arataIntrebare();
      arata("ecran-test");
    }
    return true;
  }

  // ===============================================================
  //  MODUL ÎNVĂȚARE: fără cronometru, cu explicație după fiecare răspuns
  // ===============================================================
  const inv = {
    lista: [],       // întrebările rundei curente
    ordini: [],      // ordinea variantelor pentru fiecare întrebare
    i: 0,
    corecte: 0,
    raspunse: 0,
    gresite: [],     // întrebările greșite în runda curentă
    runda: 1,
    selectie: null,
  };

  function pornesteInvatare(lista, runda) {
    inv.lista = amesteca(lista);
    inv.ordini = inv.lista.map(() => amesteca([0, 1, 2, 3]));
    inv.i = 0;
    inv.corecte = 0;
    inv.raspunse = 0;
    inv.gresite = [];
    inv.runda = runda;
    arataIntrebareInvatare();
    arata("ecran-invatare");
  }

  function arataIntrebareInvatare() {
    const q = inv.lista[inv.i];
    const total = inv.lista.length;
    inv.selectie = null;

    $("inv-progres").textContent = `Întrebarea ${inv.i + 1} din ${total}`;
    $("inv-scor").textContent = inv.raspunse ? `✓ ${inv.corecte} din ${inv.raspunse}` : "";
    $("inv-bara").style.width = (inv.i / total) * 100 + "%";
    const runda = $("inv-runda");
    runda.hidden = inv.runda === 1;
    runda.textContent = `Runda ${inv.runda}: exersezi doar întrebările greșite`;

    const img = $("inv-imagine");
    img.hidden = !q.imagine;
    img.innerHTML = q.imagine ? `<img src="intrebari/${stare.tema.id}/${esc(q.imagine)}" alt="Ilustrație pentru întrebare">` : "";

    $("inv-text").innerHTML = formateazaText(q.intrebare);
    const box = $("inv-variante");
    box.innerHTML = "";
    inv.ordini[inv.i].forEach((orig, poz) => {
      const b = document.createElement("button");
      b.className = "varianta";
      b.dataset.orig = orig;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.innerHTML = `<span class="litera">${LITERE[poz]}</span><span>${esc(q.variante[orig])}</span>`;
      b.addEventListener("click", () => {
        if (box.classList.contains("blocat")) return;
        inv.selectie = orig;
        box.querySelectorAll(".varianta").forEach((x) => {
          x.classList.toggle("selectat", x === b);
          x.setAttribute("aria-checked", x === b ? "true" : "false");
        });
        $("inv-valideaza").disabled = false;
      });
      box.appendChild(b);
    });
    box.classList.remove("blocat");

    $("inv-feedback").hidden = true;
    $("inv-valideaza").hidden = false;
    $("inv-valideaza").disabled = true;
    $("inv-urmatoarea").hidden = true;
  }

  function valideazaInvatare() {
    if (inv.selectie === null) return;
    const q = inv.lista[inv.i];
    const corect = inv.selectie === q.corect;
    inv.raspunse++;
    if (corect) inv.corecte++;
    else inv.gresite.push(q);

    const box = $("inv-variante");
    box.classList.add("blocat");
    box.querySelectorAll(".varianta").forEach((b) => {
      const orig = Number(b.dataset.orig);
      b.classList.remove("selectat");
      if (orig === q.corect) b.classList.add("corecta");
      else if (orig === inv.selectie) b.classList.add("gresita");
      else b.classList.add("estompat");
    });

    const fb = $("inv-feedback");
    fb.className = "feedback " + (corect ? "corect" : "gresit");
    fb.innerHTML = `
      <p class="feedback-titlu">${corect ? "✓ Corect!" : "✗ Nu este corect"}</p>
      ${corect ? "" : `<p>Răspunsul corect este: <strong>${esc(q.variante[q.corect])}</strong></p>`}
      ${q.explicatie ? `<p class="feedback-expl"><strong>De ce?</strong> ${esc(q.explicatie)}</p>` : ""}`;
    fb.hidden = false;

    $("inv-scor").textContent = `✓ ${inv.corecte} din ${inv.raspunse}`;
    $("inv-valideaza").hidden = true;
    const urm = $("inv-urmatoarea");
    urm.textContent = inv.i + 1 < inv.lista.length ? "Următoarea întrebare →" : "Vezi rezultatul →";
    urm.hidden = false;
    urm.focus({ preventScroll: true });
    fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function urmatoareaInvatare() {
    inv.i++;
    if (inv.i >= inv.lista.length) finalInvatare();
    else {
      arataIntrebareInvatare();
      window.scrollTo(0, 0);
    }
  }

  function finalInvatare() {
    const n = inv.gresite.length;
    $("invf-tema").textContent = `Învățare · ${stare.tema.titlu}` + (inv.runda > 1 ? ` · runda ${inv.runda}` : "");
    $("invf-scor").textContent = inv.corecte;
    $("invf-total").textContent = "din " + inv.raspunse;
    const neterminat = inv.raspunse < inv.lista.length;

    let mesaj;
    if (inv.raspunse === 0) mesaj = "Nicio întrebare rezolvată";
    else if (n === 0) mesaj = inv.runda > 1 ? "Acum le știi pe toate!" : "Perfect!";
    else if (inv.corecte / inv.raspunse >= 0.75) mesaj = "Foarte bine!";
    else mesaj = "Continuă să exersezi!";
    $("invf-mesaj").textContent = mesaj;

    $("invf-detalii").textContent =
      (neterminat ? `Te-ai oprit după ${inv.raspunse} din ${inv.lista.length} întrebări. ` : "") +
      (n === 1 ? "Ai greșit o întrebare. Exers-o din nou până o știi!"
        : n > 1 ? `Ai greșit ${n} întrebări. Exersează-le din nou până le știi!`
        : inv.raspunse ? "Nicio greșeală în această rundă." : "");

    const btnG = $("invf-greseli");
    btnG.hidden = n === 0;
    btnG.textContent = `Exersează din nou ${n === 1 ? "întrebarea greșită" : `cele ${n} întrebări greșite`}`;
    arata("ecran-invatare-final");
  }

  function initInvatare() {
    $("btn-start-invatare").addEventListener("click", () => pornesteInvatare(bancaTema, 1));
    $("inv-valideaza").addEventListener("click", valideazaInvatare);
    $("inv-urmatoarea").addEventListener("click", urmatoareaInvatare);
    $("inv-opreste").addEventListener("click", finalInvatare);
    $("invf-greseli").addEventListener("click", () => pornesteInvatare(inv.gresite, inv.runda + 1));
    $("invf-reia").addEventListener("click", () => pornesteInvatare(bancaTema, 1));
    $("invf-test").addEventListener("click", () => arata("ecran-instructiuni"));
    $("invf-alta").addEventListener("click", arataTeme);
  }

  // ---------- Pornire ----------
  async function init() {
    initDate();
    initInvatare();
    $("btn-start").addEventListener("click", startTest);
    $("btn-valideaza").addEventListener("click", () => selectie !== null && inregistreaza(selectie));
    $("btn-skip").addEventListener("click", () => inregistreaza(-1));
    $("btn-trimite").addEventListener("click", trimite);
    $("btn-descarca").addEventListener("click", descarcaPdf);
    $("btn-test-nou").addEventListener("click", testNou);

    try {
      teme = await Common.incarcaTeme();
    } catch (e) {
      eroare(
        location.protocol === "file:"
          ? "Aplicația trebuie deschisă printr-un server (în VS Code: click dreapta pe index.html → „Open with Live Server”)."
          : "Nu am putut încărca lista de teme. Verifică conexiunea la internet și reîncarcă pagina."
      );
      return;
    }

    const salvat = stocare.citeste(CHEIE_STARE);
    if (salvat && salvat.intrebari && (await reia(salvat))) return;
    arata("ecran-date");
  }

  init();
})();
