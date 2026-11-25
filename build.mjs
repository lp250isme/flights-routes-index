// node build.mjs routes-index.tsv.gz
// Downloads VRS routes + airlines (CC0) and OurAirports (public domain), writes a compact gzip TSV.
import { gunzipSync, gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { buildRoutesIndex } from './lib.mjs';

const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
const routesGz = await get('https://vrs-standing-data.adsb.lol/routes.csv.gz');
const airlines = await get('https://raw.githubusercontent.com/vradarserver/standing-data/main/airlines/schema-01/airlines.csv');
const airports = await get('https://davidmegginson.github.io/ourairports-data/airports.csv');
const { text, stats } = buildRoutesIndex({ routesCsv: gunzipSync(routesGz).toString('utf8'), airlinesCsv: airlines.toString('utf8'), airportsCsv: airports.toString('utf8') });
if (stats.kept < 100000) throw new Error(`too few routes (${stats.kept}), not uploading`);   // 來源壞掉時別蓋掉好的那份
const gz = gzipSync(Buffer.from(text), { level: 9 });
const out = process.argv[2] || 'routes-index.tsv.gz';
writeFileSync(out, gz);
console.log(JSON.stringify({ ...stats, textBytes: Buffer.byteLength(text), gzBytes: gz.length, out }));
