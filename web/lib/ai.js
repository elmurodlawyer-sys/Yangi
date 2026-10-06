// AI provayderi ustidagi yupqa qatlam.
//
// Maqsad: modelni almashtirish bitta muhit o'zgaruvchisini o'zgartirish
// bo'lsin. Hozir Gemini bepul limitida ishlaymiz, daromad kelganda
// AI_PROVAYDER=anthropic qilib qo'yiladi — kodga tegilmaydi.
//
// API kalit FAQAT shu yerda, server tomonda. Brauzerga hech qachon
// yuborilmaydi.

const PROVAYDERLAR = {
  gemini: {
    kalitNomi: "GEMINI_API_KEY",
    standartModel: "gemini-2.5-flash",
    async sora({ kalit, model, prompt, jsonKutilmoqda }) {
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) + ":generateContent";
      const javob = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": kalit },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            ...(jsonKutilmoqda ? { responseMimeType: "application/json" } : {})
          }
        })
      });
      const tana = await javob.text();
      if (!javob.ok) throw xato(javob.status, tana, "gemini");
      const d = JSON.parse(tana);
      const yakun = d?.candidates?.[0];
      const matn = (yakun?.content?.parts || []).map(p => p.text || "").join("");
      if (!matn) {
        const sabab = yakun?.finishReason || d?.promptFeedback?.blockReason || "bo'sh javob";
        throw Object.assign(new Error("Model matn qaytarmadi: " + sabab), { kod: "bosh_javob" });
      }
      return matn;
    }
  },

  anthropic: {
    kalitNomi: "ANTHROPIC_API_KEY",
    standartModel: "claude-sonnet-5-5",
    async sora({ kalit, model, prompt }) {
      const javob = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": kalit,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const tana = await javob.text();
      if (!javob.ok) throw xato(javob.status, tana, "anthropic");
      const d = JSON.parse(tana);
      const matn = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      if (!matn) throw Object.assign(new Error("Model matn qaytarmadi"), { kod: "bosh_javob" });
      return matn;
    }
  },

  // OpenAI bilan mos API'lar: Groq, OpenRouter, Together va boshqalar.
  // AI_BAZA_URL ko'rsatiladi, masalan https://api.groq.com/openai/v1
  mos: {
    kalitNomi: "AI_API_KEY",
    standartModel: "",
    async sora({ kalit, model, prompt, jsonKutilmoqda }) {
      const baza = (process.env.AI_BAZA_URL || "").replace(/\/+$/, "");
      if (!baza) throw Object.assign(new Error("AI_BAZA_URL ko'rsatilmagan"), { kod: "sozlanmagan" });
      const javob = await fetch(baza + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + kalit },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          ...(jsonKutilmoqda ? { response_format: { type: "json_object" } } : {})
        })
      });
      const tana = await javob.text();
      if (!javob.ok) throw xato(javob.status, tana, "mos");
      const d = JSON.parse(tana);
      const matn = d?.choices?.[0]?.message?.content || "";
      if (!matn) throw Object.assign(new Error("Model matn qaytarmadi"), { kod: "bosh_javob" });
      return matn;
    }
  }
};

function xato(status, tana, provayder) {
  let xabar = tana;
  try {
    const j = JSON.parse(tana);
    xabar = j?.error?.message || j?.message || tana;
  } catch (e) { /* matn holida qoldiramiz */ }

  const kod =
    status === 401 || status === 403 ? "kalit_xato" :
    status === 429 ? "limit_tugadi" :
    status === 404 ? "model_topilmadi" :
    status >= 500 ? "server_xatosi" : "sorov_xatosi";

  return Object.assign(new Error(String(xabar).slice(0, 400)), { kod, status, provayder });
}

export function sozlama() {
  const nom = (process.env.AI_PROVAYDER || "gemini").toLowerCase();
  const p = PROVAYDERLAR[nom];
  if (!p) {
    throw Object.assign(
      new Error("AI_PROVAYDER noto'g'ri: " + nom + ". Mumkin: " + Object.keys(PROVAYDERLAR).join(", ")),
      { kod: "sozlanmagan" }
    );
  }
  const kalit = process.env[p.kalitNomi] || process.env.AI_API_KEY || "";
  const model = process.env.AI_MODEL || p.standartModel;
  return { nom, p, kalit, model };
}

/** Modeldan javob so'raydi. jsonKutilmoqda=true bo'lsa JSON qaytaradi. */
export async function soraModelga(prompt, { jsonKutilmoqda = true } = {}) {
  const { nom, p, kalit, model } = sozlama();
  if (!kalit) {
    throw Object.assign(
      new Error(p.kalitNomi + " o'rnatilmagan. Hosting sozlamalarida muhit o'zgaruvchisi sifatida qo'shing."),
      { kod: "sozlanmagan" }
    );
  }
  if (!model) {
    throw Object.assign(new Error("AI_MODEL ko'rsatilmagan"), { kod: "sozlanmagan" });
  }
  const matn = await p.sora({ kalit, model, prompt, jsonKutilmoqda });
  return { matn, model, provayder: nom };
}

/** Modeldan JSON so'raydi va tolerant tahlil qiladi. */
export async function soraJson(prompt) {
  const { matn, model, provayder } = await soraModelga(prompt, { jsonKutilmoqda: true });
  const d = jsonAjrat(matn);
  if (d === undefined) {
    throw Object.assign(new Error("Model JSON qaytarmadi"), { kod: "json_xato", xomMatn: matn.slice(0, 600) });
  }
  return { data: d, model, provayder };
}

// Model JSON'ni kod blokiga o'rab yuborishi yoki oldidan gap yozishi mumkin.
export function jsonAjrat(matn) {
  const s = String(matn).trim();
  try { return JSON.parse(s); } catch (e) { /* keyingi usul */ }

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch (e) { /* keyingi usul */ } }

  const bosh = s.search(/[{[]/);
  const oxir = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (bosh >= 0 && oxir > bosh) {
    try { return JSON.parse(s.slice(bosh, oxir + 1)); } catch (e) { /* taslim */ }
  }
  return undefined;
}
