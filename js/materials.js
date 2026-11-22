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

  // --- New metals (Sam's list, 2026-11-22) ---
  // id 19 — Iron
  { name: "Iron", color: [128, 132, 140], cat: "solid", density: 7.9,
    conductivity: 0.8, meltPoint: 1538, meltTo: 20, pressureTol: 100 },
  // id 20 — Molten Iron
  { name: "Molten Iron", color: [255, 120, 30], cat: "liquid", density: 7.0,
    conductivity: 0.6, freezePoint: 1500, freezeTo: 19 },
  // id 21 — Tungsten (highest melting point of the metals)
  { name: "Tungsten", color: [168, 170, 175], cat: "solid", density: 19.3,
    conductivity: 1.7, meltPoint: 3422, meltTo: 22, pressureTol: 150 },
  // id 22 — Molten Tungsten
  { name: "Molten Tungsten", color: [255, 200, 120], cat: "liquid", density: 17.6,
    conductivity: 1.2, freezePoint: 3400, freezeTo: 21 },
  // id 23 — Gold (best conductor, melts cool)
  { name: "Gold", color: [220, 170, 40], cat: "solid", density: 19.3,
    conductivity: 3.1, meltPoint: 1064, meltTo: 24, pressureTol: 60 },
  // id 24 — Molten Gold
  { name: "Molten Gold", color: [255, 180, 60], cat: "liquid", density: 17.3,
    conductivity: 2.5, freezePoint: 1050, freezeTo: 23 },
  // id 25 — Titanium (light, strong, poor heat conductor)
  { name: "Titanium", color: [150, 150, 160], cat: "solid", density: 4.5,
    conductivity: 0.2, meltPoint: 1668, meltTo: 26, pressureTol: 110 },
  // id 26 — Molten Titanium
  { name: "Molten Titanium", color: [255, 150, 80], cat: "liquid", density: 4.1,
    conductivity: 0.15, freezePoint: 1650, freezeTo: 25 },
  // id 27 — Bronze
  { name: "Bronze", color: [205, 127, 50], cat: "solid", density: 8.8,
    conductivity: 0.6, meltPoint: 950, meltTo: 28, pressureTol: 70 },
  // id 28 — Molten Bronze
  { name: "Molten Bronze", color: [255, 140, 50], cat: "liquid", density: 8.0,
    conductivity: 0.5, freezePoint: 930, freezeTo: 27 },
  // id 29 — Cobalt
  { name: "Cobalt", color: [90, 110, 160], cat: "solid", density: 8.9,
    conductivity: 1.0, meltPoint: 1495, meltTo: 30, pressureTol: 100 },
  // id 30 — Molten Cobalt
  { name: "Molten Cobalt", color: [120, 140, 255], cat: "liquid", density: 8.0,
    conductivity: 0.8, freezePoint: 1480, freezeTo: 29 },
  // id 31 — Quartz (melts to glass, shatters to debris)
  { name: "Quartz", color: [170, 215, 205], cat: "solid", density: 2.65,
    conductivity: 0.05, meltPoint: 1713, meltTo: 9, pressureTol: 50,
    breakTo: 7 },
  // id 32 — Glass (melts to molten glass, shatters)
  { name: "Glass", color: [180, 200, 210], cat: "solid", density: 2.5,
    conductivity: 0.05, meltPoint: 1500, meltTo: 9, pressureTol: 30,
    breakTo: 7 },
  // id 33 — Insulation (barely conducts heat, crumbles under pressure)
  { name: "Insulation", color: [240, 200, 140], cat: "solid", density: 0.2,
    conductivity: 0.01, meltPoint: 9999, pressureTol: 10, breakTo: 7 },
  // id 34 — Graphite (thermally conductive, never melts — sublimes)
  { name: "Graphite", color: [70, 70, 75], cat: "solid", density: 2.2,
    conductivity: 1.5, meltPoint: 3650, pressureTol: 40, breakTo: 7 },
  // id 35 — Titanium Carbide (ultra-hard ceramic)
  { name: "Titanium Carbide", color: [120, 120, 130], cat: "solid", density: 4.9,
    conductivity: 0.3, meltPoint: 3160, pressureTol: 200 },
  // id 36 — Tungsten Carbide (ultra-hard, ultra-dense)
  { name: "Tungsten Carbide", color: [100, 100, 110], cat: "solid", density: 15.6,
    conductivity: 1.1, meltPoint: 2870, pressureTol: 220 },

  // --- Radioactive powders: they heat themselves (selfHeat °C per tick) ---
  // id 37 — Plutonium
  { name: "Plutonium", color: [120, 170, 70], cat: "powder", density: 19.8,
    conductivity: 0.1, selfHeat: 0.8 },
  // id 38 — Uranium
  { name: "Uranium", color: [60, 140, 60], cat: "powder", density: 19.1,
    conductivity: 0.1, selfHeat: 0.5 },
  // id 39 — Polonium (the hottest of the three)
  { name: "Polonium", color: [200, 120, 200], cat: "powder", density: 9.2,
    conductivity: 0.1, selfHeat: 1.5 },

  // id 40 — Deuterium (heavy hydrogen gas, flammable)
  { name: "Deuterium", color: [150, 200, 255], cat: "gas", density: 0.02,
    conductivity: 0.1, igniteTemp: 500, burnTo: 16 },

  // --- Cryo liquids: they boil at far-below-zero temperatures ---
  // id 41 — Liquid Nitrogen (boils at -196°C)
  { name: "Liquid Nitrogen", color: [180, 220, 255], cat: "liquid", density: 0.8,
    conductivity: 0.2, boilPoint: -196, boilTo: 42 },
  // id 42 — Nitrogen gas (condenses back below -196°C)
  { name: "Nitrogen", color: [160, 180, 220], cat: "gas", density: 0.03,
    conductivity: 0.05, condensePoint: -196, condenseTo: 41 },
  // id 43 — Liquid Oxygen (boils at -183°C)
  { name: "Liquid Oxygen", color: [120, 180, 255], cat: "liquid", density: 1.1,
    conductivity: 0.2, boilPoint: -183, boilTo: 44 },
  // id 44 — Oxygen gas (condenses back below -183°C)
  { name: "Oxygen", color: [140, 190, 255], cat: "gas", density: 0.04,
    conductivity: 0.05, condensePoint: -183, condenseTo: 43 },
  // id 45 — Liquid Helium (boils at -269°C, the coldest liquid)
  { name: "Liquid Helium", color: [220, 230, 255], cat: "liquid", density: 0.1,
    conductivity: 0.1, boilPoint: -269, boilTo: 46 },
  // id 46 — Helium gas (lightest gas here — rises fastest)
  { name: "Helium", color: [200, 210, 240], cat: "gas", density: 0.01,
    conductivity: 0.05, condensePoint: -269, condenseTo: 45 },

  // --- Fuels and gases ---
  // id 47 — Methane (flammable gas)
  { name: "Methane", color: [200, 200, 150], cat: "gas", density: 0.02,
    conductivity: 0.1, igniteTemp: 600, burnTo: 16 },
  // id 48 — Diesel (flammable liquid)
  { name: "Diesel", color: [150, 110, 40], cat: "liquid", density: 0.85,
    conductivity: 0.1, igniteTemp: 210, burnTo: 16 },
  // id 49 — Gas (flammable gas)
  { name: "Gas", color: [210, 210, 120], cat: "gas", density: 0.05,
    conductivity: 0.2, igniteTemp: 150, burnTo: 16 },
  // id 50 — Toxic Gas (heavy green gas)
  { name: "Toxic Gas", color: [80, 160, 60], cat: "gas", density: 0.06,
    conductivity: 0.05 },
];

// Lookup helpers.
const MAT = {};
MATERIALS.forEach((m, i) => { m.id = i; MAT[m.name] = m; });

// Which materials the palette offers for painting (not the transient ones).
// Grouped into categories for the sidebar: tap a category to see its
// materials in the strip below.
const CATEGORIES = [
  { name: "Solids", items: ["Wall", "Steel", "Copper", "Iron", "Tungsten", "Gold", "Titanium", "Bronze", "Cobalt", "Ceramic", "Quartz", "Glass", "Insulation", "Graphite", "Titanium Carbide", "Tungsten Carbide", "Wood", "Ice"] },
  { name: "Powders", items: ["Sand", "Debris", "Ash", "Gunpowder", "Plutonium", "Uranium", "Polonium"] },
  { name: "Liquids", items: ["Water", "Fuel", "Diesel", "Molten Steel", "Molten Copper", "Molten Glass", "Molten Iron", "Molten Tungsten", "Molten Gold", "Molten Titanium", "Molten Bronze", "Molten Cobalt", "Liquid Nitrogen", "Liquid Oxygen", "Liquid Helium"] },
  { name: "Gases", items: ["Fire", "Smoke", "Steam", "Methane", "Gas", "Deuterium", "Nitrogen", "Oxygen", "Helium", "Toxic Gas"] },
];
const PAINTABLE = CATEGORIES.flatMap((c) => c.items);
