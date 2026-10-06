// POST /api/fikr
// Hamkasblarning taklif va shikoyatlari. Supabase sozlangan bo'lsa shunga
// yoziladi; sozlanmagan bo'lsa saqlanmagani ochiq aytiladi — "saqlandi"
// deb yolg'on javob qaytarilmaydi.

const MAX = { savol: 3000, izoh: 4000, kim: 120, qisqa_javob: 1200 };

function qirq(v, n) { return String(v == null ? "" : v).slice(0, n); }

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ xato: "Faqat POST" });

  let tana = req.body;
  if (typeof tana === "string") { try { tana = JSON.parse(tana); } catch (e) { tana = null; } }
  if (!tana || typeof tana !== "object") return res.status(400).json({ xato: "JSON tana kutilmoqda" });

  const yozuv = {
    vaqt: new Date().toISOString(),
    kim: qirq(tana.kim, MAX.kim),
    rejim: tana.rejim === "hujjat" ? "hujjat" : "savol",
    savol: qirq(tana.savol, MAX.savol),
    baho: ["yaxshi", "yomon"].includes(tana.baho) ? tana.baho : "",
    belgilar: Array.isArray(tana.belgilar) ? tana.belgilar.slice(0, 15).map(x => qirq(x, 40)) : [],
    izoh: qirq(tana.izoh, MAX.izoh),
    topilgan_moddalar: Array.isArray(tana.topilgan_moddalar) ? tana.topilgan_moddalar.slice(0, 20).map(x => qirq(x, 40)) : [],
    iqtibos_qilingan: Array.isArray(tana.iqtibos_qilingan) ? tana.iqtibos_qilingan.slice(0, 20).map(x => qirq(x, 40)) : [],
    tekshirilmagan_iqtibos: Array.isArray(tana.tekshirilmagan_iqtibos) ? tana.tekshirilmagan_iqtibos.slice(0, 20).map(x => qirq(x, 40)) : [],
    ishonch: qirq(tana.ishonch, 20),
    qisqa_javob: qirq(tana.qisqa_javob, MAX.qisqa_javob),
    model: qirq(tana.model, 80),
    prompt_versiya: qirq(tana.prompt_versiya, 20),
    // Baza javob bermagan so'rovlar: keyingi qaysi qonunni qo'shish kerakligini
    // aynan shu yozuvlar ko'rsatadi.
    baza_bosh: Boolean(tana.baza_bosh)
  };

  if (!yozuv.baho && !yozuv.belgilar.length && !yozuv.izoh && !yozuv.baza_bosh) {
    return res.status(400).json({ xato: "Bo'sh fikr" });
  }

  const url = process.env.SUPABASE_URL;
  const kalit = process.env.SUPABASE_SERVICE_KEY;
  const jadval = process.env.SUPABASE_JADVAL || "fikrlar";

  if (!url || !kalit) {
    console.log("FIKR (saqlanmadi, Supabase sozlanmagan):", JSON.stringify(yozuv));
    return res.status(200).json({
      saqlandi: false,
      sabab: "sozlanmagan",
      xabar: "Fikr qabul qilindi, lekin ma'lumotlar bazasi hali sozlanmagan."
    });
  }

  try {
    const r = await fetch(url.replace(/\/+$/, "") + "/rest/v1/" + encodeURIComponent(jadval), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: kalit,
        authorization: "Bearer " + kalit,
        prefer: "return=minimal"
      },
      body: JSON.stringify(yozuv)
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("supabase xatosi:", r.status, t.slice(0, 300));
      return res.status(502).json({ saqlandi: false, sabab: "baza_xatosi", xabar: "Fikr saqlanmadi." });
    }
    return res.status(200).json({ saqlandi: true });
  } catch (e) {
    console.error("fikr xatosi:", e.message);
    return res.status(502).json({ saqlandi: false, sabab: "tarmoq", xabar: "Fikr saqlanmadi." });
  }
}
