// node build.mjs routes-index.tsv.gz
// Downloads VRS routes + airlines (CC0) and OurAirports (public domain), writes a compact gzip TSV.
import { gunzipSync, gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { buildRoutesIndex } from './lib.mjs';

const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
const routesGz = await get('https://vrs-standing-data.adsb.lol/routes.csv.gz');
const airlines = await get('https://raw.githubusercontent.com/vradarserver/standing-data/main/airlines/schema-01/airlines.csv');
const airports = await get('https://davidmegginson.github.io/ourairports-data/airports.csv');
// TDX 定期航班表（要 TDX_CLIENT_ID／TDX_CLIENT_SECRET；沒設或失敗就不標星期，照舊出索引）
async function tdxSchedules() {
  const id = process.env.TDX_CLIENT_ID, secret = process.env.TDX_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const t = await fetch('https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
    }).then((r) => r.json());
    const all = [];
    for (const k of ['International', 'Domestic']) {
      const r = await fetch(`https://tdx.transportdata.tw/api/basic/v2/Air/GeneralSchedule/${k}?$format=JSON`, { headers: { authorization: `Bearer ${t.access_token}` } });
      if (!r.ok) throw new Error(`TDX ${k} ${r.status}`);
      const list = await r.json();
      console.error(`TDX ${k}: ${list.length} rows; sample ${JSON.stringify(list[0])}`);
      all.push(...list);
    }
    return all.length > 100 ? all : null;
  } catch (e) { console.error('TDX schedule skipped:', e.message); return null; }
}
const schedules = await tdxSchedules();
const { text, stats } = buildRoutesIndex({ routesCsv: gunzipSync(routesGz).toString('utf8'), airlinesCsv: airlines.toString('utf8'), airportsCsv: airports.toString('utf8'), schedules });
if (stats.kept < 100000) throw new Error(`too few routes (${stats.kept}), not uploading`);   // 來源壞掉時別蓋掉好的那份
const gz = gzipSync(Buffer.from(text), { level: 9 });
const out = process.argv[2] || 'routes-index.tsv.gz';
writeFileSync(out, gz);
console.log(JSON.stringify({ ...stats, textBytes: Buffer.byteLength(text), gzBytes: gz.length, out }));
