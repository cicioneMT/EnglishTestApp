# English Test

Aplicație web pentru teste de engleză: 20 de întrebări, 30 de secunde pe întrebare, raport PDF trimis pe WhatsApp și verificare anti-fraudă cu cod QR.

## Cum o pornesc pe calculator (VS Code)

1. Instalați extensia **Live Server** (Extensions → căutați „Live Server” de Ritwick Dey → Install).
2. Click dreapta pe `index.html` → **Open with Live Server**.
3. Aplicația se deschide în browser. Pagina de verificare pentru profesor este `verifica.html`.

> Aplicația nu merge prin dublu-click pe `index.html`. Are nevoie de Live Server sau de GitHub Pages.

## Structura

```
index.html            aplicația pentru elevi
verifica.html         verificarea rapoartelor (pentru profesor)
js/config.js          SETĂRI: nr. întrebări, secunde, cheia de verificare
intrebari/
  index.json          lista temelor (generată automat)
  <tema>/
    tema.json         titlul și descrierea temei
    B1.json … C2.json întrebările pe niveluri
    toate.json        sau: aceleași întrebări pentru toate nivelurile
    imagini/          desene (opțional)
```

## Cum adaug o temă nouă

1. Creați un folder nou în `intrebari/`, de exemplu `intrebari/collocations/`.
2. Puneți în el un fișier `tema.json`:
   ```json
   { "titlu": "Collocations", "descriere": "Words that go together", "ordine": 5 }
   ```
3. Adăugați fișierele cu întrebări: `B1.json`, `B2.json`, `C1.json`, `C2.json` (doar cele de care aveți nevoie) sau `toate.json`.
4. Publicați pe GitHub. Lista temelor se actualizează automat.

Pe calculator, dacă aveți Node.js instalat, actualizați lista cu: `node tools/genereaza-index.js`

## Formatul unei întrebări

```json
{
  "id": "coll-b2-01",
  "intrebare": "She ______ a mistake in her homework.",
  "variante": ["made", "did", "took", "had"],
  "corect": 0,
  "explicatie": "We say 'make a mistake', not 'do a mistake'."
}
```

- `corect` este poziția variantei corecte: 0 = prima, 1 = a doua etc. Aplicația amestecă oricum variantele.
- `______` (minim 3 liniuțe) apare ca spațiu de completat.
- Pentru întrebări cu desen, adăugați `"imagine": "imagini/numele-desenului.svg"`.
- **Nu schimbați `id`-ul unei întrebări existente.** După el sunt verificate rapoartele vechi.

## Înainte de a da linkul elevilor

Schimbați `cheieVerificare` din `js/config.js` cu un text doar al dumneavoastră. Ulterior nu o mai schimbați.
