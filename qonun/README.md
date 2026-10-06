# Qonun bazasi

«Huquq Eksperti» uchun O'zbekiston qonunchiligi bazasi: markdown qonun
matnlarini moddalarga ajratadi, qidiruv indeksini yasaydi va so'rovga mos
moddalarni qaytaradi.

Tashqi kutubxona talab qilmaydi — faqat Node.js.

## Nega bu kerak

AI modeli modda raqamini o'ylab topishi mumkin, va yuridik mahsulotda bu
qabul qilinmaydi. Bu baza AI'ga **haqiqiy modda matnini** beradi: javob
faqat shu matn asosida tuziladi, iqtibos esa tekshirib ko'rish mumkin
bo'lgan raqamga ega bo'ladi.

## Buyruqlar

```bash
# Birlashtirilgan faylni avtomatik ajratish (bir necha kodeks bitta faylda)
node bin/qonun.mjs kirit xom/mehnat-fuqarolik-lex-uz.md

# Bitta kodeks fayli
node bin/qonun.mjs parse xom/oila.md --kod oila --nom "Oila kodeksi"

# Qidiruv indeksi
node bin/qonun.mjs index

# Qidiruv
node bin/qonun.mjs search "sinov muddati kasallik kunlari"
node bin/qonun.mjs search "shartnomani bekor qilish" --kod fuqaro --soni 10

# Bitta moddani to'liq ko'rish
node bin/qonun.mjs modda mehnat 130

# Baza holati
node bin/qonun.mjs stats
```

## Joriy baza

| Kodeks | Moddalar | Sharhli |
|---|---|---|
| Mehnat kodeksi | 579 | 257 |
| Fuqarolik kodeksi (1 va 2-qism) | 1197 | 606 |

Manba: lex.uz eksporti (`xom/` papkasida saqlangan, qayta yasash uchun).

## Tuzilma

```
qonun/
  bin/qonun.mjs        CLI
  lib/normalize.mjs    o'zbek matni normalizatsiyasi va stemming
  lib/split.mjs        birlashtirilgan faylni hujjatlarga ajratish
  lib/parse.mjs        markdown → moddalar
  lib/search.mjs       BM25 qidiruv
  xom/                 asl markdown fayllar
  data/                ajratilgan JSON va indeks
  test/                parser shakl testi
```

## Modda yozuvi

```json
{
  "id": "mehnat:130",
  "kod": "mehnat",
  "kodNomi": "Mehnat kodeksi",
  "raqam": "130",
  "sarlavha": "Dastlabki sinov muddati",
  "matn": "Dastlabki sinov muddati uch oydan...",
  "sharh": "Qarang: mazkur Kodeksning 12-bobi.",
  "bob": "12", "bobNomi": "...",
  "bolim": "...", "paragraf": "...",
  "qism": "umumiy",
  "satr": 1234
}
```

`sharh` — lex.uz havolalari va o'zaro bog'lanishlar. **Qonun matni emas**,
shuning uchun alohida maydonda: AI uni norma deb iqtibos qilmasligi kerak.

## Yechilgan muammolar

**Yuqori indeks.** `.doc → markdown` o'girishda `26¹-modda` → `261-modda`
bo'lib qoladi. Parser qo'shni moddalar bilan solishtirib tiklaydi
(`26^1`). Joriy bazada 17 ta modda shu yo'l bilan tuzatilgan.

**Apostrof.** `ʻ ʼ ' ' ` ´` — hammasi `'` ga keltiriladi, aks holda
qidiruv `bo'shatish` so'rovini `boʻshatish` matnida topmaydi.

**Qo'shimchalar.** O'zbek tili affiksal: `shartnoma / shartnomani /
shartnomalarning`. Yengil stemming ko'pi bilan ikki qo'shimchani oladi,
o'zak 5 belgidan qisqa bo'lsa — olmaydi.

**Kirill.** Kirill matni lotinga o'giriladi, shuning uchun kirill so'rov
lotin matnni topadi.

## Nega BM25, embedding emas

- O'zbek tili uchun embedding modellari kuchsiz
- Huquqiy til aniq: «sinov muddati» matnda aynan shunday turadi
- Bepul, tez, server talab qilmaydi
- Natijasi tushunarli: qaysi o'zak topilganini ko'rish mumkin
  (`topilganOzaklar`)

Embedding keyinchalik, kerak bo'lsa, ustiga qo'shiladi.

## Sifatni tekshirish

`kirit` va `parse` buyruqlari har yuklashda hisobot beradi: topilgan modda
soni, raqamlardagi uzilishlar, takrorlar, juda qisqa yoki juda uzun
matnlar, tiklangan yuqori indekslar. Sonlar kutilganidan farq qilsa —
sarlavha shaklini moslash kerak.

Parser shakl testi:

```bash
node bin/qonun.mjs parse test/shakl-testi.md --kod test --nom "Shakl testi"
# 8 modda topilishi kerak; 5 va 6 uzilishi — kutilgan natija
```
