// Moddalar ustida BM25 qidiruvi.
//
// Nega embedding emas: o'zbek tili uchun embedding modellari kuchsiz, huquqiy
// til esa aniq — "sinov muddati" matnda aynan shunday turadi. BM25 bepul,
// tez, natijasi tushunarli (qaysi so'z topildi — ko'rinadi) va server
// talab qilmaydi. Embedding keyin, kerak bo'lsa, ustiga qo'shiladi.

import { tokenize, normalize } from "./normalize.mjs";

const K1 = 1.2;
const B = 0.75;
const SARLAVHA_OGIRLIGI = 3;   // sarlavhada topilgan so'z matndagidan muhimroq
const IBORA_BONUSI = 8;        // so'rov iborasi matnda aynan uchrasa
const SARLAVHA_IBORA_BONUSI = 14;

/** Moddalar massividan qidiruv indeksi yasaydi. */
export function indexYasa(moddalar) {
  const hujjatlar = [];
  const lugat = new Map();   // o'zak -> [[docIdx, tfMatn, tfSarlavha], ...]
  let jamiUzunlik = 0;

  moddalar.forEach((a, idx) => {
    const matnTok = tokenize(a.matn);
    const sarlavhaTok = tokenize(a.sarlavha || "");

    const tf = new Map();
    for (const t of matnTok) {
      const e = tf.get(t) || [0, 0];
      e[0]++; tf.set(t, e);
    }
    for (const t of sarlavhaTok) {
      const e = tf.get(t) || [0, 0];
      e[1]++; tf.set(t, e);
    }

    const uzunlik = matnTok.length + sarlavhaTok.length * SARLAVHA_OGIRLIGI;
    jamiUzunlik += uzunlik;

    hujjatlar.push({
      id: a.id, kod: a.kod, kodNomi: a.kodNomi, raqam: a.raqam,
      sarlavha: a.sarlavha, bob: a.bob, bobNomi: a.bobNomi,
      uzunlik,
      normSarlavha: normalize(a.sarlavha || ""),
      normMatn: normalize(a.matn)
    });

    for (const [t, [fm, fs]] of tf) {
      if (!lugat.has(t)) lugat.set(t, []);
      lugat.get(t).push([idx, fm, fs]);
    }
  });

  return {
    versiya: 2,
    hujjatlar,
    lugat: Object.fromEntries(lugat),
    jami: hujjatlar.length,
    ortachaUzunlik: hujjatlar.length ? jamiUzunlik / hujjatlar.length : 1
  };
}

// "137-modda", "modda 5" — to'g'ridan-to'g'ri raqam bo'yicha so'rov.
const RAQAM_SOROV = [
  /(\d+(?:[-–^.]\d+)?)\s*[-–]?\s*modda/i,
  /modda\s*(\d+(?:[-–^.]\d+)?)/i
];

function raqamSoroviniAjrat(sorov) {
  const n = normalize(sorov);
  for (const re of RAQAM_SOROV) {
    const m = n.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * @param {object} index  indexYasa natijasi
 * @param {string} sorov  foydalanuvchi so'rovi
 * @param {{soni?:number, kodlar?:string[]}} opt
 */
export function qidir(index, sorov, opt = {}) {
  const soni = opt.soni ?? 6;
  const kodlar = opt.kodlar && opt.kodlar.length ? new Set(opt.kodlar) : null;
  const { hujjatlar, lugat, jami, ortachaUzunlik } = index;

  const normSorov = normalize(sorov);
  const ozaklar = tokenize(sorov);
  const ball = new Map();
  const topilgan = new Map();   // docIdx -> topilgan o'zaklar

  const qoshish = (idx, qiymat, ozak) => {
    ball.set(idx, (ball.get(idx) || 0) + qiymat);
    if (ozak) {
      if (!topilgan.has(idx)) topilgan.set(idx, new Set());
      topilgan.get(idx).add(ozak);
    }
  };

  for (const ozak of new Set(ozaklar)) {
    const postinglar = lugat[ozak];
    if (!postinglar || !postinglar.length) continue;
    const df = postinglar.length;
    const idf = Math.log(1 + (jami - df + 0.5) / (df + 0.5));

    for (const [idx, fm, fs] of postinglar) {
      const d = hujjatlar[idx];
      if (kodlar && !kodlar.has(d.kod)) continue;
      const f = fm + fs * SARLAVHA_OGIRLIGI;
      const norm = f + K1 * (1 - B + B * (d.uzunlik / ortachaUzunlik));
      qoshish(idx, idf * (f * (K1 + 1)) / norm, ozak);
    }
  }

  // Ibora bonusi: so'rov aynan matnda turganini kuchli signal deb olamiz.
  if (normSorov.length >= 6) {
    for (let idx = 0; idx < hujjatlar.length; idx++) {
      const d = hujjatlar[idx];
      if (kodlar && !kodlar.has(d.kod)) continue;
      if (d.normSarlavha.includes(normSorov)) qoshish(idx, SARLAVHA_IBORA_BONUSI, null);
      else if (d.normMatn.includes(normSorov)) qoshish(idx, IBORA_BONUSI, null);
    }
  }

  // Raqam bo'yicha so'rov bo'lsa, o'sha modda birinchi o'rinda turishi kerak.
  const raqam = raqamSoroviniAjrat(sorov);
  if (raqam) {
    for (let idx = 0; idx < hujjatlar.length; idx++) {
      const d = hujjatlar[idx];
      if (kodlar && !kodlar.has(d.kod)) continue;
      if (String(d.raqam) === String(raqam)) qoshish(idx, 1000, null);
    }
  }

  return [...ball.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, soni)
    .map(([idx, b]) => ({
      ...hujjatlar[idx],
      ball: Math.round(b * 1000) / 1000,
      topilganOzaklar: [...(topilgan.get(idx) || [])]
    }));
}

/** Topilgan modda uchun so'rovga eng yaqin parchani qaytaradi. */
export function parcha(matn, sorov, uzunlik = 320) {
  const norm = normalize(matn);
  const ozaklar = tokenize(sorov);
  let joy = -1;

  const ns = normalize(sorov);
  if (ns.length >= 6) joy = norm.indexOf(ns);
  if (joy < 0) {
    for (const o of ozaklar) {
      const p = norm.indexOf(o);
      if (p >= 0) { joy = p; break; }
    }
  }
  if (joy < 0) return matn.slice(0, uzunlik).trim() + (matn.length > uzunlik ? "…" : "");

  // Normalizatsiya uzunlikni saqlamaydi, shuning uchun nisbat bilan joylashamiz.
  const nisbat = norm.length ? joy / norm.length : 0;
  const taxmin = Math.max(0, Math.floor(matn.length * nisbat) - 80);
  const bosh = matn.lastIndexOf(" ", taxmin) + 1 || taxmin;
  const oxir = Math.min(matn.length, bosh + uzunlik);
  return (bosh > 0 ? "…" : "") + matn.slice(bosh, oxir).trim() + (oxir < matn.length ? "…" : "");
}
