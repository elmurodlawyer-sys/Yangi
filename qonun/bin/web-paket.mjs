#!/usr/bin/env node
// Veb sahifa uchun qonun paketini yasaydi.
//
// Qidiruv indeksi JO'NATILMAYDI — sahifa uni o'zi yuklanganda yasaydi
// (1790 modda uchun ~0.3 s). Shu yo'l bilan ~1 MB trafik tejaladi.
// Kalitlar qisqartirilgan: r=raqam, s=sarlavha, m=matn, b=bob, bn=bobNomi.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const CHIQISH = join(DATA, "web");

mkdirSync(CHIQISH, { recursive: true });
const fayllar = readdirSync(DATA).filter(f => f.endsWith(".json") && f !== "index.json");
const royxat = [];

for (const f of fayllar) {
  const k = JSON.parse(readFileSync(join(DATA, f), "utf8"));
  const paket = {
    kod: k.kod,
    nom: k.nom,
    yangilandi: k.yangilandi,
    moddalar: k.moddalar.map(a => {
      const o = { r: a.raqam, s: a.sarlavha || "", m: a.matn };
      if (a.bob) o.b = a.bob;
      if (a.bobNomi) o.bn = a.bobNomi;
      return o;
    })
  };
  const yol = join(CHIQISH, `${k.kod}.json`);
  writeFileSync(yol, JSON.stringify(paket));
  const kb = Math.round(Buffer.byteLength(JSON.stringify(paket)) / 1024);
  royxat.push({ kod: k.kod, nom: k.nom, soni: k.moddalar.length, kb });
  console.log(`  ${k.nom.padEnd(34)} ${String(k.moddalar.length).padStart(5)} modda  ${String(kb).padStart(5)} KB → web/${k.kod}.json`);
}

writeFileSync(join(CHIQISH, "royxat.json"), JSON.stringify({
  yasaldi: new Date().toISOString().slice(0, 10),
  kodekslar: royxat
}, null, 1));

const jami = royxat.reduce((s, x) => s + x.kb, 0);
console.log(`\n  Jami: ${royxat.reduce((s, x) => s + x.soni, 0)} modda, ${jami} KB (${(jami / 1024).toFixed(2)} MB)`);
console.log(`  royxat.json yozildi\n`);
