// ===============================================================
//  Funcții comune: încărcarea temelor, semnătura de verificare
// ===============================================================

const Common = (() => {
  async function incarcaJSON(cale) {
    const r = await fetch(cale, { cache: "no-cache" });
    if (!r.ok) throw new Error("Nu am putut încărca " + cale);
    return r.json();
  }

  // Lista temelor (generată automat în intrebari/index.json)
  async function incarcaTeme() {
    const idx = await incarcaJSON("intrebari/index.json");
    return idx.teme || [];
  }

  // Ce fișier de întrebări folosim pentru o temă și un nivel
  function fisierPentru(tema, nivel) {
    if (tema.niveluri.includes(nivel)) return nivel;
    if (tema.niveluri.includes("toate")) return "toate";
    return null;
  }

  async function incarcaIntrebari(temaId, fisier) {
    const date = await incarcaJSON(`intrebari/${temaId}/${fisier}.json`);
    const lista = Array.isArray(date) ? date : date.intrebari;
    return lista.map((q, i) => ({ ...q, id: q.id || "q" + (i + 1) }));
  }

  // ---------- codificare base64url pentru texte UTF-8 ----------
  function b64urlDinBytes(bytes) {
    let s = "";
    bytes.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function bytesDinB64url(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const s = atob(str);
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  }
  const codifica = (obj) => b64urlDinBytes(new TextEncoder().encode(JSON.stringify(obj)));
  const decodifica = (str) => JSON.parse(new TextDecoder().decode(bytesDinB64url(str)));

  // ---------- semnătura (HMAC-SHA256) ----------
  async function semneaza(text) {
    const cheie = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(CONFIG.cheieVerificare),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", cheie, new TextEncoder().encode(text));
    return b64urlDinBytes(new Uint8Array(sig).slice(0, 12));
  }

  // Creează codul complet pentru un rezultat: "<date>.<semnătură>"
  async function creeazaCod(rezultat) {
    const date = codifica(rezultat);
    return date + "." + (await semneaza(date));
  }

  // Verifică un cod; întoarce { valid, rezultat }
  async function verificaCod(cod) {
    const [date, sig] = (cod || "").trim().split(".");
    if (!date || !sig) return { valid: false };
    let rezultat = null;
    try { rezultat = decodifica(date); } catch { return { valid: false }; }
    const asteptat = await semneaza(date);
    return { valid: asteptat === sig, rezultat };
  }

  // Cod scurt, ușor de citit, afișat în PDF și pe pagina de verificare
  const codScurt = (cod) => {
    const sig = cod.split(".")[1] || "";
    return sig.slice(0, 12).toUpperCase().replace(/(.{4})(?=.)/g, "$1-");
  };

  function linkVerificare(cod) {
    return new URL("verifica.html", location.href).href + "#" + cod;
  }

  function formatData(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Starea unui răspuns: alegere = index varianta originală, -1 sărită, -2 timp expirat
  function stare(intrebare, alegere) {
    if (alegere === -1) return "sarita";
    if (alegere === -2) return "expirat";
    return alegere === intrebare.corect ? "corect" : "gresit";
  }
  const ETICHETE = { corect: "Corect", gresit: "Greșit", sarita: "Sărită (punctată ca greșită)", expirat: "Timp expirat" };

  return {
    incarcaJSON, incarcaTeme, fisierPentru, incarcaIntrebari,
    creeazaCod, verificaCod, codScurt, linkVerificare,
    formatData, escapeHtml, stare, ETICHETE,
  };
})();
