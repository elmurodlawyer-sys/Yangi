// O'zbek huquqiy matni uchun normalizatsiya va yengil stemming.
// Qidiruv sifati shu moduldan boshlanadi: apostrof va qo'shimchalar
// to'g'ri ishlanmasa, "shartnomani" so'rovi "shartnoma" moddasini topmaydi.

// Apostrof variantlari — matnlarda hammasi uchraydi, bittasiga keltiramiz.
const APOSTROFLAR = /[ʻʼ‘’`´′׳]/g;

// Kirill → lotin (o'zbek). Uzun ketma-ketliklar avval almashtiriladi.
const KIRILL = [
  ["нг", "ng"], ["ё", "yo"], ["ю", "yu"], ["я", "ya"], ["ц", "ts"],
  ["ч", "ch"], ["ш", "sh"], ["ў", "o'"], ["ғ", "g'"], ["қ", "q"],
  ["ҳ", "h"], ["а", "a"], ["б", "b"], ["в", "v"], ["г", "g"],
  ["д", "d"], ["е", "e"], ["ж", "j"], ["з", "z"], ["и", "i"],
  ["й", "y"], ["к", "k"], ["л", "l"], ["м", "m"], ["н", "n"],
  ["о", "o"], ["п", "p"], ["р", "r"], ["с", "s"], ["т", "t"],
  ["у", "u"], ["ф", "f"], ["х", "x"], ["ъ", "'"], ["ы", "i"],
  ["ь", ""],  ["э", "e"]
];

const KIRILL_BOR = /[Ѐ-ӿ]/;

export function kirillLotin(s) {
  if (!KIRILL_BOR.test(s)) return s;
  let out = s;
  for (const [k, l] of KIRILL) out = out.split(k).join(l);
  return out;
}

/** Faqat apostrof va bo'shliqni tartibga soladi; registr saqlanadi.
 *  Sarlavhani asl ko'rinishida olish uchun kerak. */
export function yengilNormalize(s) {
  if (!s) return "";
  return String(s).normalize("NFC")
    .replace(APOSTROFLAR, "'")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Qidiruv va solishtirish uchun matnni bir ko'rinishga keltiradi. */
export function normalize(s) {
  if (!s) return "";
  let out = String(s).normalize("NFC").toLowerCase();
  out = kirillLotin(out);
  out = out.replace(APOSTROFLAR, "'");
  out = out.replace(/ /g, " ");
  return out.replace(/\s+/g, " ").trim();
}

// Eng uzunidan boshlab tekshiriladi. Qisqa o'zakni buzmaslik uchun
// natija MIN_OZAK belgidan qisqa bo'lsa, qo'shimcha olinmaydi.
const QOSHIMCHALAR = [
  "larimizning", "laringizning", "larininig", "larining", "larimiz", "laringiz",
  "lardagi", "laridan", "lariga", "larida", "larini", "larga", "larni", "lardan",
  "ларнинг", "lari", "lar",
  "imizning", "ingizning", "sining", "larcha",
  "ningdek", "nikidan", "nikiga", "ning", "niki",
  "imizga", "ingizga", "imizda", "ingizda", "imizni", "ingizni",
  "dagi", "dan", "ga", "da", "ni", "nd",
  "siga", "sida", "sini", "siz", "si",
  "iga", "ida", "ini", "imiz", "ingiz",
  "yotgan", "adigan", "ydigan", "moqda", "gan", "kan", "qan",
  "uvchi", "ovchi", "ishi", "lik", "liq", "chi", "dek"
];

const MIN_OZAK = 5;

/** Yengil stemming: ko'pi bilan ikki qo'shimcha olinadi (shartnoma-lar-ni). */
export function stem(token) {
  let t = token;
  for (let qadam = 0; qadam < 2; qadam++) {
    let topildi = false;
    for (const q of QOSHIMCHALAR) {
      if (t.length > q.length && t.endsWith(q)) {
        const qolgan = t.slice(0, -q.length);
        if (qolgan.length >= MIN_OZAK) { t = qolgan; topildi = true; break; }
      }
    }
    if (!topildi) break;
  }
  return t;
}

// Huquqiy matnda ma'no tashimaydigan, lekin juda ko'p uchraydigan so'zlar.
export const TOXTAM = new Set([
  "va", "yoki", "hamda", "bilan", "uchun", "bo'yicha", "haqida", "to'g'risida",
  "shu", "ushbu", "u", "bu", "o'z", "ham", "agar", "lekin", "ammo", "biroq",
  "bo'lsa", "bo'lgan", "bo'ladi", "bo'lishi", "etadi", "etiladi", "qiladi",
  "qilinadi", "hisoblanadi", "mumkin", "kerak", "zarur", "quyidagi",
  "quyidagicha", "ya'ni", "misol", "ko'ra", "qarab", "holda", "holatda",
  "tomonidan", "orqali", "keyin", "oldin", "har", "hech", "barcha", "ba'zi"
]);

/** Matnni qidiruv uchun o'zaklar ro'yxatiga aylantiradi. */
export function tokenize(s, { toxtamniOlib = true } = {}) {
  const norm = normalize(s);
  const xom = norm.split(/[^a-z0-9']+/).filter(Boolean);
  const out = [];
  for (const w of xom) {
    const t = w.replace(/^'+|'+$/g, "");
    if (t.length < 2) continue;
    if (toxtamniOlib && TOXTAM.has(t)) continue;
    if (/^\d+$/.test(t)) { out.push(t); continue; }
    out.push(stem(t));
  }
  return out;
}
