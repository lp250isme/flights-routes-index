// Flight-number route index from VRS standing-data (CC0): callsign -> IATA flight number + IATA airports.
// 航班號聯想索引（VRS standing-data，CC0）：呼號 → IATA 班號＋起訖機場。

/** 簡單 CSV 一行切欄（VRS／OurAirports 會用雙引號包含逗號的欄位） */
export function csvRow(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function rows(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = csvRow(lines[0]);
  return lines.slice(1).map((l) => { const r = csvRow(l); return Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])); });
}

/**
 * routesCsv：Callsign,Code,Number,AirlineCode,AirportCodes（機場是 ICAO，以 - 串起多段）
 * airlinesCsv：Code,Name,ICAO,IATA,…
 * airportsCsv：OurAirports（icao_code／gps_code／ident → iata_code）
 * 回傳 { text, stats }：text 是 TSV，第一行版本，A 行航空公司、R 行航班
 */
export function buildRoutesIndex({ routesCsv, airlinesCsv, airportsCsv, generated = new Date().toISOString().slice(0, 10) }) {
  const icaoToIata = new Map();     // 航空公司
  const airlineName = new Map();
  for (const a of rows(airlinesCsv)) {
    const icao = (a.ICAO || '').trim().toUpperCase(), iata = (a.IATA || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(icao)) continue;
    if (/^[A-Z0-9]{2}$/.test(iata) && !icaoToIata.has(icao)) icaoToIata.set(icao, iata);
    if (a.Name && !airlineName.has(icao)) airlineName.set(icao, a.Name.trim());
  }
  const apt = new Map();            // 機場 ICAO → IATA
  for (const a of rows(airportsCsv)) {
    const iata = (a.iata_code || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata)) continue;
    for (const k of [a.icao_code, a.gps_code, a.ident]) {
      const c = (k || '').trim().toUpperCase();
      if (/^[A-Z0-9]{4}$/.test(c) && !apt.has(c)) apt.set(c, iata);
    }
  }
  const seen = new Set(), out = [], usedAirlines = new Set();
  let raw = 0, iataCount = 0;
  for (const r of rows(routesCsv)) {
    raw++;
    const code = (r.Code || r.AirlineCode || '').trim().toUpperCase();
    const num = (r.Number || '').trim().toUpperCase();
    const stops = (r.AirportCodes || '').split('-').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!code || !num || stops.length < 2) continue;
    const iata = icaoToIata.get(code);
    const flight = (iata || code) + num;
    const route = stops.map((s) => apt.get(s) || s).join('-');
    const key = flight + '\t' + route;
    if (seen.has(key)) continue;
    seen.add(key);
    if (iata) iataCount++;
    usedAirlines.add(code);
    out.push(key);
  }
  out.sort();
  const airlines = [...usedAirlines].sort().map((c) => `A\t${c}\t${icaoToIata.get(c) || ''}\t${(airlineName.get(c) || '').replace(/\t/g, ' ')}`);
  const text = [`#flights-routes v1 ${generated}`, ...airlines, ...out.map((l) => 'R\t' + l)].join('\n') + '\n';
  return { text, stats: { raw, kept: out.length, iata: iataCount, airlines: airlines.length } };
}

