// Server funksiyalarini soxta so'rov va soxta fetch bilan tekshiradi.
// Tashqi tarmoq va API kalit talab qilmaydi.
//   node test/server.test.mjs

import assert from "node:assert/strict";

let otdi = 0, yiqildi = 0;
async function sinov(nom, fn) {
  try { await fn(); console.log("  ✅ " + nom); otdi++; }
  catch (e) { console.log("  ❌ " + nom + "\n     " + e.message); yiqildi++; }
}

function soxtaRes() {
  const r = { kod: 0, tana: null, tugadi: false };
  r.status = c => { r.kod = c; return r; };
  r.json = j => { r.tana = j; r.tugadi = true; return r; };
  r.end = () => { r.tugadi = true; return r; };
  return r;
}
const soxtaReq = (tana, sarl = {}) => ({ method: "POST", body: tana, headers: sarl });

const MODDA = {
  kodNomi: "Mehnat kodeksi", raqam: "130", sarlavha: "Dastlabki sinov muddati",
  bob: "12", bobNomi: "Mehnat shartnomasi",
  matn: "Dastlabki sinov muddati uch oydan oshmasligi kerak."
};

// Gemini javobi shaklida soxta fetch
function geminiStub(javobObyekti, holat = 200) {
  const chaqiruvlar = [];
  globalThis.fetch = async (url, opt) => {
    chaqiruvlar.push({ url: String(url), opt });
    return {
      ok: holat >= 200 && holat < 300,
      status: holat,
      text: async () => JSON.stringify(
        holat >= 400
          ? { error: { message: "soxta xato" } }
          : { candidates: [{ content: { parts: [{ text: JSON.stringify(javobObyekti) }] } }] }
      )
    };
  };
  return chaqiruvlar;
}

const asliyFetch = globalThis.fetch;
console.log("\nSERVER SINOVLARI\n");

// ── /api/javob
{
  const { default: javob } = await import("../api/javob.js");

  await sinov("kalit yo'q bo'lsa — 500 va sozlanmagan kodi", async () => {
    delete process.env.GEMINI_API_KEY; delete process.env.AI_API_KEY;
    process.env.AI_PROVAYDER = "gemini";
    const res = soxtaRes();
    await javob(soxtaReq({ rejim: "savol", sorov: "test", moddalar: [MODDA] }), res);
    assert.equal(res.kod, 500);
    assert.equal(res.tana.kod, "sozlanmagan");
  });

  await sinov("modda bo'lmasa — modelga murojaat qilinmaydi", async () => {
    process.env.GEMINI_API_KEY = "soxta";
    let chaqirildi = false;
    globalThis.fetch = async () => { chaqirildi = true; throw new Error("chaqirilmasligi kerak"); };
    const res = soxtaRes();
    await javob(soxtaReq({ rejim: "savol", sorov: "test", moddalar: [] }), res);
    assert.equal(res.kod, 400);
    assert.equal(res.tana.kod, "modda_yoq");
    assert.equal(chaqirildi, false, "baza bo'sh bo'lsa model chaqirilmasligi kerak");
  });

  await sinov("to'g'ri so'rov — JSON qaytadi va promptda modda matni bor", async () => {
    process.env.GEMINI_API_KEY = "soxta";
    const kutilgan = { soha: "Mehnat huquqi", qisqa_javob: "Javob.", ishonch: "yuqori",
                       moddalar: [{ manba: "Mehnat kodeksi", modda: "130" }] };
    const ch = geminiStub(kutilgan);
    const res = soxtaRes();
    await javob(soxtaReq({ rejim: "savol", sorov: "sinov muddati", moddalar: [MODDA] }), res);
    assert.equal(res.kod, 200, "HTTP 200 kutilgan, keldi: " + res.kod + " " + JSON.stringify(res.tana));
    assert.deepEqual(res.tana.data, kutilgan);
    assert.equal(res.tana.meta.moddalar_soni, 1);
    const yuborilgan = JSON.parse(ch[0].opt.body).contents[0].parts[0].text;
    assert.ok(yuborilgan.includes("Dastlabki sinov muddati uch oydan"), "prompt modda matnini o'z ichiga olishi kerak");
    assert.ok(yuborilgan.includes("Boshqa raqam yozilmasin"), "prompt cheklovni o'z ichiga olishi kerak");
    assert.ok(!yuborilgan.includes("soxta"), "API kalit promptga tushmasligi kerak");
  });

  await sinov("API kalit javobga chiqmaydi", async () => {
    process.env.GEMINI_API_KEY = "MAXFIY_KALIT_123";
    geminiStub({ qisqa_javob: "x" });
    const res = soxtaRes();
    await javob(soxtaReq({ rejim: "savol", sorov: "test", moddalar: [MODDA] }), res);
    assert.ok(!JSON.stringify(res.tana).includes("MAXFIY_KALIT_123"));
  });

  await sinov("provayder 429 qaytarsa — limit_tugadi", async () => {
    process.env.GEMINI_API_KEY = "soxta";
    geminiStub(null, 429);
    const res = soxtaRes();
    await javob(soxtaReq({ rejim: "savol", sorov: "test", moddalar: [MODDA] }), res);
    assert.equal(res.kod, 429);
    assert.equal(res.tana.kod, "limit_tugadi");
  });

  await sinov("kirish kodi noto'g'ri bo'lsa — 401", async () => {
    process.env.KIRISH_KODI = "MAXFIY";
    const res = soxtaRes();
    await javob(soxtaReq({ rejim: "savol", sorov: "test", moddalar: [MODDA] }, { "x-kirish-kodi": "xato" }), res);
    assert.equal(res.kod, 401);
    assert.equal(res.tana.kod, "kirish_kodi");
    delete process.env.KIRISH_KODI;
  });
}

// ── /api/fikr
{
  const { default: fikr } = await import("../api/fikr.js");

  await sinov("Supabase sozlanmagan — saqlandi:false, yolg'on aytilmaydi", async () => {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
    const res = soxtaRes();
    await fikr(soxtaReq({ baho: "yomon", izoh: "modda xato" }), res);
    assert.equal(res.kod, 200);
    assert.equal(res.tana.saqlandi, false);
    assert.equal(res.tana.sabab, "sozlanmagan");
  });

  await sinov("Supabase sozlangan — yozuv yuboriladi", async () => {
    process.env.SUPABASE_URL = "https://soxta.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "soxta-kalit";
    let yozilgan = null;
    globalThis.fetch = async (url, opt) => { yozilgan = { url: String(url), tana: JSON.parse(opt.body) }; return { ok: true, status: 201, text: async () => "" }; };
    const res = soxtaRes();
    await fikr(soxtaReq({ baho: "yomon", belgilar: ["modda-xato"], izoh: "xato", kim: "Dilshod" }), res);
    assert.equal(res.tana.saqlandi, true);
    assert.ok(yozilgan.url.includes("/rest/v1/fikrlar"));
    assert.equal(yozilgan.tana.baho, "yomon");
    assert.deepEqual(yozilgan.tana.belgilar, ["modda-xato"]);
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
  });

  await sinov("bo'sh fikr qabul qilinmaydi", async () => {
    const res = soxtaRes();
    await fikr(soxtaReq({ kim: "Dilshod" }), res);
    assert.equal(res.kod, 400);
  });
}

// ── jsonAjrat
{
  const { jsonAjrat } = await import("../lib/ai.js");
  await sinov("jsonAjrat: toza JSON, kod bloki va o'ralgan matn", async () => {
    assert.deepEqual(jsonAjrat('{"a":1}'), { a: 1 });
    assert.deepEqual(jsonAjrat('```json\n{"a":2}\n```'), { a: 2 });
    assert.deepEqual(jsonAjrat('Mana javob: {"a":3} — tugadi'), { a: 3 });
    assert.equal(jsonAjrat("umuman json emas"), undefined);
  });
}

globalThis.fetch = asliyFetch;
console.log(`\n  ${otdi} o'tdi, ${yiqildi} yiqildi\n`);
process.exit(yiqildi ? 1 : 0);
