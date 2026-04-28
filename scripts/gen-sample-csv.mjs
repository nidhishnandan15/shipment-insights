import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CITIES = [
  "Delhi",
  "Mumbai",
  "Bangalore",
  "Chennai",
  "Kolkata",
  "Hyderabad",
  "Pune",
  "Ahmedabad",
];
const CARRIERS = ["FedEx", "UPS", "DHL", "BlueDart"];

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(items, rng) {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);
const today = new Date("2026-04-28");

const rows = [];
for (let i = 1; i <= 120; i++) {
  const origin = pick(CITIES, rng);
  let dest = pick(CITIES, rng);
  while (dest === origin) dest = pick(CITIES, rng);

  const daysAgo = Math.floor(rng() * 90);
  const shipDate = new Date(today);
  shipDate.setDate(shipDate.getDate() - daysAgo);

  const status = pickWeighted(
    [
      ["Delivered", 70],
      ["Delayed", 18],
      ["In Transit", 10],
      ["Lost", 2],
    ],
    rng
  );

  let delayDays = 0;
  let deliverDate = "";
  if (status === "Delivered") {
    const transit = 1 + Math.floor(rng() * 5);
    const d = new Date(shipDate);
    d.setDate(d.getDate() + transit);
    deliverDate = d.toISOString().slice(0, 10);
  } else if (status === "Delayed") {
    delayDays = 1 + Math.floor(rng() * 10);
    const transit = 3 + Math.floor(rng() * 5) + delayDays;
    const d = new Date(shipDate);
    d.setDate(d.getDate() + transit);
    if (d <= today) deliverDate = d.toISOString().slice(0, 10);
  } else if (status === "In Transit") {
    deliverDate = "";
  } else {
    deliverDate = "";
    delayDays = 0;
  }

  rows.push({
    shipment_id: `SH-${String(i).padStart(4, "0")}`,
    origin_city: origin,
    destination_city: dest,
    carrier: pick(CARRIERS, rng),
    ship_date: shipDate.toISOString().slice(0, 10),
    deliver_date: deliverDate,
    status,
    delay_days: delayDays,
    weight_kg: (rng() * 499 + 1).toFixed(1),
    route_id: `${origin.slice(0, 3).toUpperCase()}-${dest.slice(0, 3).toUpperCase()}`,
  });
}

const headers = Object.keys(rows[0]);
const csv =
  headers.join(",") +
  "\n" +
  rows.map((r) => headers.map((h) => r[h]).join(",")).join("\n") +
  "\n";

const outPath = resolve("public", "sample-shipments.csv");
writeFileSync(outPath, csv);
console.log(`Wrote ${rows.length} rows to ${outPath}`);
