// Simulated social proof: the purchase notifications are generated client-side
// from real published product names plus a fixed list of plausible Pakistani
// shopper names and cities. There is no real order behind any card. When real
// recent-order data becomes available, swap buildNotificationPool for a function
// that reads actual orders instead of synthesising them here.

export type PurchaseNotification = { name: string; city: string; product: string };

// Pakistani female first names (extensible).
export const FEMALE_NAMES = [
  "Sarah", "Ayesha", "Fatima", "Zainab", "Hira", "Mahnoor", "Iqra", "Maryam",
  "Sana", "Amna", "Noor", "Areeba", "Rabia", "Komal", "Mehwish", "Laiba",
  "Anam", "Kiran", "Nimra", "Saba", "Aiman", "Bisma", "Dua", "Eman",
  "Farah", "Hania", "Javeria", "Kashish", "Minahil", "Rida",
] as const;

// Weighted city list: Lahore & Karachi heaviest, then Islamabad & Rawalpindi,
// then the remaining cities lighter.
export const WEIGHTED_CITIES: ReadonlyArray<{ name: string; weight: number }> = [
  { name: "Lahore", weight: 10 },
  { name: "Karachi", weight: 10 },
  { name: "Islamabad", weight: 6 },
  { name: "Rawalpindi", weight: 6 },
  { name: "Faisalabad", weight: 3 },
  { name: "Multan", weight: 3 },
  { name: "Peshawar", weight: 3 },
  { name: "Sialkot", weight: 2 },
  { name: "Gujranwala", weight: 2 },
  { name: "Hyderabad", weight: 2 },
  { name: "Quetta", weight: 2 },
  { name: "Bahawalpur", weight: 1 },
  { name: "Sargodha", weight: 1 },
  { name: "Abbottabad", weight: 1 },
];

// Timing constants (milliseconds).
export const FIRST_DELAY_MIN_MS = 20_000;
export const FIRST_DELAY_MAX_MS = 30_000;
export const INTERVAL_MIN_MS = 240_000;
export const INTERVAL_MAX_MS = 330_000;
export const VISIBLE_MS = 7_000;

/** Inclusive random integer between min and max. */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Fisher-Yates shuffle returning a new array (does not mutate the input). */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const TOTAL_CITY_WEIGHT = WEIGHTED_CITIES.reduce((sum, city) => sum + city.weight, 0);

function pickWeightedCity(): string {
  let roll = Math.random() * TOTAL_CITY_WEIGHT;
  for (const city of WEIGHTED_CITIES) {
    roll -= city.weight;
    if (roll < 0) return city.name;
  }
  return WEIGHTED_CITIES[WEIGHTED_CITIES.length - 1].name;
}

/**
 * Build a pool of unique simulated purchase notifications from real product
 * names. Returns an empty pool when there are no product names. Entries are
 * de-duplicated so the widget can cycle the whole pool before any repeat.
 */
export function buildNotificationPool(productNames: string[], count = 100): PurchaseNotification[] {
  if (productNames.length === 0) return [];
  const pool: PurchaseNotification[] = [];
  const seen = new Set<string>();
  const maxCombos = FEMALE_NAMES.length * WEIGHTED_CITIES.length * productNames.length;
  const target = Math.min(count, maxCombos);
  let guard = 0;
  const guardLimit = target * 50 + 1000;
  while (pool.length < target && guard < guardLimit) {
    guard += 1;
    const name = FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)];
    const city = pickWeightedCity();
    const product = productNames[Math.floor(Math.random() * productNames.length)];
    const key = `${name}|${city}|${product}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ name, city, product });
  }
  return pool;
}
