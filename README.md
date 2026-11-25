# flights-routes-index

[English](#english) | [繁體中文](#繁體中文)

## English

A daily job that turns [VRS standing-data](https://github.com/vradarserver/standing-data) routes (CC0) into a small flight-number index: `BR71 → TPE-MUC`.

- Callsigns are converted to IATA flight numbers with the VRS airline table; airports are converted from ICAO to IATA with [OurAirports](https://ourairports.com/data/) (public domain). Unknown codes stay as ICAO; multi-leg routes keep their order.
- Output: gzip TSV. Line 1 is `#flights-routes v1 <date>`, `A` lines are airlines (`ICAO IATA Name`), `R` lines are routes (`flight route`).
- Runs every day at 19:20 UTC and uploads to Cloudflare R2. Needs the secret `CLOUDFLARE_API_TOKEN` and the variable `CLOUDFLARE_ACCOUNT_ID`.
- Optional: with `TDX_CLIENT_ID` / `TDX_CLIENT_SECRET`, flights to or from Taiwan get a third column with the weekdays they fly (`1246` = Mon, Tue, Thu, Sat) from the TDX scheduled-flights table. A flight that touches a Taiwan airport but is not in the table gets `-`.
- The routes are hints only. They can be out of date.

Run locally: `node build.mjs out.tsv.gz` (Node 20+).

Data: VRS standing-data, CC0 1.0. OurAirports, public domain. Weekdays: TDX (Ministry of Transportation and Communications, Taiwan), Open Government Data License v1.0.

## 繁體中文

每天把 [VRS standing-data](https://github.com/vradarserver/standing-data) 的航線（CC0）轉成精簡的航班號索引，例如 `BR71 → TPE-MUC`。

- 呼號用 VRS 的航空公司表轉成 IATA 班號；機場用 [OurAirports](https://ourairports.com/data/)（公有領域）從 ICAO 轉成 IATA。轉不到的保留 ICAO，多段航線保留順序。
- 輸出是 gzip 的 TSV：第一行 `#flights-routes v1 <日期>`，`A` 行是航空公司（`ICAO IATA 名稱`），`R` 行是航班（`班號 航線`）。
- 每天 UTC 19:20（台灣 03:20）跑，上傳到 Cloudflare R2。需要 secret `CLOUDFLARE_API_TOKEN` 和變數 `CLOUDFLARE_ACCOUNT_ID`。
- 選用：設了 `TDX_CLIENT_ID`／`TDX_CLIENT_SECRET`，台灣出發或抵達的班號會多一欄飛的星期（`1246`＝週一、二、四、六），來自 TDX 定期航班表。經過台灣機場卻不在班表上的標 `-`。
- 航線只是提示，可能不是最新的。

本機執行：`node build.mjs out.tsv.gz`（Node 20 以上）。

資料：VRS standing-data（CC0 1.0）、OurAirports（公有領域）。星期：交通部 TDX，政府資料開放授權條款第 1 版。
