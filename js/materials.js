// Engineer — material definitions (Stage 1).
// Every material carries the properties the sim needs:
//   heat tolerance (meltPoint), pressure tolerance (pressureTol),
//   thermal conductivity, density (drives falling / buoyancy),
//   and what it turns into when it melts, burns, or breaks.
//
// Temperatures are in Celsius. Pressure is in the sim's own units
// (ambient air = 0; a gunpowder blast is ~+30 at the core).
// Strength is modelled as pressure tolerance: exceed it and a
// brittle material shatters, a tough one holds.

const MATERIALS = [
  // id 0 — Air (the background gas; "empty" cells are air)
  { name: "Air", color: [16, 18, 24], cat: "gas", density: 0.1,
    conductivity: 0.05 },

  // id 1 — Wall (static, indestructible test material)
  { name: "Wall", color: [120, 124, 132], cat: "static", density: 99,
    conductivity: 0.3, meltPoint: 9999 },

  // id 2 — Steel (strong, melts hot)
  { name: "Steel", color: [138, 143, 152], cat: "solid", density: 7.8,
    conductivity: 0.5, meltPoint: 1500, meltTo: 3, pressureTol: 120 },

  // id 3 — Molten Steel (liquid)
  { name: "Molten Steel", color: [255, 140, 40], cat: "liquid", density: 7.0,
    conductivity: 0.4, freezePoint: 1400, freezeTo: 2 },

  // id 4 — Copper (very conductive, melts cooler than steel)
  { name: "Copper", color: [184, 115, 51], cat: "solid", density: 8.9,
    conductivity: 0.9, meltPoint: 1085, meltTo: 5, pressureTol: 80 },

  // id 5 — Molten Copper (liquid)
  { name: "Molten Copper", color: [255, 110, 30], cat: "liquid", density: 8.0,
    conductivity: 0.7, freezePoint: 1000, freezeTo: 4 },

  // id 6 — Ceramic (very heat resistant, but brittle: shatters under pressure)
  { name: "Ceramic", color: [232, 224, 208], cat: "solid", density: 3.9,
    conductivity: 0.08, meltPoint: 2200, pressureTol: 40, breakTo: 7 },

  // id 7 — Debris (ceramic shards, powder)
  { name: "Debris", color: [201, 189, 168], cat: "powder", density: 3.0,
    conductivity: 0.08, meltPoint: 2200 },

  // id 8 — Sand (powder, melts to glass)
  { name: "Sand", color: [224, 192, 128], cat: "powder", density: 1.6,
    conductivity: 0.05, meltPoint: 1700, meltTo: 9 },

  // id 9 — Molten Glass (liquid)
  { name: "Molten Glass", color: [255, 176, 96], cat: "liquid", density: 2.2,
    conductivity: 0.1, freezePoint: 1400, freezeTo: 8 },

  // id 10 — Water (liquid, boils to steam)
  { name: "Water", color: [58, 111, 216], cat: "liquid", density: 1.0,
    conductivity: 0.3, boilPoint: 100, boilTo: 11 },

  // id 11 — Steam (gas, condenses back to water)
  { name: "Steam", color: [207, 216, 232], cat: "gas", density: 0.05,
    conductivity: 0.05, condensePoint: 95, condenseTo: 10 },

  // id 12 — Fuel (flammable liquid)
  { name: "Fuel", color: [216, 160, 32], cat: "liquid", density: 0.8,
    conductivity: 0.1, igniteTemp: 200, burnTo: 16 },

  // id 13 — Wood (flammable solid)
  { name: "Wood", color: [122, 74, 33], cat: "solid", density: 0.7,
    conductivity: 0.15, igniteTemp: 300, burnTo: 16, pressureTol: 25,
    breakTo: 14 },

  // id 14 — Ash (powder left after wood burns)
  { name: "Ash", color: [136, 136, 136], cat: "powder", density: 0.6,
    conductivity: 0.05, meltPoint: 9999 },

  // id 15 — Ice (melts at 0)
  { name: "Ice", color: [168, 216, 240], cat: "solid", density: 0.9,
    conductivity: 0.2, meltPoint: 0, meltTo: 10 },

  // id 16 — Fire (hot gas, short-lived, heats everything around it)
  { name: "Fire", color: [255, 106, 0], cat: "gas", density: 0.05,
    conductivity: 0.05, life: 25 },

  // id 17 — Smoke (cool gas, rises and fades)
  { name: "Smoke", color: [102, 102, 102], cat: "gas", density: 0.04,
    conductivity: 0.05, life: 120 },

  // id 18 — Gunpowder (explosive powder; the pressure demo)
  { name: "Gunpowder", color: [58, 58, 58], cat: "powder", density: 1.2,
    conductivity: 0.05, igniteTemp: 250, explosive: true },
];

// Lookup helpers.
const MAT = {};
MATERIALS.forEach((m, i) => { m.id = i; MAT[m.name] = m; });

// Which materials the palette offers for painting (not the transient ones).
// Grouped into categories for the left menu: click or hover a category
// to see its materials.
const CATEGORIES = [
  { name: "Solids", items: ["Wall", "Steel", "Copper", "Ceramic", "Wood", "Ice"] },
  { name: "Powders", items: ["Sand", "Debris", "Ash", "Gunpowder"] },
  { name: "Liquids", items: ["Water", "Fuel", "Molten Steel", "Molten Copper", "Molten Glass"] },
  { name: "Gases", items: ["Fire", "Smoke", "Steam"] },
];
const PAINTABLE = CATEGORIES.flatMap((c) => c.items);
