#!/usr/bin/env node
// Qonun bazasi bilan ishlash vositasi. Tashqi kutubxona talab qilmaydi.
//
//   node bin/qonun.mjs parse xom/mehnat.md --kod mehnat --nom "Mehnat kodeksi"
//   node bin/qonun.mjs index
//   node bin/qonun.mjs search "sinov muddati kasallik"
//   node bin/qonun.mjs modda mehnat 5
//   node bin/qonun.mjs stats

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseKodeks } from "../lib/parse.mjs";
import { hujjatlarniAjrat, nomniTop, qismniTop } from "../lib/split.mjs";
import { indexYasa, qidir, parcha } from "../lib/search.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

const C = {
  o: "\x1b[0m", b: "\x1b[1m", xira: "\x1b[2m",
  kok: "\x1b[36m", yashil: "\x1b[32m", sariq: "\x1b[33m", qizil: "\x1b[31m"
};

function bayroq(argv, nom, qiymat = true) {
  const i = argv.indexOf("--" + nom);
  if (i < 0) return null;
  return qiymat ? (argv[i + 1] ?? null) : true;
}

function dataOqi(fayl) {
  return JSON.parse(readFileSync(join(DATA, fayl), "utf8"));
}

function kodekslar() {
  if (!existsSync(DATA)) return [];
  return readdirSync(DATA).filter(f => f.endsWith(".json") && f !== "index.json");
}

// ---------- parse ----------
function buyruqParse(argv) {
  const fayl = argv[0];
  if (!fayl) {
    console.error("Foydalanish: parse <fayl.md> --kod <kalit> --nom \"Nomi\"");
    process.exit(1);
  }
  const kod = bayroq(argv, "kod") || basename(fayl).replace(/\.(md|markdown|txt)$/i, "");
  const nom = bayroq(argv, "nom") || kod;
  const manba = bayroq(argv, "manba") || "";

  const matn = readFileSync(fayl, "utf8");
  const { moddalar, hisobot } = parseKodeks(matn, { kod, nom, manba });

  mkdirSync(DATA, { recursive: true });
  const chiqish = join(DATA, `${kod}.json`);
  writeFileSync(chiqish, JSON.stringify({
    kod, nom, manba,
    yangilandi: new Date().toISOString().slice(0, 10),
    moddalar
  }, null, 1));

  console.log(`\n${C.b}${nom}${C.o} ${C.xira}(${fayl})${C.o}\n`);
  console.log(`  satrlar          ${hisobot.satrSoni}`);
  console.log(`  ${C.b}moddalar         ${hisobot.moddaSoni}${C.o}`);
  console.log(`  boblar           ${hisobot.boblar}`);
  console.log(`  o'rtacha uzunlik ${hisobot.ortachaUzunlik} belgi`);

  const ogoh = [];
  if (hisobot.moddaSoni === 0) ogoh.push(`${C.qizil}Birorta modda topilmadi — sarlavha shakli boshqacha.${C.o}`);
  if (hisobot.uzilishSoni) ogoh.push(`${C.sariq}Raqamlarda ${hisobot.uzilishSoni} ta uzilish: ${hisobot.uzilishlar.slice(0, 15).join(", ")}${hisobot.uzilishSoni > 15 ? " …" : ""}${C.o}`);
  if (hisobot.takror.length) ogoh.push(`${C.sariq}Takrorlangan raqam: ${hisobot.takror.join(", ")}${C.o}`);
  if (hisobot.bosh.length) ogoh.push(`${C.sariq}Matni juda qisqa (${hisobot.bosh.length} ta): ${hisobot.bosh.slice(0, 15).join(", ")}${C.o}`);
  if (hisobot.sarlavhasizlar.length) ogoh.push(`${C.xira}Sarlavhasiz (${hisobot.sarlavhasizlar.length} ta)${C.o}`);

  if (ogoh.length) {
    console.log(`\n  ${C.b}Tekshirish kerak:${C.o}`);
    for (const x of ogoh) console.log(`  · ${x}`);
  } else {
    console.log(`\n  ${C.yashil}Muammo topilmadi.${C.o}`);
  }
  console.log(`\n  saqlandi → data/${kod}.json\n`);
}

// ---------- kirit ----------
// Kodeks nomidan baza kalitini aniqlaydi. Bir kodeksning bir necha qismi
// bitta kalitga birlashadi (Fuqarolik kodeksi 1- va 2-qism).
const KALITLAR = [
  [/mehnat/i, "mehnat", "Mehnat kodeksi"],
  [/fuqarolik/i, "fuqaro", "Fuqarolik kodeksi"],
  [/ma[\u02bb\u2019']?muriy/i, "mamuriy", "Ma'muriy javobgarlik to'g'risidagi kodeks"],
  [/oila/i, "oila", "Oila kodeksi"],
  [/jinoyat-protsessual/i, "jpk", "Jinoyat-protsessual kodeksi"],
  [/jinoyat/i, "jinoyat", "Jinoyat kodeksi"],
  [/soliq/i, "soliq", "Soliq kodeksi"],
  [/yer/i, "yer", "Yer kodeksi"]
];

function kalitAniqla(nom) {
  for (const [re, kalit, toliq] of KALITLAR) if (re.test(nom)) return { kalit, toliq };
  const kalit = nom.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "nomalum";
  return { kalit, toliq: nom };
}

function buyruqKirit(argv) {
  const fayl = argv.find(a => !a.startsWith("--"));
  if (!fayl) { console.error("Foydalanish: kirit <fayl.md>"); process.exit(1); }

  const xom = readFileSync(fayl, "utf8");
  const hujjatlar = hujjatlarniAjrat(xom);
  console.log(`\n${C.b}${hujjatlar.length} ta hujjat topildi${C.o} ${C.xira}(${fayl})${C.o}\n`);

  const guruh = new Map();   // kalit -> {nom, qismlar:[]}
  for (const h of hujjatlar) {
    const xomNom = nomniTop(h.matn) || `Hujjat ${h.raqam}`;
    const { kalit, toliq } = kalitAniqla(xomNom);
    const qism = qismniTop(h.matn);
    const { moddalar, hisobot } = parseKodeks(h.matn, { kod: kalit, nom: toliq, manba: h.manba });

    console.log(`  ${C.b}${h.raqam}.${C.o} ${toliq}${qism ? ` ${C.xira}(${qism} qism)${C.o}` : ""} ${C.xira}→ ${kalit}${C.o}`);
    console.log(`     ${moddalar.length} modda · ${hisobot.boblar} bob · o'rtacha ${hisobot.ortachaUzunlik} belgi`);
    if (hisobot.tuzatilgan.length) console.log(`     ${C.yashil}yuqori indeks tiklandi (${hisobot.tuzatilgan.length}): ${hisobot.tuzatilgan.join(", ")}${C.o}`);
    if (hisobot.takror.length) console.log(`     ${C.sariq}takror raqam: ${hisobot.takror.slice(0, 8).join(", ")}${C.o}`);
    if (!moddalar.length) console.log(`     ${C.qizil}modda topilmadi${C.o}`);

    if (!guruh.has(kalit)) guruh.set(kalit, { nom: toliq, moddalar: [], manbalar: [] });
    const g = guruh.get(kalit);
    for (const a of moddalar) { a.qism = qism; g.moddalar.push(a); }
    g.manbalar.push(h.manba);
  }

  mkdirSync(DATA, { recursive: true });
  console.log(`\n  ${C.b}Birlashtirildi:${C.o}`);
  for (const [kalit, g] of guruh) {
    // Bir kodeksning qismlarida raqam takrorlansa, qism belgisi bilan ajratamiz.
    const korilgan = new Set();
    for (const a of g.moddalar) {
      let id = `${kalit}:${a.raqam}`;
      if (korilgan.has(id)) id = `${kalit}:${a.raqam}/${a.qism || "q"}`;
      korilgan.add(id);
      a.id = id;
    }
    g.moddalar.sort((x, y) => {
      const nx = parseInt(String(x.raqam), 10), ny = parseInt(String(y.raqam), 10);
      return (nx - ny) || String(x.raqam).localeCompare(String(y.raqam));
    });
    writeFileSync(join(DATA, `${kalit}.json`), JSON.stringify({
      kod: kalit, nom: g.nom, manba: g.manbalar.filter(Boolean).join(" · "),
      yangilandi: new Date().toISOString().slice(0, 10),
      moddalar: g.moddalar
    }, null, 1));
    const sharhli = g.moddalar.filter(a => a.sharh).length;
    console.log(`  · ${C.b}${g.nom}${C.o} — ${g.moddalar.length} modda (${sharhli} tasida sharh) → data/${kalit}.json`);
  }
  console.log(`\n  Keyingi qadam: ${C.kok}node bin/qonun.mjs index${C.o}\n`);
}

// ---------- index ----------
function buyruqIndex() {
  const fayllar = kodekslar();
  if (!fayllar.length) {
    console.error("data/ bo'sh. Avval: parse <fayl.md>");
    process.exit(1);
  }
  const hammasi = [];
  for (const f of fayllar) {
    const k = dataOqi(f);
    hammasi.push(...k.moddalar);
    console.log(`  ${k.nom}: ${k.moddalar.length} modda`);
  }
  const index = indexYasa(hammasi);
  writeFileSync(join(DATA, "index.json"), JSON.stringify(index));
  const mb = (Buffer.byteLength(JSON.stringify(index)) / 1048576).toFixed(2);
  console.log(`\n  ${C.b}${index.jami} modda, ${Object.keys(index.lugat).length} o'zak${C.o}`);
  console.log(`  indeks → data/index.json (${mb} MB)\n`);
}

// ---------- search ----------
function buyruqSearch(argv) {
  const kodFiltr = bayroq(argv, "kod");
  const soni = parseInt(bayroq(argv, "soni") || "6", 10);
  const sorov = argv.filter(a => !a.startsWith("--") && a !== kodFiltr && a !== String(soni)).join(" ");
  if (!sorov) { console.error("Foydalanish: search \"so'rov matni\""); process.exit(1); }

  const index = dataOqi("index.json");
  const matnlar = new Map();
  for (const f of kodekslar()) for (const a of dataOqi(f).moddalar) matnlar.set(a.id, a.matn);

  const natija = qidir(index, sorov, { soni, kodlar: kodFiltr ? [kodFiltr] : null });
  console.log(`\n${C.b}«${sorov}»${C.o} ${C.xira}— ${natija.length} natija${C.o}\n`);
  if (!natija.length) { console.log("  Hech narsa topilmadi.\n"); return; }

  for (const r of natija) {
    console.log(`${C.kok}${C.b}${r.raqam}-modda${C.o} ${C.b}${r.sarlavha || ""}${C.o}`);
    console.log(`  ${C.xira}${r.kodNomi}${r.bob ? ` · ${r.bob}-bob` : ""} · ball ${r.ball}${C.o}`);
    console.log(`  ${parcha(matnlar.get(r.id) || "", sorov).replace(/\n/g, " ")}`);
    console.log();
  }
}

// ---------- modda ----------
function buyruqModda(argv) {
  const [kod, raqam] = argv;
  if (!kod || !raqam) { console.error("Foydalanish: modda <kod> <raqam>"); process.exit(1); }
  const k = dataOqi(`${kod}.json`);
  const a = k.moddalar.find(x => String(x.raqam) === String(raqam));
  if (!a) { console.error(`${kod} ichida ${raqam}-modda yo'q.`); process.exit(1); }
  console.log(`\n${C.b}${a.raqam}-modda. ${a.sarlavha || ""}${C.o}`);
  console.log(`${C.xira}${k.nom}${a.bob ? ` · ${a.bob}-bob ${a.bobNomi}` : ""}${C.o}\n`);
  console.log(a.matn + "\n");
}

// ---------- stats ----------
function buyruqStats() {
  const fayllar = kodekslar();
  if (!fayllar.length) { console.log("data/ bo'sh.\n"); return; }
  console.log();
  let jami = 0;
  for (const f of fayllar) {
    const k = dataOqi(f);
    jami += k.moddalar.length;
    const belgi = k.moddalar.reduce((s, a) => s + a.matn.length, 0);
    console.log(`  ${C.b}${k.nom}${C.o} ${C.xira}(${k.kod})${C.o}`);
    console.log(`    ${k.moddalar.length} modda · ${(belgi / 1000).toFixed(0)}K belgi · yangilandi ${k.yangilandi}`);
  }
  console.log(`\n  ${C.b}Jami: ${jami} modda${C.o}`);
  if (existsSync(join(DATA, "index.json"))) {
    const i = dataOqi("index.json");
    console.log(`  Indeks: ${i.jami} modda, ${Object.keys(i.lugat).length} o'zak`);
  } else {
    console.log(`  ${C.sariq}Indeks yo'q — "index" buyrug'ini yuriting.${C.o}`);
  }
  console.log();
}

const [, , buyruq, ...argv] = process.argv;
const buyruqlar = {
  kirit: buyruqKirit, parse: buyruqParse, index: buyruqIndex,
  search: buyruqSearch, modda: buyruqModda, stats: buyruqStats
};
if (!buyruq || !buyruqlar[buyruq]) {
  console.log(`
${C.b}Qonun bazasi vositasi${C.o}

  ${C.kok}kirit${C.o}  <fayl.md>                               birlashtirilgan faylni avtomatik ajratadi
  ${C.kok}parse${C.o}  <fayl.md> --kod <kalit> --nom "Nomi"   bitta kodeksni ajratadi
  ${C.kok}index${C.o}                                         qidiruv indeksini yasaydi
  ${C.kok}search${C.o} "so'rov"  [--kod mehnat] [--soni 6]     moddalarni qidiradi
  ${C.kok}modda${C.o}  <kod> <raqam>                           bitta moddani to'liq ko'rsatadi
  ${C.kok}stats${C.o}                                          baza holati
`);
  process.exit(buyruq ? 1 : 0);
}
buyruqlar[buyruq](argv);
