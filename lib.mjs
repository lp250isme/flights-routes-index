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
// 台灣的機場（IATA）：班號經過這些機場、TDX 班表卻沒有＝近期沒排班
export const TW_AIRPORTS = new Set(['TPE', 'TSA', 'KHH', 'RMQ', 'TNN', 'CYI', 'HUN', 'TTT', 'MZG', 'KNH', 'LZN', 'MFK', 'GNI', 'KYD', 'CMJ', 'WOT', 'HCN', 'PIF']);
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * TDX 定期航班表（GeneralSchedule International＋Domestic）→ 班號 → 接下來 DAYS_AHEAD 天實際有排班的星期（"1246"，1＝週一…7＝週日）。
 * 一天一天看：那天落在某筆班表的有效期間、而且那筆的星期有勾，才算那天有飛（換季前後的班表不會互相蓋過）。
 */
export const DAYS_AHEAD = 7;   // 一週：每個星期幾剛好對到一個實際日期（14 天會把下個月的班表混進來）
export function scheduleDays(schedules, today = new Date().toISOString().slice(0, 10)) {
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => new Date(Date.parse(today) + i * 86400e3));
  const days = new Map(), routes = new Map();
  for (const s of schedules || []) {
    const air = String(s.AirlineID || '').toUpperCase().trim();
    let num = String(s.FlightNumber || '').toUpperCase().trim();
    if (num.startsWith(air)) num = num.slice(air.length);
    if (!air || !num) continue;
    const flight = air + num.replace(/^0+(?=\d)/, '');
    const start = String(s.ScheduleStartDate || '0000').slice(0, 10), end = String(s.ScheduleEndDate || '9999').slice(0, 10);
    const set = days.get(flight) || new Set();
    for (const d of dates) {
      const iso = d.toISOString().slice(0, 10), wd = (d.getUTCDay() + 6) % 7;   // 0＝週一
      if (iso >= start && iso <= end && (s[WEEK[wd]] === true || s[WEEK[wd]] === 'true')) set.add(wd + 1);
    }
    days.set(flight, set);
    const dep = String(s.DepartureAirportID || '').toUpperCase(), arr = String(s.ArrivalAirportID || '').toUpperCase();
    if (dep && arr && !routes.has(flight)) routes.set(flight, `${dep}-${arr}`);
  }
  return { days: new Map([...days].map(([k, v]) => [k, [...v].sort().join('')])), routes };
}

export function buildRoutesIndex({ routesCsv, airlinesCsv, airportsCsv, schedules = null, today, generated = new Date().toISOString().slice(0, 10) }) {
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
  // TDX 班表：台灣的班號加第三欄「飛的星期」；經過台灣卻不在班表的標 "-"（近期沒排班）；班表有、VRS 沒有的補進去
  let withDays = 0, noSchedule = 0, added = 0;
  if (schedules) {
    const { days, routes } = scheduleDays(schedules, today || generated);
    const flights = new Set(out.map((l) => l.split('\t')[0]));
    for (const [f, r] of routes) if (!flights.has(f)) { out.push(`${f}\t${r}`); added++; }
    for (let i = 0; i < out.length; i++) {
      const [f, route] = out[i].split('\t');
      const d = days.get(f);
      if (d) { out[i] += `\t${d}`; withDays++; }
      else if (route.split('-').some((a) => TW_AIRPORTS.has(a))) { out[i] += '\t-'; noSchedule++; }
    }
  }
  out.sort();
  const airlines = [...usedAirlines].sort().map((c) => `A\t${c}\t${icaoToIata.get(c) || ''}\t${(airlineName.get(c) || '').replace(/\t/g, ' ')}`);
  const text = [`#flights-routes v1 ${generated}${schedules ? ' tdx' : ''}`, ...airlines, ...out.map((l) => 'R\t' + l)].join('\n') + '\n';
  return { text, stats: { raw, kept: out.length, iata: iataCount, airlines: airlines.length, ...(schedules ? { withDays, noSchedule, added } : {}) } };
}

