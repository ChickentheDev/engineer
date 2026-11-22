// Engineer — material definitions (Stages 1–2).
// Every material carries the properties the sim needs:
//   heat tolerance (meltPoint), pressure tolerance (pressureTol),
//   thermal conductivity, density (drives falling / buoyancy),
//   and what it turns into when it melts, burns, or breaks.
//
// Temperatures are in Celsius. Pressure is in the sim's own units
// (ambient air = 0; a gunpowder blast is ~+30 at the core).
// Strength is modelled as pressure tolerance: exceed it and a
// brittle material shatters, a tough one holds.
// Gas densities are inflated ~10–80x vs real (g/cm3) for playability
// — only their relative order matters.
// Molten materials freeze ~10 °C below their melt point — deliberate
// hysteresis so pools don't flicker solid/liquid; real freeze = melt.

const MATERIALS = [
  // id 0 — Air (the background gas; "empty" cells are air)
  { name: "Air", color: [16, 18, 24], cat: "gas", density: 0.1,
    conductivity: 0.05 },

  // id 1 — Wall (static, indestructible test material) // melt 9999 is deliberate gameplay, not a real material.
  { name: "Wall", color: [120, 124, 132], cat: "static", density: 99,
    conductivity: 0.3, meltPoint: 9999 },

  // id 2 — Steel (strong, melts hot)
  { name: "Steel", color: [138, 143, 152], cat: "solid", density: 7.8,
    conductivity: 0.48, meltPoint: 1500, meltTo: 3, pressureTol: 120 },

  // id 3 — Molten Steel (liquid)
  { name: "Molten Steel", color: [255, 140, 40], cat: "liquid", density: 7.0,
    conductivity: 0.41, freezePoint: 1480, freezeTo: 2 },

  // id 4 — Copper (very conductive, melts cooler than steel)
  { name: "Copper", color: [184, 115, 51], cat: "solid", density: 8.9,
    conductivity: 0.9, meltPoint: 1085, meltTo: 5, pressureTol: 55 },

  // id 5 — Molten Copper (liquid)
  { name: "Molten Copper", color: [255, 110, 30], cat: "liquid", density: 8.0,
    conductivity: 0.7, freezePoint: 1070, freezeTo: 4 },

  // id 6 — Ceramic (very heat resistant, but brittle: shatters under pressure)
  { name: "Ceramic", color: [232, 224, 208], cat: "solid", density: 3.9,
    conductivity: 0.41, meltPoint: 2050, pressureTol: 65, breakTo: 7 },

  // id 7 — Debris (ceramic shards, powder)
  { name: "Debris", color: [201, 189, 168], cat: "powder", density: 3.0,
    conductivity: 0.41, meltPoint: 2050 },

  // id 8 — Sand (powder, melts to glass)
  { name: "Sand", color: [224, 192, 128], cat: "powder", density: 1.6,
    conductivity: 0.10, meltPoint: 1713, meltTo: 9 },

  // id 9 — Molten Glass (liquid)
  { name: "Molten Glass", color: [255, 176, 96], cat: "liquid", density: 2.2,
    conductivity: 0.15, freezePoint: 1400, freezeTo: 32 },

  // id 10 — Water (liquid, boils to steam)
  { name: "Water", color: [58, 111, 216], cat: "liquid", density: 1.0,
    conductivity: 0.13, boilPoint: 100, boilTo: 11 },

  // id 11 — Steam (gas, condenses back to water)
  { name: "Steam", color: [207, 216, 232], cat: "gas", density: 0.015,
    conductivity: 0.05, condensePoint: 100, condenseTo: 10 },

  // id 12 — Fuel (flammable liquid)
  { name: "Fuel", color: [216, 160, 32], cat: "liquid", density: 0.75,
    conductivity: 0.08, igniteTemp: 260, burnTo: 16 },

  // id 13 — Wood (flammable solid)
  { name: "Wood", color: [122, 74, 33], cat: "solid", density: 0.6,
    conductivity: 0.08, igniteTemp: 300, burnTo: 16, pressureTol: 25,
    breakTo: 14 },

  // id 14 — Ash (powder left after wood burns)
  { name: "Ash", color: [136, 136, 136], cat: "powder", density: 0.6,
    conductivity: 0.065, meltPoint: 1200 },

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
    conductivity: 0.07, igniteTemp: 300, explosive: true },

  // --- New metals (Sam's list, 2026-11-22) ---
  // id 19 — Iron
  { name: "Iron", color: [128, 132, 140], cat: "solid", density: 7.9,
    conductivity: 0.56, meltPoint: 1538, meltTo: 20, pressureTol: 90 },
  // id 20 — Molten Iron
  { name: "Molten Iron", color: [255, 120, 30], cat: "liquid", density: 7.0,
    conductivity: 0.43, freezePoint: 1520, freezeTo: 19 },
  // id 21 — Tungsten (highest melting point of the metals)
  { name: "Tungsten", color: [168, 170, 175], cat: "solid", density: 19.3,
    conductivity: 0.70, meltPoint: 3422, meltTo: 22, pressureTol: 150 },
  // id 22 — Molten Tungsten
  { name: "Molten Tungsten", color: [255, 200, 120], cat: "liquid", density: 17.6,
    conductivity: 0.60, freezePoint: 3410, freezeTo: 21 },
  // id 23 — Gold (melts cool; NOT the best conductor — copper and silver beat it)
  { name: "Gold", color: [220, 170, 40], cat: "solid", density: 19.3,
    conductivity: 0.84, meltPoint: 1064, meltTo: 24, pressureTol: 30 },
  // id 24 — Molten Gold
  { name: "Molten Gold", color: [255, 180, 60], cat: "liquid", density: 17.3,
    conductivity: 0.67, freezePoint: 1055, freezeTo: 23 },
  // id 25 — Titanium (light, strong, poor heat conductor) // Ti-6Al-4V alloy: pressureTol ~200 (pure Ti would be ~90)
  { name: "Titanium", color: [150, 150, 160], cat: "solid", density: 4.5,
    conductivity: 0.38, meltPoint: 1668, meltTo: 26, pressureTol: 200 },
  // id 26 — Molten Titanium
  { name: "Molten Titanium", color: [255, 150, 80], cat: "liquid", density: 4.1,
    conductivity: 0.37, freezePoint: 1660, freezeTo: 25 },
  // id 27 — Bronze
  { name: "Bronze", color: [205, 127, 50], cat: "solid", density: 8.8,
    conductivity: 0.50, meltPoint: 950, meltTo: 28, pressureTol: 75 },
  // id 28 — Molten Bronze
  { name: "Molten Bronze", color: [255, 140, 50], cat: "liquid", density: 8.0,
    conductivity: 0.48, freezePoint: 940, freezeTo: 27 },
  // id 29 — Cobalt
  { name: "Cobalt", color: [90, 110, 160], cat: "solid", density: 8.9,
    conductivity: 0.60, meltPoint: 1495, meltTo: 30, pressureTol: 120 },
  // id 30 — Molten Cobalt
  { name: "Molten Cobalt", color: [120, 140, 255], cat: "liquid", density: 8.0,
    conductivity: 0.53, freezePoint: 1490, freezeTo: 29 },
  // id 31 — Quartz (melts to glass, shatters to debris)
  { name: "Quartz", color: [170, 215, 205], cat: "solid", density: 2.65,
    conductivity: 0.20, meltPoint: 1713, meltTo: 9, pressureTol: 50,
    breakTo: 7 },
  // id 32 — Glass (melts to molten glass, shatters)
  { name: "Glass", color: [180, 200, 210], cat: "solid", density: 2.5,
    conductivity: 0.15, meltPoint: 1500, meltTo: 9, pressureTol: 30,
    breakTo: 7 },
  // id 33 — Insulation (barely conducts heat, crumbles under pressure) // melt 9999 is deliberate: real PU foam decomposes ~200–300 °C, glass wool melts ~1300–1450 °C; kept indestructible for gameplay.
  { name: "Insulation", color: [240, 200, 140], cat: "solid", density: 0.05,
    conductivity: 0.045, meltPoint: 9999, pressureTol: 10, breakTo: 7 },
  // id 34 — Graphite (sublimes ~3642 °C at 1 atm, no liquid phase; 3650 is a gameplay stand-in, no meltTo by design)
  { name: "Graphite", color: [70, 70, 75], cat: "solid", density: 2.2,
    conductivity: 0.69, meltPoint: 3650, pressureTol: 20, breakTo: 7 },
  // id 35 — Titanium Carbide (ultra-hard ceramic)
  { name: "Titanium Carbide", color: [120, 120, 130], cat: "solid", density: 4.9,
    conductivity: 0.38, meltPoint: 3160, pressureTol: 150 },
  // id 36 — Tungsten Carbide (ultra-hard, ultra-dense)
  { name: "Tungsten Carbide", color: [100, 100, 110], cat: "solid", density: 15.6,
    conductivity: 0.58, meltPoint: 2870, pressureTol: 180 },

  // --- Radioactive powders: they heat themselves (selfHeat °C per tick) ---
  // Real half-lives are far too long to watch (U-238: 4.5 billion years),
  // so game decay is compressed ~1000x: a pile visibly transmutes over
  // minutes. decayP is the per-tick chance a cell decays into decayTo.
// selfHeat is likewise compressed ~1,000,000x vs real decay heat
// (Po-210 140 W/g, Pu-238 0.56 W/g, U-238 ~0.00001 W/g) — order is
// real, magnitudes are gameplay. Radiation emission is a separate
// field (radEmission), decoupled from selfHeat in Stage E so the
// real uranium selfHeat (0.05) doesn't dim its radiation.
  // id 37 — Plutonium // selfHeat is a Pu-238 value; Pu-239 would be ~0.01 — isotope unspecified, see research §4.5
  { name: "Plutonium", color: [120, 170, 70], cat: "powder", density: 19.8,
    conductivity: 0.27, selfHeat: 0.8, decayTo: 38, decayP: 1 / 60000 , meltPoint: 640, meltTo: 65, radEmission: 0.8 },
  // id 38 — Uranium
  { name: "Uranium", color: [60, 140, 60], cat: "powder", density: 19.1,
    conductivity: 0.40, selfHeat: 0.05, decayTo: 39, decayP: 1 / 60000 , meltPoint: 1132, meltTo: 66, radEmission: 0.5 },
  // id 39 — Polonium (the hottest of the three)
  { name: "Polonium", color: [200, 120, 200], cat: "powder", density: 9.2,
    conductivity: 0.37, selfHeat: 3.0, decayTo: 58, decayP: 1 / 15000 , meltPoint: 254, meltTo: 64, radEmission: 1.5 },

  // id 40 — Deuterium (heavy hydrogen gas, flammable)
  { name: "Deuterium", color: [150, 200, 255], cat: "gas", density: 0.02,
    conductivity: 0.09, igniteTemp: 500, burnTo: 16 },

  // --- Cryo liquids: they boil at far-below-zero temperatures ---
  // id 41 — Liquid Nitrogen (boils at -196°C)
  { name: "Liquid Nitrogen", color: [180, 220, 255], cat: "liquid", density: 0.8,
    conductivity: 0.08, boilPoint: -196, boilTo: 42 },
  // id 42 — Nitrogen gas (condenses back below -196°C)
  { name: "Nitrogen", color: [160, 180, 220], cat: "gas", density: 0.03,
    conductivity: 0.05, condensePoint: -196, condenseTo: 41 },
  // id 43 — Liquid Oxygen (boils at -183°C)
  { name: "Liquid Oxygen", color: [120, 180, 255], cat: "liquid", density: 1.14,
    conductivity: 0.08, boilPoint: -183, boilTo: 44 },
  // id 44 — Oxygen gas (condenses back below -183°C)
  { name: "Oxygen", color: [140, 190, 255], cat: "gas", density: 0.04,
    conductivity: 0.05, condensePoint: -183, condenseTo: 43 },
  // id 45 — Liquid Helium (boils at -269°C, the coldest liquid)
  { name: "Liquid Helium", color: [220, 230, 255], cat: "liquid", density: 0.125,
    conductivity: 0.045, boilPoint: -269, boilTo: 46 },
  // id 46 — Helium gas (lightest gas here — rises fastest)
  { name: "Helium", color: [200, 210, 240], cat: "gas", density: 0.01,
    conductivity: 0.085, condensePoint: -269, condenseTo: 45 },

  // --- Fuels and gases ---
  // id 47 — Methane (flammable gas)
  { name: "Methane", color: [200, 200, 150], cat: "gas", density: 0.02,
    conductivity: 0.05, igniteTemp: 537, burnTo: 16 },
  // id 48 — Diesel (flammable liquid)
  { name: "Diesel", color: [150, 110, 40], cat: "liquid", density: 0.85,
    conductivity: 0.08, igniteTemp: 210, burnTo: 16 },
  // id 49 — Gas (flammable gas) // Gas = propane (LPG)
  { name: "Gas", color: [210, 210, 120], cat: "gas", density: 0.05,
    conductivity: 0.045, igniteTemp: 470, burnTo: 16 },
  // id 50 — Toxic Gas (heavy green gas)
  { name: "Toxic Gas", color: [80, 160, 60], cat: "gas", density: 0.06,
    conductivity: 0.05 },

  // --- Stage 2 — engines: combustion, airflow, nozzles ---
  // id 51 — Exhaust (hot combustion product; cools into smoke)
  { name: "Exhaust", color: [90, 80, 75], cat: "gas", density: 0.08,
    conductivity: 0.1, life: 200, lifeTo: 17 },
  // id 52 — Wind (air in motion; flows in the global wind direction,
  // which the UI button cycles; fades after a while)
  { name: "Wind", color: [220, 235, 255], cat: "gas", density: 0.005,
    conductivity: 0.05, life: 200 },
  // id 53 — Nozzle (heat-proof engine block for chambers and nozzles)
  { name: "Nozzle", color: [200, 160, 90], cat: "solid", density: 8,
    conductivity: 0.5, meltPoint: 3000, pressureTol: 300 },
  // id 54 — Vac (vacuum block: eats adjacent gas, pulls pressure down —
  // a vacuum sucks loose material toward it)
  { name: "Vac", color: [50, 60, 90], cat: "solid", density: 8,
    conductivity: 0.5, meltPoint: 3000, pressureTol: 300 },

  // --- Overnight: radiation particles + shielding ---
  // id 55 — Neutron (from radioactive decay; fast, heats what it passes,
  // beta-decays into a proton + an electron)
  { name: "Neutron", color: [140, 255, 140], cat: "gas", density: 0.001,
    conductivity: 0.05, life: 120 },
  // id 56 — Proton (from neutron decay; fast, short-lived)
  { name: "Proton", color: [255, 140, 140], cat: "gas", density: 0.001,
    conductivity: 0.05, life: 40 },
  // id 57 — Electron (from neutron decay; fast, short-lived)
  { name: "Electron", color: [140, 140, 255], cat: "gas", density: 0.001,
    conductivity: 0.05, life: 40 },
  // id 58 — Lead (dense — the best radiation shield in the game;
  // melts at 327°C, real value)
  { name: "Lead", color: [90, 90, 100], cat: "solid", density: 11.3,
    conductivity: 0.35, meltPoint: 327, meltTo: 59, pressureTol: 60 },
  // id 59 — Molten Lead
  { name: "Molten Lead", color: [200, 140, 90], cat: "liquid", density: 10.7,
    conductivity: 0.3, freezePoint: 317, freezeTo: 58 },

  // --- Stage B — rocket propellants ---
  // id 60 — RP-1 (rocket-grade kerosene; O/F ~2.6 with liquid oxygen)
  { name: "RP-1", color: [190, 160, 80], cat: "liquid", density: 0.81,
    conductivity: 0.08, igniteTemp: 210, burnTo: 16 },
  // id 61 — Liquid Hydrogen (boils at -253°C; O/F ~6 with LOX,
  // highest exhaust velocity of any chemical propellant)
  { name: "Liquid Hydrogen", color: [170, 200, 255], cat: "liquid", density: 0.07,
    conductivity: 0.07, boilPoint: -253, boilTo: 62 },
  // id 62 — Hydrogen gas (lightest gas in the game; best gas conductor)
  { name: "Hydrogen", color: [150, 190, 255], cat: "gas", density: 0.005,
    conductivity: 0.09, condensePoint: -253, condenseTo: 61,
    igniteTemp: 500, burnTo: 16 },

  // --- Stage C — moving parts ---
  // id 63 — Bearing (pivot for rotors: solids touching it bind into a
  // wheel that spins on pressure / liquid weight; Sam's BRNG)
  { name: "Bearing", color: [120, 120, 140], cat: "solid", density: 4,
    conductivity: 0.5, meltPoint: 3000, pressureTol: 300 },
  // --- Stage E — molten radioactives (real-world tolerances) ---
  // id 64 — Molten Polonium (melts at 254°C — it stays hot: selfHeat 3.0)
  { name: "Molten Polonium", color: [255, 120, 200], cat: "liquid", density: 8.3,
    conductivity: 0.32, freezePoint: 244, freezeTo: 39, selfHeat: 3.0, radEmission: 1.5 },
  // id 65 — Molten Plutonium
  { name: "Molten Plutonium", color: [200, 255, 100], cat: "liquid", density: 17.8,
    conductivity: 0.24, freezePoint: 630, freezeTo: 37, selfHeat: 0.8, radEmission: 0.8 },
  // id 66 — Molten Uranium
  { name: "Molten Uranium", color: [140, 255, 80], cat: "liquid", density: 17.2,
    conductivity: 0.34, freezePoint: 1122, freezeTo: 38, selfHeat: 0.05, radEmission: 0.5 },
];

// Precomputed per-material lookups so the hot loops don't do object
// property reads or string compares per cell.
const MAT_DENSITY = new Float32Array(MATERIALS.map((m) => m.density));
const MAT_COND = new Float32Array(MATERIALS.map((m) => m.conductivity));
const MAT_IS_GAS = new Uint8Array(MATERIALS.map((m) => (m.cat === "gas" ? 1 : 0)));

// Lookup helpers.
const MAT = {};
MATERIALS.forEach((m, i) => { m.id = i; MAT[m.name] = m; });

// Which materials the palette offers for painting (not the transient ones).
// Grouped into categories for the sidebar: tap a category to see its
// materials in the strip below.
const CATEGORIES = [
  { name: "Solids", items: ["Wall", "Steel", "Copper", "Iron", "Tungsten", "Gold", "Titanium", "Bronze", "Cobalt", "Ceramic", "Quartz", "Glass", "Insulation", "Graphite", "Titanium Carbide", "Tungsten Carbide", "Lead", "Wood", "Ice"] },
  { name: "Powders", items: ["Sand", "Debris", "Ash", "Gunpowder", "Plutonium", "Uranium", "Polonium"] },
  { name: "Liquids", items: ["Water", "Fuel", "Diesel", "RP-1", "Molten Steel", "Molten Copper", "Molten Glass", "Molten Iron", "Molten Tungsten", "Molten Gold", "Molten Titanium", "Molten Bronze", "Molten Cobalt", "Molten Lead", "Molten Polonium", "Molten Plutonium", "Molten Uranium", "Liquid Nitrogen", "Liquid Oxygen", "Liquid Helium", "Liquid Hydrogen"] },
  { name: "Gases", items: ["Fire", "Smoke", "Steam", "Exhaust", "Wind", "Methane", "Gas", "Deuterium", "Nitrogen", "Oxygen", "Helium", "Hydrogen", "Toxic Gas"] },
  { name: "Devices", items: ["Nozzle", "Vac", "Bearing"] },
];
const PAINTABLE = CATEGORIES.flatMap((c) => c.items);
