// ===============================================================
//  Generează automat lista temelor: intrebari/index.json
//  Rulare: node tools/genereaza-index.js
//  (pe GitHub rulează singur, la fiecare publicare)
// ===============================================================
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "intrebari");
const NIVELURI = ["B1", "B2", "C1", "C2", "toate"];
const teme = [];
let erori = 0;

for (const folder of fs.readdirSync(DIR, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const cale = path.join(DIR, folder.name);
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(cale, "tema.json"), "utf8"));
  } catch {
    console.warn(`! ${folder.name}: lipsește tema.json — folosesc numele folderului`);
  }

  const niveluri = NIVELURI.filter((n) => fs.existsSync(path.join(cale, n + ".json")));
  if (!niveluri.length) {
    console.warn(`! ${folder.name}: niciun fișier B1/B2/C1/C2/toate.json — tema e ignorată`);
    continue;
  }

  // Verificare rapidă a întrebărilor
  for (const n of niveluri) {
    const fis = path.join(cale, n + ".json");
    try {
      const date = JSON.parse(fs.readFileSync(fis, "utf8"));
      const lista = Array.isArray(date) ? date : date.intrebari;
      lista.forEach((q, i) => {
        const problema =
          !q.intrebare ? "lipsește textul întrebării" :
          !Array.isArray(q.variante) || q.variante.length !== 4 ? "trebuie exact 4 variante" :
          !(q.corect >= 0 && q.corect <= 3) ? "„corect” trebuie să fie 0, 1, 2 sau 3" : null;
        if (problema) { erori++; console.error(`✗ ${folder.name}/${n}.json, întrebarea ${i + 1}: ${problema}`); }
      });
      console.log(`✓ ${folder.name}/${n}.json — ${lista.length} întrebări`);
    } catch (e) {
      erori++;
      console.error(`✗ ${folder.name}/${n}.json nu este un JSON valid: ${e.message}`);
    }
  }

  teme.push({
    id: folder.name,
    titlu: meta.titlu || folder.name,
    descriere: meta.descriere || "",
    ordine: meta.ordine ?? 99,
    niveluri,
  });
}

teme.sort((a, b) => a.ordine - b.ordine || a.titlu.localeCompare(b.titlu));
fs.writeFileSync(path.join(DIR, "index.json"), JSON.stringify({ teme }, null, 2) + "\n");
console.log(`\nindex.json actualizat: ${teme.length} teme.`);
if (erori) { console.error(`${erori} probleme găsite.`); process.exit(1); }
