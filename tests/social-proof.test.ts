import { describe, expect, it } from "vitest";
import {
  buildNotificationPool,
  FEMALE_NAMES,
  WEIGHTED_CITIES,
  shuffle,
} from "../src/lib/social-proof";

const products = ["Espresso Abaya", "Pearl Hijab", "Rose Kaftan", "Ivory Shawl", "Sand Dupatta"];
const names = new Set<string>(FEMALE_NAMES);
const cities = new Set(WEIGHTED_CITIES.map((city) => city.name));
const productSet = new Set(products);

describe("social proof notification pool", () => {
  it("produces 100 entries for a non-empty product list", () => {
    expect(buildNotificationPool(products).length).toBe(100);
  });

  it("returns an empty pool when there are no product names", () => {
    expect(buildNotificationPool([])).toEqual([]);
  });

  it("draws every entry from the name, city, and product sources", () => {
    for (const entry of buildNotificationPool(products)) {
      expect(names.has(entry.name)).toBe(true);
      expect(cities.has(entry.city)).toBe(true);
      expect(productSet.has(entry.product)).toBe(true);
    }
  });

  it("includes the heaviest cities across a full pool", () => {
    const seenCities = new Set(buildNotificationPool(products).map((entry) => entry.city));
    expect(seenCities.has("Lahore")).toBe(true);
    expect(seenCities.has("Karachi")).toBe(true);
  });

  it("cycles the whole pool before repeating an entry", () => {
    const pool = buildNotificationPool(products);
    const keys = pool.map((entry) => `${entry.name}|${entry.city}|${entry.product}`);
    expect(new Set(keys).size).toBe(pool.length);
  });

  it("shuffle returns a permutation without mutating the input", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});
