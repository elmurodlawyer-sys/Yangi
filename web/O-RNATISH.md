# Saytni ishga tushirish — bosqichma-bosqich

Kod yozish kerak emas. Uchta bepul hisob ochiladi, ikkita qiymat
ko'chiriladi — tamom.

Natija: sayt o'z manzilida ishlaydi, AI xarajati **sizning Claude
limitingizdan ketmaydi**, va hamkasblaringizda hech qanday hisob kerak
bo'lmaydi.

> **⚠️ API kalitni menga yoki hech kimga chatda yubormang.**
> Kalit faqat hosting sozlamalariga kiritiladi. Kalit qo'lga tushsa,
> boshqa odam sizning hisobingizdan pul sarflaydi.

---

## 1-qadam. Gemini API kaliti (bepul)

1. Oching: **https://aistudio.google.com/apikey**
2. Gmail hisobingiz bilan kiring (sizda bor)
3. **Create API key** bosing
4. Kalit chiqadi — `AIza...` bilan boshlanadi. Nusxalab qo'ying

Bu kalit bepul limitda ishlaydi. Karta kerak emas.

---

## 2-qadam. Vercel — saytni joylash (bepul)

1. Oching: **https://vercel.com/signup**
2. **Continue with GitHub** bosing (GitHub hisobingiz bor)
3. **Add New → Project** bosing
4. Ro'yxatdan **`Yangi`** repozitoriyasini tanlang → **Import**
5. **Root Directory** maydonida **`web`** deb ko'rsating ← *muhim*
6. **Environment Variables** bo'limini ochib quyidagilarni qo'shing:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | 1-qadamdagi kalit |
| `AI_PROVAYDER` | `gemini` |
| `AI_MODEL` | `gemini-2.5-flash` |
| `KIRISH_KODI` | o'zingiz o'ylab topgan so'z, masalan `HUQUQ2026` |

7. **Deploy** bosing. 1-2 daqiqada tayyor
8. Sayt manzili chiqadi: `huquq-eksperti-xxx.vercel.app`

### Tekshirish

Sayt manziliga `/api/holat` qo'shib oching:

```
https://sizning-saytingiz.vercel.app/api/holat
```

Shunday chiqishi kerak:

```json
{
  "sozlangan": true,
  "provayder": "gemini",
  "model": "gemini-2.5-flash",
  "kalit_ornatilgan": true,
  "model_mavjud": true,
  "kirish_kodi_talab": true
}
```

- `kalit_ornatilgan: false` → kalit qo'shilmagan, 6-bandni qayta ko'ring
- `model_mavjud: false` → `mavjud_modellar` ro'yxatidan boshqa nom tanlab,
  `AI_MODEL` qiymatini o'zgartiring va qayta deploy qiling

---

## 3-qadam. Supabase — fikrlarni saqlash (bepul)

Bu qadamsiz ham sayt ishlaydi, lekin hamkasblar fikri **saqlanmaydi**.

1. Oching: **https://supabase.com/dashboard** → GitHub bilan kiring
2. **New project** → nom bering → parol qo'ying → **Create**
3. Chap menyuda **SQL Editor** → **New query** → quyidagini joylashtirib
   **Run** bosing:

```sql
create table if not exists fikrlar (
  id bigint generated always as identity primary key,
  vaqt timestamptz default now(),
  kim text,
  rejim text,
  savol text,
  baho text,
  belgilar text[],
  izoh text,
  topilgan_moddalar text[],
  iqtibos_qilingan text[],
  tekshirilmagan_iqtibos text[],
  ishonch text,
  qisqa_javob text,
  model text,
  prompt_versiya text,
  baza_bosh boolean default false
);

-- Jadval faqat server kaliti bilan ochiladi; brauzerdan o'qilmaydi.
alter table fikrlar enable row level security;
```

4. **Project Settings → API** bo'limiga o'tib ikkita qiymatni oling:
   - **Project URL** (`https://xxx.supabase.co`)
   - **service_role** kaliti — *`anon` emas, `service_role`*

5. Vercel'ga qaytib **Settings → Environment Variables** da qo'shing:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | service_role kaliti |

6. **Deployments → ⋯ → Redeploy** bosing

Tekshirish: `/api/holat` da `"fikr_saqlanadi": true` bo'lishi kerak.

---

## Hamkasblarga yuborish

Yuboradigan narsa: **sayt manzili** va **kirish kodi**.

```
Huquq Eksperti — beta sinov

Sayt:  https://sizning-saytingiz.vercel.app
Kod:   HUQUQ2026

Hech qanday hisob kerak emas — shunchaki oching.
O'z amaliyotingizdan real savollar bering va har javob
ostidagi panelda fikr yozing, ayniqsa modda raqami xato bo'lsa.
```

Kirish kodi nima uchun: bepul API limitini begona so'rovlardan saqlaydi.
Kodni olib tashlash uchun Vercel'da `KIRISH_KODI` o'zgaruvchisini
o'chirib, qayta deploy qiling.

---

## Modelni almashtirish

Sifat yetarli bo'lmasa yoki daromad kelsa, **bitta qiymat** o'zgaradi:

| Maqsad | `AI_PROVAYDER` | `AI_MODEL` | Kalit o'zgaruvchisi |
|---|---|---|---|
| Bepul limit (hozir) | `gemini` | `gemini-2.5-flash` | `GEMINI_API_KEY` |
| Yuqori sifat | `anthropic` | `claude-sonnet-5-5` | `ANTHROPIC_API_KEY` |
| Eng murakkab tahlil | `anthropic` | `claude-opus-5-5` | `ANTHROPIC_API_KEY` |
| Groq, OpenRouter va boshqalar | `mos` | provayder nomi | `AI_API_KEY` + `AI_BAZA_URL` |

Kodga tegilmaydi.

---

## Xarajat

| Narsa | Narx |
|---|---|
| Vercel hosting | 0 |
| Supabase baza | 0 (500 MB) |
| Gemini API | 0 (bepul limit ichida) |
| Qonun bazasi | 0 |
| Domen (`.vercel.app`) | 0 |

Gemini bepul limiti tugasa, sayt «Modelning bepul limiti tugadi» deb
yozadi — kutilmaganda pul yechilmaydi.

---

## Xatolik bo'lsa

| Belgi | Sabab | Yechim |
|---|---|---|
| «Server to'liq sozlanmagan» | kalit qo'shilmagan | `/api/holat` ni ochib tekshiring |
| «API kalit qabul qilinmadi» | kalit xato ko'chirilgan | kalitni qaytadan nusxalang |
| «Model topilmadi» | model nomi o'zgargan | `/api/holat` dagi `mavjud_modellar` dan tanlang |
| Sahifa bo'sh, baza yuklanmaydi | `web/qonun/` nashrga tushmagan | `./tayyorla.sh` yuritib qayta push qiling |
| «Kirish kodi noto'g'ri» | kod mos emas | Vercel'dagi `KIRISH_KODI` bilan solishtiring |

---

## Tuzilma

```
web/
  index.html          sahifa — qidiruv brauzerda ishlaydi
  qonun/*.json        qonun bazasi (tayyorla.sh ko'chiradi)
  lib/ai.js           provayderdan mustaqil AI qatlami
  lib/prompt.js       PROMPTLAR — sifat shu fayldan
  api/javob.js        savol → model → JSON
  api/fikr.js         fikr → Supabase
  api/holat.js        sozlama diagnostikasi
  test/server.test.mjs  node test/server.test.mjs
```

`lib/prompt.js` eng muhim fayl: hamkasblar fikri tahlil qilingach aynan
shu qayta yoziladi.
