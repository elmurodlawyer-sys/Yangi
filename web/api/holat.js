// GET /api/holat
// Sozlama to'g'ri ekanini tekshirish uchun. Kalitning O'ZI qaytarilmaydi —
// faqat o'rnatilgani yoki yo'qligi. Gemini uchun mavjud modellar ro'yxati
// ham qaytariladi: model nomi o'zgarsa shu yerdan ko'rinadi.

import { sozlama } from "../lib/ai.js";

export default async function handler(req, res) {
  let s;
  try { s = sozlama(); }
  catch (e) { return res.status(500).json({ sozlangan: false, xato: e.message }); }

  const natija = {
    sozlangan: Boolean(s.kalit),
    provayder: s.nom,
    model: s.model,
    kalit_nomi: s.p.kalitNomi,
    kalit_ornatilgan: Boolean(s.kalit),
    kirish_kodi_talab: Boolean(process.env.KIRISH_KODI),
    fikr_saqlanadi: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  };

  if (s.nom === "gemini" && s.kalit) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": s.kalit }
      });
      if (r.ok) {
        const d = await r.json();
        natija.mavjud_modellar = (d.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map(m => String(m.name || "").replace(/^models\//, ""))
          .sort();
        natija.model_mavjud = natija.mavjud_modellar.includes(s.model);
      } else {
        natija.modellar_xatosi = "HTTP " + r.status;
        if (r.status === 400 || r.status === 403) natija.kalit_ishlaydi = false;
      }
    } catch (e) {
      natija.modellar_xatosi = e.message;
    }
  }

  return res.status(200).json(natija);
}
