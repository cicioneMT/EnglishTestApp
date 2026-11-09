// ===============================================================
//  Generarea raportului PDF (în browser, cu jsPDF)
// ===============================================================

const Raport = (() => {
  const LITERE = ["A", "B", "C", "D"];
  const CULORI = {
    navy: [31, 58, 95],
    text: [33, 37, 41],
    gri: [110, 117, 125],
    griDeschis: [228, 231, 235],
    corect: [27, 122, 70],
    gresit: [192, 57, 43],
    sarita: [176, 112, 0],
    expirat: [176, 112, 0],
  };

  async function fontBase64(cale) {
    const buf = await (await fetch(cale)).arrayBuffer();
    let s = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  // Transformă un desen SVG în imagine PNG pentru PDF
  function imaginePng(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = 900;
        const h = Math.round((img.naturalHeight / img.naturalWidth) * w) || 585;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ data: c.toDataURL("image/png"), raport: h / w });
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function deseneazaQR(doc, text, x, y, marime) {
    const qr = qrcode(0, "L");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const m = marime / n;
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (qr.isDark(r, c)) doc.rect(x + c * m, y + r * m, m + 0.02, m + 0.02, "F");
  }

  async function genereaza(stare, intrebari) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.addFileToVFS("DejaVuSans.ttf", await fontBase64("fonts/DejaVuSans.ttf"));
    doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
    doc.addFileToVFS("DejaVuSans-Bold.ttf", await fontBase64("fonts/DejaVuSans-Bold.ttf"));
    doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");

    const W = 210, M = 16, LAT = W - 2 * M, JOS = 282;
    let y = 0;
    const culoare = (c) => doc.setTextColor(...c);
    const font = (stil, marime) => { doc.setFont("DejaVu", stil); doc.setFontSize(marime); };
    const loc = (h) => { if (y + h > JOS) { doc.addPage(); y = 18; } };

    // ---------- Antet ----------
    doc.setFillColor(...CULORI.navy);
    doc.rect(0, 0, W, 24, "F");
    font("bold", 16); doc.setTextColor(255, 255, 255);
    doc.text("English Test · Raport de evaluare", M, 15);

    // ---------- Datele elevului ----------
    const e = stare.elev;
    y = 36;
    const rand = (eticheta, valoare) => {
      font("normal", 9); culoare(CULORI.gri); doc.text(eticheta, M, y);
      font("bold", 11); culoare(CULORI.text);
      doc.text(doc.splitTextToSize(valoare, 95)[0], M + 24, y);
      y += 7;
    };
    rand("Elev", `${e.nume} ${e.prenume}`);
    rand("Școala", e.scoala);
    rand("Clasa", e.clasa);
    rand("Tema", stare.tema.titlu);
    rand("Nivel", stare.nivel === undefined ? "-" : stare.nivel);
    rand("Data", Common.formatData(stare.final));

    // ---------- QR de verificare ----------
    const qx = W - M - 38, qy = 30;
    deseneazaQR(doc, Common.linkVerificare(stare.cod), qx, qy, 38);
    font("normal", 7.5); culoare(CULORI.gri);
    doc.text("Scanați pentru verificare", qx + 19, qy + 42, { align: "center" });
    font("bold", 8.5); culoare(CULORI.text);
    doc.text(Common.codScurt(stare.cod), qx + 19, qy + 46.5, { align: "center" });

    // ---------- Scor ----------
    const total = intrebari.length;
    const numar = { corect: 0, gresit: 0, sarita: 0, expirat: 0 };
    intrebari.forEach((q, i) => numar[Common.stare(q, stare.raspunsuri[i])]++);
    y = 84;
    doc.setFillColor(243, 245, 248);
    doc.roundedRect(M, y, LAT, 22, 3, 3, "F");
    font("bold", 22); culoare(CULORI.navy);
    doc.text(`${stare.scor} / ${total}`, M + 6, y + 14);
    font("normal", 10); culoare(CULORI.text);
    doc.text(`${Math.round((stare.scor / total) * 100)}% răspunsuri corecte`, M + 48, y + 9);
    font("normal", 9); culoare(CULORI.gri);
    doc.text(
      `Corecte: ${numar.corect}   ·   Greșite: ${numar.gresit}   ·   Sărite: ${numar.sarita}   ·   Timp expirat: ${numar.expirat}`,
      M + 48, y + 16
    );
    y += 32;

    font("bold", 13); culoare(CULORI.navy);
    doc.text("Toate întrebările testului", M, y);
    y += 8;

    // ---------- Întrebările ----------
    for (let i = 0; i < total; i++) {
      const q = intrebari[i];
      const alegere = stare.raspunsuri[i];
      const st = Common.stare(q, alegere);
      const ordine = stare.intrebari[i].ordine;

      font("normal", 10.5);
      const linii = doc.splitTextToSize(q.intrebare.replace(/_{3,}/g, "________"), LAT - 12);
      let img = null;
      if (q.imagine) img = await imaginePng(`intrebari/${stare.tema.id}/${q.imagine}`);
      const hImg = img ? 70 * img.raport + 4 : 0;
      loc(10 + linii.length * 5 + hImg + 4 * 6 + 6);

      // număr + stare
      doc.setFillColor(...CULORI[st]);
      doc.circle(M + 3.5, y - 1.3, 3.5, "F");
      font("bold", 9); doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), M + 3.5, y + 0.1, { align: "center" });
      font("bold", 9); culoare(CULORI[st]);
      doc.text(Common.ETICHETE[st].toUpperCase(), W - M, y, { align: "right" });

      y += 6;
      if (img) {
        doc.addImage(img.data, "PNG", M + 10, y - 2, 70, 70 * img.raport);
        doc.setDrawColor(...CULORI.griDeschis);
        doc.rect(M + 10, y - 2, 70, 70 * img.raport);
        y += hImg;
      }
      font("normal", 10.5); culoare(CULORI.text);
      linii.forEach((l) => { loc(5); doc.text(l, M + 10, y); y += 5; });
      y += 1;

      ordine.forEach((orig, poz) => {
        const eCorect = orig === q.corect;
        const eAles = orig === alegere;
        let sufix = "";
        if (eCorect && eAles) sufix = "  ✓ răspunsul elevului (corect)";
        else if (eCorect) sufix = "  ✓ răspunsul corect";
        else if (eAles) sufix = "  ✗ răspunsul elevului";
        font(eCorect || eAles ? "bold" : "normal", 10);
        culoare(eCorect ? CULORI.corect : eAles ? CULORI.gresit : CULORI.text);
        const t = doc.splitTextToSize(`${LITERE[poz]})  ${q.variante[orig]}${sufix}`, LAT - 16);
        t.forEach((l) => { loc(5); doc.text(l, M + 14, y); y += 5; });
      });

      if (alegere < 0) {
        font("normal", 9); culoare(CULORI[st]);
        loc(5); doc.text(alegere === -1 ? "Elevul a sărit peste această întrebare." : "Elevul nu a ales nicio variantă în timpul dat.", M + 14, y); y += 5;
      }
      if (q.explicatie) {
        font("normal", 9); culoare(CULORI.gri);
        doc.splitTextToSize("Explicație: " + q.explicatie, LAT - 14).forEach((l) => { loc(4.5); doc.text(l, M + 14, y); y += 4.5; });
      }
      y += 3;
      doc.setDrawColor(...CULORI.griDeschis);
      doc.line(M, y, W - M, y);
      y += 7;
    }

    // ---------- Subsol pe fiecare pagină ----------
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      font("normal", 8); culoare(CULORI.gri);
      doc.text(`${e.nume} ${e.prenume} · ${stare.tema.titlu} ${stare.nivel}`, M, 291);
      doc.text(`Cod verificare ${Common.codScurt(stare.cod)} · Pagina ${p} din ${n}`, W - M, 291, { align: "right" });
    }

    return doc.output("blob");
  }

  return { genereaza };
})();
