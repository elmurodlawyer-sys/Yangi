#!/bin/sh
# Prototip sahifasi uchun qonun paketini qayta yasaydi va ko'chiradi.
# Sahifani nashr qilishdan oldin yuritiladi.
set -e
cd "$(dirname "$0")"
node ../qonun/bin/web-paket.mjs
mkdir -p qonun
cp ../qonun/data/web/*.json qonun/
echo "prototip/qonun/ yangilandi"
