// Engineer — Stage 1 UI: left menu with material categories (desktop),
// bottom bar with category buttons (phones), fullscreen sandbox,
// rendering, input. Bare globals, classic script. Canvas is
// SIM_W x SIM_H cells, drawn through an ImageData buffer so a full frame
// is one putImageData call.

const CELL = 4; // px per cell in the backing store (480x270 -> 1920x1080)
const canvas = document.getElementById("sim");
const ctx = canvas.getContext("2d");
canvas.width = SIM_W * CELL;
canvas.height = SIM_H * CELL;

const img = ctx.createImageData(SIM_W, SIM_H);
const viewCanvas = document.createElement("canvas");
viewCanvas.width = SIM_W;
viewCanvas.height = SIM_H;
const viewCtx = viewCanvas.getContext("2d");

const canvasWrap = document.getElementById("canvasWrap");

let selectedMat = 2;      // Steel
let tool = "paint";       // paint | heat | cool | ignite | erase
let brushSize = 8;
let viewMode = "normal";  // normal | heat | pressure
let zoomed = false;
let mouseDown = false;
let mouseX = 0, mouseY = 0;

// --- Fit the sandbox to the whole screen -----------------------------------
// Largest box that fits the canvas area, keeping the grid's aspect;
// zoom doubles it (the area scrolls).
function fitCanvas() {
  const r = canvasWrap.getBoundingClientRect();
  const pad = 8;
  const w = Math.max(50, r.width - pad * 2);
  const h = Math.max(50, r.height - pad * 2);
  const scale = Math.min(w / SIM_W, h / SIM_H) * (zoomed ? 2 : 1);
  canvas.style.width = Math.floor(SIM_W * scale) + "px";
  canvas.style.height = Math.floor(SIM_H * scale) + "px";
}
window.addEventListener("resize", fitCanvas);

// --- Rendering -------------------------------------------------------------
function tempColor(t) {
  // Blue (cold) -> black -> red -> orange -> white (hot).
  if (t < 20) {
    const f = Math.max(0, Math.min(1, (20 - t) / 200));
    return [Math.round(20 + 60 * f), Math.round(40 + 80 * f), 200];
  }
  if (t < 300) {
    const f = (t - 20) / 280;
    return [Math.round(30 + 120 * f), 20, Math.round(40 - 20 * f)];
  }
  if (t < 900) {
    const f = (t - 300) / 600;
    return [200, Math.round(20 + 90 * f), 0];
  }
  const f = Math.min(1, (t - 900) / 800);
  return [255, Math.round(140 + 115 * f), Math.round(40 + 215 * f)];
}

function pressureColor(p) {
  // Ambient = dark; high pressure = bright white-blue.
  const f = Math.max(0, Math.min(1, p / 40));
  return [Math.round(20 + 235 * f), Math.round(24 + 200 * f), Math.round(32 + 223 * f)];
}

function render() {
  const d = img.data;
  for (let i = 0; i < SIM_W * SIM_H; i++) {
    const m = MATERIALS[sim.mat[i]];
    let r, g, b;
    if (viewMode === "heat") {
      [r, g, b] = tempColor(sim.temp[i]);
    } else if (viewMode === "pressure") {
      [r, g, b] = pressureColor(sim.press[i]);
    } else {
      [r, g, b] = m.color;
      // Hot solids glow.
      if (sim.temp[i] > 400 && m.cat !== "gas") {
        const glow = Math.min(1, (sim.temp[i] - 400) / 800);
        r = Math.round(r + (255 - r) * glow * 0.8);
        g = Math.round(g + (120 - g) * glow * 0.5);
      }
      // Fire flickers.
      if (sim.mat[i] === 16) {
        const f = 0.75 + Math.random() * 0.5;
        r = Math.min(255, Math.round(r * f));
        g = Math.min(255, Math.round(g * f));
      }
    }
    const o = i * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  viewCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(viewCanvas, 0, 0, canvas.width, canvas.height);
}

// --- Input -----------------------------------------------------------------
function canvasCell(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * SIM_W);
  const y = Math.floor((e.clientY - r.top) / r.height * SIM_H);
  return [x, y];
}

function applyTool(cx, cy) {
  const r = brushSize;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!sIn(x, y)) continue;
      if (Math.hypot(x - cx, y - cy) > r + 0.5) continue;
      const i = sIdx(x, y);
      if (tool === "paint") {
        if (sim.mat[i] === 1) continue; // don't paint over Wall
        sSet(x, y, selectedMat);
      } else if (tool === "erase") {
        if (sim.mat[i] !== 1) sSet(x, y, 0);
      } else if (tool === "heat") {
        sim.temp[i] += 60;
      } else if (tool === "cool") {
        sim.temp[i] = Math.max(-50, sim.temp[i] - 60);
      } else if (tool === "ignite") {
        sIgnite(x, y);
      }
    }
  }
}

canvas.addEventListener("pointerdown", (e) => {
  mouseDown = true;
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = canvasCell(e);
  mouseX = x; mouseY = y;
  applyTool(x, y);
});
canvas.addEventListener("pointermove", (e) => {
  const [x, y] = canvasCell(e);
  mouseX = x; mouseY = y;
  if (mouseDown) applyTool(x, y);
  updateReadout();
});
canvas.addEventListener("pointerup", () => { mouseDown = false; });
canvas.addEventListener("pointerleave", () => { mouseDown = false; });

// --- Shared selection --------------------------------------------------------
function selectMaterial(m) {
  selectedMat = m.id;
  tool = "paint";
  document.querySelectorAll(".swatch").forEach((el) =>
    el.classList.toggle("selected", el.dataset.mat === String(m.id)));
  setToolButton();
  markSelectedCategory();
}

function makeSwatch(name) {
  const m = MAT[name];
  const b = document.createElement("button");
  b.className = "swatch" + (m.id === selectedMat ? " selected" : "");
  b.dataset.mat = m.id;
  b.style.setProperty("--c", `rgb(${m.color[0]},${m.color[1]},${m.color[2]})`);
  b.textContent = name;
  b.title = `${name} — melt ${m.meltPoint ?? "—"}°C, pressure tol ${m.pressureTol ?? "—"}`;
  b.onclick = () => { selectMaterial(m); hideMobileMats(); };
  return b;
}

// --- Left menu: material categories (desktop) --------------------------------
// One category open at a time. Click toggles; on desktop, hovering a
// category with a real mouse opens it too.
const catsEl = document.getElementById("categories");
let openCat = null;

function openCategory(catEl) {
  document.querySelectorAll("#categories .cat.open").forEach((el) => {
    if (el !== catEl) el.classList.remove("open");
  });
  catEl.classList.add("open");
  openCat = catEl;
}

CATEGORIES.forEach((cat, ci) => {
  const wrap = document.createElement("div");
  wrap.className = "cat";
  const btn = document.createElement("button");
  btn.className = "cat-btn";
  btn.textContent = cat.name;
  btn.onclick = () => {
    if (wrap.classList.contains("open")) wrap.classList.remove("open");
    else openCategory(wrap);
  };
  // Hovering with a real mouse opens the category; touch taps are left
  // to the click toggle (a tap fires pointerenter with type "touch",
  // and opening there would fight the toggle).
  btn.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") openCategory(wrap);
  });
  const items = document.createElement("div");
  items.className = "cat-items";
  cat.items.forEach((name) => items.appendChild(makeSwatch(name)));
  wrap.appendChild(btn);
  wrap.appendChild(items);
  catsEl.appendChild(wrap);
  if (ci === 0) openCategory(wrap); // Solids open by default
});

// --- Bottom bar: category buttons (phones) -----------------------------------
// No menu button, no drawer: the four categories are buttons, bottom
// left. Tapping one pops its materials up in a strip above; tapping a
// material picks it and the strip closes.
const mobileMats = document.getElementById("mobileMats");
const mobileCatsRow = document.getElementById("mobileCatsRow");
let openMobileCat = null;

function hideMobileMats() {
  mobileMats.classList.remove("show");
  document.querySelectorAll("#mobileCatsRow .cat-btn").forEach((b) => b.classList.remove("open"));
  openMobileCat = null;
  fitCanvas();
}

function markSelectedCategory() {
  const cat = CATEGORIES.find((c) => c.items.some((n) => MAT[n].id === selectedMat));
  document.querySelectorAll("#mobileCatsRow .cat-btn").forEach((b) => {
    b.classList.toggle("selected", cat && b.textContent === cat.name);
  });
}

CATEGORIES.forEach((cat) => {
  const btn = document.createElement("button");
  btn.className = "cat-btn";
  btn.textContent = cat.name;
  btn.onclick = () => {
    if (openMobileCat === cat.name) { hideMobileMats(); return; }
    mobileMats.innerHTML = "";
    cat.items.forEach((name) => mobileMats.appendChild(makeSwatch(name)));
    mobileMats.classList.add("show");
    document.querySelectorAll("#mobileCatsRow .cat-btn").forEach((b) =>
      b.classList.toggle("open", b === btn));
    openMobileCat = cat.name;
    fitCanvas();
  };
  mobileCatsRow.appendChild(btn);
});

// Brush stepper: − / + buttons right next to the categories, thumb-sized.
const minusBtn = document.createElement("button");
minusBtn.className = "brush-step";
minusBtn.textContent = "−";
const brushValMobile = document.createElement("span");
brushValMobile.id = "mobileBrushVal";
brushValMobile.textContent = brushSize;
const plusBtn = document.createElement("button");
plusBtn.className = "brush-step";
plusBtn.textContent = "+";
function setBrush(v) {
  brushSize = Math.max(1, Math.min(24, v));
  document.getElementById("brushVal").textContent = brushSize;
  brushValMobile.textContent = brushSize;
  const slider = document.getElementById("brush");
  if (slider) slider.value = brushSize;
}
minusBtn.onclick = () => setBrush(brushSize - 2);
plusBtn.onclick = () => setBrush(brushSize + 2);
mobileCatsRow.appendChild(minusBtn);
mobileCatsRow.appendChild(brushValMobile);
mobileCatsRow.appendChild(plusBtn);

// --- Tools, views, actions (both layouts share data attributes) --------------
function setToolButton() {
  document.querySelectorAll("[data-tool]").forEach((el) => {
    el.classList.toggle("selected", el.dataset.tool === tool);
  });
}
document.querySelectorAll("[data-tool]").forEach((el) => {
  el.onclick = () => { tool = el.dataset.tool; setToolButton(); };
});
document.querySelectorAll("[data-view]").forEach((el) => {
  el.onclick = () => {
    viewMode = el.dataset.view;
    document.querySelectorAll("[data-view]").forEach((v) =>
      v.classList.toggle("selected", v === el));
  };
});
document.getElementById("brush").oninput = (e) => setBrush(parseInt(e.target.value, 10));
document.querySelectorAll(".pause-btn").forEach((el) => {
  el.onclick = () => {
    sim.running = !sim.running;
    document.querySelectorAll(".pause-btn").forEach((b) =>
      b.textContent = sim.running ? "Pause" : "Play");
  };
});
document.getElementById("zoomBtn").onclick = (e) => {
  zoomed = !zoomed;
  e.target.textContent = zoomed ? "Zoom 1x" : "Zoom 2x";
  fitCanvas();
};
document.querySelectorAll(".clear-btn").forEach((el) => {
  el.onclick = () => sClear();
});
document.querySelectorAll(".furnace-btn, #furnaceBtn").forEach((el) => {
  el.onclick = () => { sPresetFurnace(); hideMobileMats(); };
});

function updateReadout() {
  if (!sIn(mouseX, mouseY)) return;
  const i = sIdx(mouseX, mouseY);
  const m = MATERIALS[sim.mat[i]];
  const text = `${m.name} — ${Math.round(sim.temp[i])}°C, pressure ${sim.press[i].toFixed(1)}`;
  document.getElementById("readout").textContent = text;
  document.getElementById("mobileReadout").textContent = text;
}

// --- Main loop ---------------------------------------------------------------
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(100, now - last);
  last = now;
  if (sim.running) {
    acc += dt;
    let n = 0;
    while (acc >= 33 && n < 3) { sStep(); acc -= 33; n++; }
    if (n === 3) acc = 0; // drop backlog rather than spiral
  }
  render();
  requestAnimationFrame(frame);
}

sClear();
setToolButton();
markSelectedCategory();
fitCanvas();
requestAnimationFrame(frame);
