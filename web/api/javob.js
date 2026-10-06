// POST /api/javob
// Brauzer qonun bazasidan moddalarni O'ZI topadi va shu yerga savol bilan
// birga yuboradi. Server faqat modelga murojaat qiladi — qidiruv uchun
// hisoblash quvvati sarflanmaydi, API kalit esa brauzerga chiqmaydi.

import { soraJson } from "../lib/ai.js";
import { promptYasa, PROMPT_VERSIYA } from "../lib/prompt.js";

// Bepul limitni tasodifiy yoki qasddan tugatib qo'yishdan saqlanish.
// Serverless'da xotira sovuq ishga tushishda tozalanadi, shuning uchun bu
// qat'iy emas — asosiy himoya KIRISH_KODI.
const OYNA_MS = 60_000;
const OYNADA_MAX = 8;
const hisob = new Map();

function limitOshdimi(ip) {
  const hozir = Date.now();
  const r = hisob.get(ip);
  if (!r || hozir - r.bosh > OYNA_MS) { hisob.set(ip, { bosh: hozir, son: 1 }); return false; }
  r.son++;
  if (hisob.size > 5000) hisob.clear();
  return r.son > OYNADA_MAX;
}

const XATO_MATNI = {
  sozlanmagan: "Server to'liq sozlanmagan. Hosting sozlamalarida API kalitni tekshiring.",
  kalit_xato: "API kalit qabul qilinmadi. Hosting sozlamalaridagi kalitni tekshiring.",
  limit_tugadi: "Modelning bepul limiti tugadi. Birozdan keyin qayta urinib ko'ring.",
  model_topilmadi: "Ko'rsatilgan model topilmadi. /api/holat sahifasida mavjud modellarni ko'ring.",
  server_xatosi: "Model xizmatida vaqtinchalik xatolik. Qayta urinib ko'ring.",
  json_xato: "Model javobi kutilgan tuzilmada kelmadi. Qayta urinib ko'ring.",
  bosh_javob: "Model javob qaytarmadi. So'rovni boshqacha ifodalab ko'ring.",
  sorov_xatosi: "So'rov qabul qilinmadi."
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ xato: "Faqat POST" });

  const kirishKodi = process.env.KIRISH_KODI || "";
  if (kirishKodi) {
    const berilgan = req.headers["x-kirish-kodi"] || "";
    if (berilgan !== kirishKodi) {
      return res.status(401).json({ kod: "kirish_kodi", xato: "Kirish kodi noto'g'ri yoki kiritilmagan." });
    }
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "nomalum";
  if (limitOshdimi(ip)) {
    return res.status(429).json({ kod: "tez_sorov", xato: "Juda ko'p so'rov. Bir daqiqa kutib qayta urinib ko'ring." });
  }

  let tana = req.body;
  if (typeof tana === "string") { try { tana = JSON.parse(tana); } catch (e) { tana = null; } }
  if (!tana || typeof tana !== "object") {
    return res.status(400).json({ xato: "JSON tana kutilmoqda" });
  }

  const rejim = tana.rejim === "hujjat" ? "hujjat" : "savol";
  const sorov = String(tana.sorov || "").trim();
  const moddalar = Array.isArray(tana.moddalar) ? tana.moddalar : [];

  if (!sorov) return res.status(400).json({ xato: "So'rov bo'sh" });
  if (!moddalar.length) {
    return res.status(400).json({
      kod: "modda_yoq",
      xato: "Bazadan mos norma topilmadi. Model baza matnisiz javob bermaydi."
    });
  }

  // Modda yozuvlarini tozalaymiz: brauzerdan kelgan ma'lumotga ishonmaymiz.
  const toza = moddalar.slice(0, 10).map(a => ({
    kodNomi: String(a.kodNomi || "").slice(0, 120),
    raqam: String(a.raqam || "").slice(0, 20),
    sarlavha: String(a.sarlavha || "").slice(0, 600),
    bob: String(a.bob || "").slice(0, 20),
    bobNomi: String(a.bobNomi || "").slice(0, 200),
    matn: String(a.matn || "").slice(0, 6000)
  })).filter(a => a.raqam && a.matn);

  if (!toza.length) return res.status(400).json({ xato: "Modda matni bo'sh" });

  try {
    const { data, model, provayder } = await soraJson(promptYasa({ rejim, sorov, moddalar: toza }));
    return res.status(200).json({
      data,
      meta: { model, provayder, prompt_versiya: PROMPT_VERSIYA, moddalar_soni: toza.length }
    });
  } catch (e) {
    const kod = e?.kod || "server_xatosi";
    const holat = kod === "limit_tugadi" ? 429 : (kod === "sozlanmagan" || kod === "kalit_xato") ? 500 : 502;
    // Batafsil xabar faqat jurnalga — foydalanuvchiga sodda matn.
    console.error("javob xatosi:", kod, e?.message);
    return res.status(holat).json({ kod, xato: XATO_MATNI[kod] || XATO_MATNI.server_xatosi });
  }
}
