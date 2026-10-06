// Bir faylga birlashtirilgan hujjatlarni ajratadi.
// Yuklangan fayl "## Document N: <nom>" sarlavhalari bilan kelgan.

export function hujjatlarniAjrat(matn) {
  const toza = String(matn).replace(/\r\n?/g, "\n").replace(/﻿/g, "");
  const satrlar = toza.split("\n");
  const chegaralar = [];

  satrlar.forEach((s, i) => {
    const m = s.match(/^##\s*Document\s+(\d+)\s*:\s*(.*)$/i);
    if (m) chegaralar.push({ raqam: +m[1], manba: m[2].trim(), satr: i });
  });

  if (!chegaralar.length) return [{ raqam: 1, manba: "", matn: toza, boshSatr: 0 }];

  return chegaralar.map((c, i) => {
    const oxir = i + 1 < chegaralar.length ? chegaralar[i + 1].satr : satrlar.length;
    return {
      raqam: c.raqam,
      manba: c.manba,
      boshSatr: c.satr + 1,
      matn: satrlar.slice(c.satr + 1, oxir).join("\n")
    };
  });
}

/** Hujjat boshidagi birinchi mazmunli satrlardan kodeks nomini taxmin qiladi. */
export function nomniTop(matn) {
  const satrlar = matn.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 12);
  for (const s of satrlar) {
    if (/kodeks/i.test(s) && s.length < 120) return s.replace(/\s+/g, " ");
  }
  return "";
}

/** "BIRINCHI QISM" / "IKKINCHI QISM" kabi qism belgisini topadi. */
export function qismniTop(matn) {
  const m = matn.slice(0, 4000).match(/^\s*(birinchi|ikkinchi|uchinchi|umumiy|maxsus)\s+qism\s*$/im);
  return m ? m[1].toLowerCase() : "";
}
