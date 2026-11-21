# Engineer

A voxel sandbox game about engines — rocket engines, turbofans, and the
materials they are built from. Powder Toy-style cellular simulation, with
real heat and pressure fields and materials that melt, burn, or shatter
when you push them past their tolerances.

Play it in the browser: open `Index.html` (or GitHub Pages once enabled).
No build step, no dependencies — plain canvas + JavaScript.

## Stage 1 (done)

- Grid sim: 200×120 cells, powders fall, liquids flow, gases rise
- Heat: conduction between neighbours, ambient cooling, hot materials glow
- Pressure: a diffusing pressure field; combustion and explosions raise it
- Materials with heat tolerance, pressure tolerance, conductivity, density:
  Wall, Steel, Molten Steel, Copper, Molten Copper, Ceramic, Debris, Sand,
  Molten Glass, Water, Steam, Fuel, Wood, Ash, Ice, Fire, Smoke, Gunpowder
- Tools: paint, heat, cool, ignite, erase; brush size; Normal / Temperature /
  Pressure views; pause; clear; "Furnace test" preset

## Next stages

- **Stage 2 — engines:** combustion chambers, nozzles, thrust, airflow
- **Stage 3 — moving parts:** bearings, locked pivots, rotating assemblies
  (a fan shape with a locked centre spins when airflow hits it)
