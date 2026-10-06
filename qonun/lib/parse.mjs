// Markdown qonun matnini moddalarga ajratadi.
//
// O'zbek kodekslari turli ko'rinishda keladi, shuning uchun parser bir nechta
// sarlavha shaklini taniydi va oxirida hisobot beradi: nechta modda topildi,
// raqamlarda uzilish bormi, g'alati uzun/qisqa moddalar bormi. Hisobot
// parserning ishlaganini tekshirish uchun — sonlar kutilganidan farq qilsa,
// shablonni moslashtirish kerak.

import { normalize, yengilNormalize } from "./normalize.mjs";

// Markdown bezaklarini olib tashlaydi, sarlavhani tekshirish osonlashadi.
function tozala(line) {
  return line
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^\s*[>*+-]\s+/, "")
    .trim();
}

// "5-modda.", "5-MODDA", "Modda 5.", "5 modda." — hammasi bir xil tushuniladi.
// 5^1-modda / 5-1-modda kabi qo'shilgan moddalar ham qo'llanadi.
const MODDA_SHAKLLARI = [
  /^(\d+(?:[-–^.]\d+)?)\s*[-–]\s*modda\s*[.．:]?\s*(.*)$/i,
  /^modda\s*(\d+(?:[-–^.]\d+)?)\s*[.．:]?\s*(.*)$/i,
  /^(\d+(?:[-–^.]\d+)?)\s+modda\s*[.．:]?\s*(.*)$/i
];

const BOB_SHAKLLARI = [
  /^(\d+(?:[-–]\d+)?)\s*[-–]\s*bob\s*[.．:]?\s*(.*)$/i,
  /^bob\s*(\d+)\s*[.．:]?\s*(.*)$/i,
  /^([IVXLC]+)\s*[-–.]?\s*bob\s*[.．:]?\s*(.*)$/i
];

// "LexUZ sharhi" — qonun matni emas, sharh. Alohida maydonga ajratiladi,
// aks holda AI sharhni norma deb iqtibos qiladi.
const SHARH_SATRI = /^lexuz sharhi\s*$/i;
const SHARH_BELGISI = /lex\.uz|^\**\s*qarang\s*:/i;

// "1-§." — paragraf, Fuqarolik kodeksida boblar ichida uchraydi.
const PARAGRAF_SHAKLI = /^(\d+)\s*-\s*§\s*[.．:]?\s*(.*)$/;

const BOLIM_SHAKLLARI = [
  /^(\d+(?:[-–]\d+)?)\s*[-–]\s*(?:kichik\s+)?bo'?lim\s*[.．:]?\s*(.*)$/i,
  /^([IVXLC]+)\s*[-–.]?\s*bo'?lim\s*[.．:]?\s*(.*)$/i,
  /^(birinchi|ikkinchi|uchinchi|to'?rtinchi|beshinchi|oltinchi|yettinchi|sakkizinchi)\s+bo'?lim\s*[.．:]?\s*(.*)$/i
];

function moslash(line, shakllar) {
  const xom = tozala(line);
  const t = normalize(xom);
  if (!t || t.length > 200) return null;
  const asl = yengilNormalize(xom);   // registri saqlangan nusxa
  for (const re of shakllar) {
    const m = t.match(re);
    if (!m) continue;
    // Sarlavhani asl registrda olamiz; moslashmasa normallashgani ishlatiladi.
    const ma = asl.match(re);
    return {
      raqam: String(m[1]).trim(),
      qoldiq: ((ma && ma[2]) || m[2] || "").trim()
    };
  }
  return null;
}

// .doc → markdown o'girishda yuqori indeks oddiy raqamga yopishib qoladi:
// "26\u00b9-modda" → "261-modda". Natijada modda ketma-ketlikdan keskin
// chiqadi va raqami noto'g'ri bo'lib qoladi — iqtibos uchun jiddiy xato.
// Qo'shni moddalar bilan solishtirib tiklaymiz.
function yuqoriIndeksniTikla(moddalar) {
  const tuzatilgan = [];
  let asosiy = null;
  for (const a of moddalar) {
    const raqamStr = String(a.raqam);
    const son = parseInt(raqamStr, 10);
    if (!Number.isFinite(son)) { tuzatilgan.push({ ...a }); continue; }

    if (asosiy !== null && son > asosiy + 20) {
      const asosiyStr = String(asosiy);
      if (raqamStr.startsWith(asosiyStr)) {
        const qoldiq = raqamStr.slice(asosiyStr.length);
        if (/^\d{1,2}$/.test(qoldiq)) {
          tuzatilgan.push({ ...a, raqam: `${asosiyStr}^${qoldiq}`, xomRaqam: raqamStr, tuzatildi: true });
          continue;   // asosiy o'zgarmaydi: 26\u00b9 dan keyin 26\u00b2 ham kelishi mumkin
        }
      }
    }
    asosiy = son;
    tuzatilgan.push({ ...a });
  }
  return tuzatilgan;
}

/**
 * @param {string} matn  markdown fayl mazmuni
 * @param {{kod:string, nom:string, manba?:string}} meta
 * @returns {{meta:object, moddalar:Array, hisobot:object}}
 */
export function parseKodeks(matn, meta) {
  const satrlar = String(matn).replace(/\r\n?/g, "\n").split("\n");
  const moddalar = [];
  let joriy = null;
  let bob = "", bobNomi = "", bolim = "", bolimNomi = "", paragraf = "", paragrafNomi = "";
  let sarlavhaKutilmoqda = null;   // sarlavhasi keyingi satrda keladigan element
  let sharhRejimi = false;

  const yop = () => {
    if (!joriy) return;
    joriy.matn = joriy.buf.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    joriy.sharh = joriy.sharhBuf.join("\n\n").trim();
    delete joriy.buf;
    delete joriy.sharhBuf;
    moddalar.push(joriy);
    joriy = null;
    sharhRejimi = false;
  };

  for (let i = 0; i < satrlar.length; i++) {
    const satr = satrlar[i];
    const toza = tozala(satr);

    // Modda sarlavhasi eng muhim — avval shuni tekshiramiz.
    const m = moslash(satr, MODDA_SHAKLLARI);
    if (m) {
      yop();
      joriy = {
        raqam: m.raqam,
        sarlavha: m.qoldiq,
        bob, bobNomi, bolim, bolimNomi, paragraf, paragrafNomi,
        satr: i + 1,
        buf: [], sharhBuf: []
      };
      // Sarlavha shu satrda bo'lmasa, keyingi bo'sh bo'lmagan satrdan olinadi.
      sarlavhaKutilmoqda = m.qoldiq ? null : joriy;
      continue;
    }

    // Sharh bloki: sarlavha satridan keyin sharhga o'xshash xatboshilar.
    if (SHARH_SATRI.test(toza)) { sharhRejimi = true; continue; }
    if (sharhRejimi) {
      if (!toza) continue;
      if (SHARH_BELGISI.test(toza)) {
        if (joriy) joriy.sharhBuf.push(toza);
        continue;
      }
      sharhRejimi = false;   // sharh tugadi, bu oddiy matn
    }

    const pg = toza.match(PARAGRAF_SHAKLI);
    if (pg && toza.length < 200) {
      paragraf = pg[1]; paragrafNomi = pg[2].trim(); sarlavhaKutilmoqda = null;
      if (!paragrafNomi) sarlavhaKutilmoqda = { set: v => { paragrafNomi = v; } };
      continue;
    }

    const bl = moslash(satr, BOLIM_SHAKLLARI);
    if (bl) {
      yop(); bolim = bl.raqam; bolimNomi = bl.qoldiq; paragraf = ""; paragrafNomi = "";
      sarlavhaKutilmoqda = bl.qoldiq ? null : { set: v => { bolimNomi = v; } };
      continue;
    }

    const bb = moslash(satr, BOB_SHAKLLARI);
    if (bb) {
      yop(); bob = bb.raqam; bobNomi = bb.qoldiq; paragraf = ""; paragrafNomi = "";
      sarlavhaKutilmoqda = bb.qoldiq ? null : { set: v => { bobNomi = v; } };
      continue;
    }

    if (sarlavhaKutilmoqda && toza) {
      if (typeof sarlavhaKutilmoqda.set === "function") sarlavhaKutilmoqda.set(toza);
      else sarlavhaKutilmoqda.sarlavha = toza;
      sarlavhaKutilmoqda = null;
      continue;
    }

    if (joriy) joriy.buf.push(satr.replace(/\s+$/, ""));
  }
  yop();

  const tiklangan = yuqoriIndeksniTikla(moddalar);
  for (const a of tiklangan) {
    a.id = `${meta.kod}:${a.raqam}`;
    a.kod = meta.kod;
    a.kodNomi = meta.nom;
  }

  return { meta, moddalar: tiklangan, hisobot: hisobotYasa(tiklangan, satrlar.length) };
}

function hisobotYasa(moddalar, satrSoni) {
  const sonlar = moddalar
    .map(a => parseInt(String(a.raqam).match(/^\d+/)?.[0] ?? "", 10))
    .filter(n => Number.isFinite(n));

  const uzilishlar = [];
  const korilgan = new Set(sonlar);
  if (sonlar.length) {
    const max = Math.max(...sonlar);
    for (let n = 1; n <= max; n++) if (!korilgan.has(n)) uzilishlar.push(n);
  }

  const takror = [];
  const hisob = new Map();
  for (const a of moddalar) hisob.set(a.raqam, (hisob.get(a.raqam) || 0) + 1);
  for (const [r, c] of hisob) if (c > 1) takror.push(r);

  const uzunliklar = moddalar.map(a => a.matn.length);
  const jami = uzunliklar.reduce((s, x) => s + x, 0);

  return {
    satrSoni,
    moddaSoni: moddalar.length,
    sarlavhasizlar: moddalar.filter(a => !a.sarlavha).map(a => a.raqam),
    bosh: moddalar.filter(a => a.matn.length < 40).map(a => a.raqam),
    juda_uzun: moddalar.filter(a => a.matn.length > 12000).map(a => a.raqam),
    uzilishlar: uzilishlar.slice(0, 60),
    uzilishSoni: uzilishlar.length,
    takror,
    tuzatilgan: moddalar.filter(a => a.tuzatildi).map(a => `${a.xomRaqam}→${a.raqam}`),
    ortachaUzunlik: moddalar.length ? Math.round(jami / moddalar.length) : 0,
    boblar: [...new Set(moddalar.map(a => a.bob).filter(Boolean))].length
  };
}
