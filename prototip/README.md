# Huquq Eksperti — prototip

Ishlaydigan sahifa: O'zbekiston qonunchiligi bo'yicha huquqiy savollarga
javob beradi va hujjatlarni risk bo'yicha tahlil qiladi.

Server, API kalit va hosting talab qilmaydi — sahifa Claude'ga ko'rish
vaqtida o'zi murojaat qiladi va qonun bazasini o'zi bilan olib yuradi.

## Javob qanday tuziladi

```
1. So'rov o'zaklarga bo'linadi
   (qo'shimchalar olinadi, apostrof birxillashtiriladi, kirill → lotin)

2. BM25 bazadan eng mos 6 moddani topadi
   — bu qadam bepul va mahalliy, Claude ishtirok etmaydi

3. Claude'ga FAQAT shu moddalar matni yuboriladi
   promptda: "ro'yxatda yo'q raqamni yozmang"

4. Javobdagi har bir modda raqami ro'yxatga solishtiriladi
   mos kelmasa — "tekshirilmagan" qizil belgisi
```

4-qadam muhim: prompt qoidasi buzilsa ham, foydalanuvchi buni ko'radi.
Ikki himoya qatlami — prompt va tekshiruv.

## Fikr-mulohaza

Har javob ostida fikr paneli: baho, muammo belgilari (modda xato, javob
to'liq emas, savolni tushunmadi va boshqalar), erkin izoh va ism.

Yozuvlar artefakt bazasining `fikrlar` to'plamiga tushadi. Har yozuvda:

| maydon | nima uchun kerak |
|---|---|
| `savol` | qaysi so'rovda muammo bo'lgani |
| `topilgan_moddalar` | qidiruv to'g'ri ishladimi |
| `iqtibos_qilingan` | AI qaysi moddalarni ko'rsatgan |
| `tekshirilmagan_iqtibos` | AI ro'yxatdan chetga chiqqanmi |
| `belgilar`, `izoh`, `baho` | foydalanuvchi bahosi |
| `ishonch` | AI o'z javobiga qanchalik ishonganini |

Shu maydonlar birgalikda muammoni aniq ko'rsatadi: qidiruv xatosimi
(kerakli modda topilmagan), prompt xatosimi (modda topilgan, lekin AI
ishlatmagan), yoki tahlil xatosimi.

## Paketni yangilash

Qonun bazasi o'zgarsa, nashrdan oldin:

```bash
./yangila.sh
```

`prototip/qonun/` papkasi git'da saqlanmaydi — u `qonun/` modulidan
bir buyruq bilan qayta yasaladi.
