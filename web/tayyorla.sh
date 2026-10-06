#!/bin/sh
# Saytni nashrga tayyorlaydi: qonun bazasini qonun/ modulidan ko'chiradi.
set -e
cd "$(dirname "$0")"
node ../qonun/bin/web-paket.mjs
mkdir -p qonun
cp ../qonun/data/web/*.json qonun/
echo "web/qonun/ tayyor"
