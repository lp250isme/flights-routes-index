// 索引：VRS 呼號 → IATA 班號、機場 ICAO → IATA、去重、多段；TDX 班表標星期
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoutesIndex, csvRow, scheduleDays } from '../lib.mjs';

const routesCsv = '\uFEFFCallsign,Code,Number,AirlineCode,AirportCodes\n' +
  'EVA71,EVA,71,EVA,RCTP-EDDM\nEVA71,EVA,71,EVA,RCTP-EDDM\nJNA578,JNA,578,JNA,RCTP-RKPK\n' +
  'XYZ12,XYZ,12,XYZ,RCTP-ZZZZ\nCAL5,CAL,5,CAL,RCTP-PANC-KJFK\nBAD,BAD,,BAD,RCTP\nAFR1,AFR,1,AFR,LFPG-KJFK\n';
const airlinesCsv = 'Code,Name,ICAO,IATA,PositioningFlightPattern,CharterFlightPattern\n' +
  'EVA,EVA Air,EVA,BR,,\nJNA,Jin Air,JNA,LJ,,\nCAL,"China Airlines, Ltd",CAL,CI,,\nXYZ,Nowhere Air,XYZ,,,\nAFR,Air France,AFR,AF,,\n';
const airportsCsv = '"id","ident","type","name","icao_code","iata_code","gps_code"\n' +
  '1,"RCTP","l","Taoyuan","RCTP","TPE","RCTP"\n2,"EDDM","l","Munich","EDDM","MUC","EDDM"\n3,"RKPK","l","Gimhae","RKPK","PUS","RKPK"\n' +
  '4,"PANC","l","Anchorage","PANC","ANC","PANC"\n5,"KJFK","l","JFK","KJFK","JFK","KJFK"\n6,"LFPG","l","CDG","LFPG","CDG","LFPG"\n';
const R = (text) => text.trim().split('\n').filter((l) => l.startsWith('R\t')).map((l) => l.slice(2));

test('建索引：ICAO 呼號轉 IATA 班號、機場轉 IATA、去重、多段照順序', () => {
  const { text, stats } = buildRoutesIndex({ routesCsv, airlinesCsv, airportsCsv, generated: '2026-11-26' });
  assert.equal(text.split('\n')[0], '#flights-routes v1 2026-11-26');
  assert.deepEqual(R(text), ['AF1\tCDG-JFK', 'BR71\tTPE-MUC', 'CI5\tTPE-ANC-JFK', 'LJ578\tTPE-PUS', 'XYZ12\tTPE-ZZZZ']);
  assert.ok(text.includes('A\tCAL\tCI\tChina Airlines, Ltd'));
  assert.deepEqual(stats, { raw: 7, kept: 5, iata: 4, airlines: 5 });
});

test('TDX 班表：只看接下來 7 天每天實際有沒有排班；換季兩筆不互相蓋過；班號去前綴與前導 0', () => {
  // 2026-11-26 是週四。這個月一、四；12/1 起天天飛。7 天＝11/26（四）～12/2（三）：四、一來自 11 月，二、三來自 12 月
  const rows = [
    { AirlineID: 'AE', FlightNumber: 'AE1261', ScheduleStartDate: '2026-11-01', ScheduleEndDate: '2026-11-30', Monday: true, Thursday: true },
    { AirlineID: 'AE', FlightNumber: '1261', ScheduleStartDate: '2026-12-01', ScheduleEndDate: '2027-03-27', Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: true, Sunday: true },
    { AirlineID: 'BR', FlightNumber: '0071', ScheduleStartDate: '2026-10-25', ScheduleEndDate: '2027-03-27', Monday: true, Thursday: true },
    { AirlineID: 'BR', FlightNumber: '99', ScheduleStartDate: '2026-01-01', ScheduleEndDate: '2026-03-01', Monday: true },   // 已過期
    { AirlineID: 'CI', FlightNumber: '5', ScheduleStartDate: '2027-01-01', ScheduleEndDate: '2027-03-01', Monday: true },     // 7 天後才開始
  ];
  const { days } = scheduleDays(rows, '2026-11-26');
  assert.equal(days.get('AE1261'), '1234');
  assert.equal(days.get('BR71'), '14');
  assert.equal(days.get('BR99'), '');
  assert.equal(days.get('CI5'), '');
  const { days: late } = scheduleDays(rows.slice(0, 1), '2026-11-26');
  assert.equal(late.get('AE1261'), '14', '只有這個月那筆：週一、四');
});

test('合併班表：台灣班號加星期、經過台灣但沒排班標 -、外站不動、班表有 VRS 沒有的補上', () => {
  const schedules = [
    { AirlineID: 'BR', FlightNumber: '71', ScheduleStartDate: '2026-10-25', ScheduleEndDate: '2027-03-27', DepartureAirportID: 'TPE', ArrivalAirportID: 'MUC', Tuesday: true, Saturday: true },
    { AirlineID: 'IT', FlightNumber: '200', ScheduleStartDate: '2026-10-25', ScheduleEndDate: '2027-03-27', DepartureAirportID: 'TPE', ArrivalAirportID: 'NRT', Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: true, Sunday: true },
    { AirlineID: 'CI', FlightNumber: '5', ScheduleStartDate: '2026-01-01', ScheduleEndDate: '2026-02-01', Monday: true },   // 班表有、但已過期：當成沒排班
  ];
  const { text, stats } = buildRoutesIndex({ routesCsv, airlinesCsv, airportsCsv, schedules, today: '2026-11-26', generated: '2026-11-26' });
  assert.equal(text.split('\n')[0], '#flights-routes v1 2026-11-26 tdx');
  assert.deepEqual(R(text), ['AF1\tCDG-JFK', 'BR71\tTPE-MUC\t26', 'CI5\tTPE-ANC-JFK\t-', 'IT200\tTPE-NRT\t1234567', 'LJ578\tTPE-PUS\t-', 'XYZ12\tTPE-ZZZZ\t-']);
  assert.deepEqual({ withDays: stats.withDays, noSchedule: stats.noSchedule, added: stats.added }, { withDays: 2, noSchedule: 3, added: 1 });
});

test('CSV：引號內的逗號、雙引號跳脫', () => {
  assert.deepEqual(csvRow('a,"b, c","d ""e"""'), ['a', 'b, c', 'd "e"']);
});
