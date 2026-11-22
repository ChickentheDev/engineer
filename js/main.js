// Engineer — Stage 1 UI + Stage 2 (engines: wind, devices), powder-ui
// transplant (Sam's redesign).
// Right icon sidebar, bottom material strip with left/right select,
// bottom icon bar (clear, furnace, brush, wind direction, rect, line,
// pause), top bar (view, ambient heat, grid), FPS + cursor readout.
// The sim itself is untouched (js/sim.js, js/materials.js) —
// same 800x450 grid, same phase changes, now 55 materials.
// Bare globals, classic script.

const CELL = 2; // px per cell in the backing store (800x450 -> 1600x900)
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
canvas.width = SIM_W * CELL;
canvas.height = SIM_H * CELL;
const ov = document.getElementById("ov");
const octx = ov.getContext("2d");
ov.width = SIM_W; ov.height = SIM_H;
const stage = document.getElementById("stage");
const box = document.getElementById("canvasBox");
const gridEl = document.getElementById("grid");
const fpsEl = document.getElementById("fps");
const infoEl = document.getElementById("info");

const img = ctx.createImageData(SIM_W, SIM_H);
const viewCanvas = document.createElement("canvas");
viewCanvas.width = SIM_W;
viewCanvas.height = SIM_H;
const viewCtx = viewCanvas.getContext("2d");

const S = (p) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

let leftMat = 2, rightMat = 10;   // Steel, Water
let tool = "paint";               // paint | heat | cool | ignite | erase
let shape = "brush";              // brush | rect | line
const BR = [1, 2, 3, 5, 8, 12, 16, 24]; // brush radii; button shows diameter
let bi = 5;                       // radius 12 (diameter 25, the old default)
let viewMode = "normal";          // normal | heat | pressure
let ambient = true;               // heat drifts back to ambient
let gridOn = false;
let down = false, btn = 0, mx = -1, my = -1, ax = 0, ay = 0, lx = 0, ly = 0;
let parts = 0;

// --- Fit the sandbox to the stage, keeping the grid's aspect -------------
function fitCanvas() {
  const r = stage.getBoundingClientRect();
  const scale = Math.min(r.width / SIM_W, r.height / SIM_H);
  const w = Math.max(50, Math.floor(SIM_W * scale));
  const h = Math.max(50, Math.floor(SIM_H * scale));
  box.style.width = w + "px"; box.style.height = h + "px";
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  ov.style.width = w + "px"; ov.style.height = h + "px";
  gridEl.style.backgroundSize = (w / SIM_W) + "px " + (h / SIM_H) + "px";
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
  parts = 0;
  for (let i = 0; i < SIM_W * SIM_H; i++) {
    const mid = sim.mat[i];
    if (mid !== 0) parts++;
    const m = MATERIALS[mid];
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
      if (mid === 16) {
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

// --- Painting --------------------------------------------------------------
// One cell's worth of the current tool. Paint only fills empty space
// (air) or transient gas (fire, smoke, steam) — it never eats something
// you already built; use Erase to clear a material first.
function applyCell(x, y, matId) {
  if (!sIn(x, y)) return;
  const i = sIdx(x, y);
  if (tool === "paint") {
    const cur = sim.mat[i];
    if (cur !== 0 && cur !== 11 && cur !== 16 && cur !== 17 && cur !== 51 && cur !== 52) return;
    sSet(x, y, matId);
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

function applyBrush(cx, cy, matId) {
  const r = BR[bi];
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) > r + 0.5) continue;
      applyCell(x, y, matId);
    }
  }
}

function strokeBrush(x0, y0, x1, y1, matId) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let k = 0; k <= n; k++) {
    applyBrush(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), matId);
  }
}

// Rect / line tools: preview on the overlay canvas while dragging,
// commit on release.
function preview() {
  octx.clearRect(0, 0, SIM_W, SIM_H);
  octx.strokeStyle = "#fff"; octx.lineWidth = 1; octx.beginPath();
  if (shape === "rect") {
    octx.rect(Math.min(ax, mx) + .5, Math.min(ay, my) + .5, Math.abs(mx - ax), Math.abs(my - ay));
  } else {
    octx.moveTo(ax + .5, ay + .5); octx.lineTo(mx + .5, my + .5);
  }
  octx.stroke();
}

function commitShape(matId) {
  if (shape === "line") { strokeBrush(ax, ay, mx, my, matId); return; }
  const x0 = Math.max(0, Math.min(ax, mx)), x1 = Math.min(SIM_W - 1, Math.max(ax, mx));
  const y0 = Math.max(0, Math.min(ay, my)), y1 = Math.min(SIM_H - 1, Math.max(ay, my));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) applyCell(x, y, matId);
  }
}

function canvasCell(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / r.width * SIM_W);
  const y = Math.floor((e.clientY - r.top) / r.height * SIM_H);
  return [x, y];
}

function updateInfo() {
  if (!sIn(mx, my)) { infoEl.innerHTML = "&nbsp;"; return; }
  const i = sIdx(mx, my);
  const m = MATERIALS[sim.mat[i]];
  infoEl.innerHTML = `${m.name}, Temp: ${sim.temp[i].toFixed(0)}°C, Pressure: ${sim.press[i].toFixed(1)}<br>#${i}, X:${mx} Y:${my}`;
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  down = true;
  btn = e.button === 2 ? rightMat : leftMat;
  canvas.setPointerCapture(e.pointerId);
  [mx, my] = canvasCell(e);
  ax = lx = mx; ay = ly = my;
  if (shape === "brush") applyBrush(mx, my, btn);
  updateInfo();
});
canvas.addEventListener("pointermove", (e) => {
  const [x, y] = canvasCell(e);
  mx = x; my = y;
  if (!down) { updateInfo(); return; }
  if (shape === "brush") { strokeBrush(lx, ly, x, y, btn); lx = x; ly = y; }
  else preview();
  updateInfo();
});
addEventListener("pointerup", () => {
  if (!down) return;
  down = false;
  if (shape !== "brush") { commitShape(btn); octx.clearRect(0, 0, SIM_W, SIM_H); }
});
canvas.addEventListener("pointerleave", () => { if (!down) { mx = -1; my = -1; } });

// --- Sidebar + material strip ----------------------------------------------
const ICONS = {
  Solids: '<rect x="5" y="5" width="14" height="14"/>',
  Powders: '<path d="M3 20c4 0 5-9 9-9s5 9 9 9z"/>',
  Liquids: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>',
  Gases: '<path d="M5 19c0-3 3-3 3-6s-3-3-3-6M12 19c0-3 3-3 3-6s-3-3-3-6M19 19c0-3-3-3-3-6s3-3 3-6"/>',
  Tools: '<path d="M14 4a4 4 0 0 0-4 5L4 15v4h4l6-6a4 4 0 0 0 5-4l-3 2-2-2z"/>',
  Devices: '<path d="M4 4h16l-6 7v6l-4 2v-8z"/>',
};
const TOOLS = ["Heat", "Cool", "Ignite", "Erase"];
const SIDEBAR_CATS = [...CATEGORIES.map((c) => c.name), "Tools"];
const stripEl = document.getElementById("strip");
const g2el = document.getElementById("g2");
let cat = 0; // Solids

// Red border = left material, blue border = right material.
function mark() {
  document.querySelectorAll("#strip .el[data-i]").forEach((d) => {
    const i = +d.dataset.i;
    d.classList.toggle("L", i === leftMat);
    d.classList.toggle("R", i === rightMat);
  });
  document.querySelectorAll("#strip .el.tool").forEach((d) => {
    d.classList.toggle("on", d.dataset.tool === tool);
  });
}

function strip() {
  stripEl.innerHTML = "";
  stripEl.scrollLeft = 0;
  const name = SIDEBAR_CATS[cat];
  if (name === "Tools") {
    TOOLS.forEach((t) => {
      const d = document.createElement("div");
      d.className = "el tool";
      d.textContent = t;
      d.dataset.tool = t.toLowerCase();
      d.onclick = () => { tool = t.toLowerCase(); mark(); };
      stripEl.appendChild(d);
    });
  } else {
    const c = CATEGORIES.find((x) => x.name === name);
    c.items.forEach((nm) => {
      const m = MAT[nm];
      const d = document.createElement("div");
      d.className = "el";
      d.textContent = m.name;
      d.dataset.i = m.id;
      d.style.background = `rgb(${m.color[0]},${m.color[1]},${m.color[2]})`;
      const lum = 0.299 * m.color[0] + 0.587 * m.color[1] + 0.114 * m.color[2];
      if (lum > 150) d.style.color = "#000";
      d.title = `${m.name} — melt ${m.meltPoint ?? "—"}°C, pressure tol ${m.pressureTol ?? "—"}`;
      // Click = left material (+ paint mode). Long-press (450ms) or
      // right-click = right material.
      let lp, fired = false;
      d.onpointerdown = () => {
        fired = false;
        lp = setTimeout(() => { fired = true; rightMat = m.id; mark(); }, 450);
      };
      d.onpointerup = d.onpointerleave = d.onpointercancel = () => clearTimeout(lp);
      d.onclick = () => { if (!fired) { leftMat = m.id; tool = "paint"; mark(); } };
      d.oncontextmenu = (ev) => { ev.preventDefault(); rightMat = m.id; mark(); };
      stripEl.appendChild(d);
    });
  }
  mark();
}

const catBtns = SIDEBAR_CATS.map((name, n) => {
  const d = document.createElement("div");
  d.className = "sb";
  d.innerHTML = `<i>${S(ICONS[name])}</i><span>${name}</span>`;
  d.onclick = () => {
    cat = n;
    catBtns.forEach((x, k) => x.classList.toggle("on", k === n));
    strip();
  };
  g2el.appendChild(d);
  return d;
});
catBtns[cat].classList.add("on");
strip();

// --- Top bar: view switcher, ambient heat, grid overlay --------------------
const VN = ["Normal", "Temp", "Pressure"];
const VM = ["normal", "heat", "pressure"];
let viewIdx = 0;
const tb = document.getElementById("top");
tb.innerHTML = `<div class="b" id="vw">${S('<circle cx="12" cy="12" r="3"/><path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z"/>')}<span style="margin-left:5px">Normal</span></div><div style="flex:1"></div><div class="b sq on" id="am">${S('<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>')}</div><div class="b sq" id="gr">${S('<path d="M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>')}</div>`;
const vw = document.getElementById("vw");
vw.onclick = () => {
  viewIdx = (viewIdx + 1) % 3;
  viewMode = VM[viewIdx];
  vw.querySelector("span").textContent = VN[viewIdx];
};
const am = document.getElementById("am");
am.onclick = () => { ambient = am.classList.toggle("on"); sim.ambient = ambient; };
const gr = document.getElementById("gr");
gr.onclick = () => {
  gridOn = gr.classList.toggle("on");
  gridEl.style.display = gridOn ? "block" : "none";
};

// --- Bottom bar: clear, furnace, brush, wind direction, rect, line, pause --
const bar = document.getElementById("bar");
const ib = (p, id) => `<div class="b sq" ${id ? `id="${id}"` : ""}>${S(p)}</div>`;
const WIND_ARROWS = ["→", "↓", "←", "↑"]; // 0 right, 1 down, 2 left, 3 up
bar.innerHTML =
  ib('<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>', "clear") +
  ib('<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>', "furnace") +
  '<div class="b" id="br">' + (BR[bi] * 2 + 1) + "</div>" +
  '<div class="b" id="wind" title="Wind direction">' + WIND_ARROWS[sim.windDir] + "</div>" +
  ib('<rect x="5" y="7" width="14" height="10"/>', "tr") +
  ib('<path d="M5 19L19 5"/>', "tl") +
  '<div style="flex:1"></div>' +
  ib('<path d="M8 5v14M16 5v14"/>', "pause");
document.getElementById("clear").onclick = () => sClear();
document.getElementById("furnace").onclick = () => sPresetFurnace();
document.getElementById("br").onclick = function () {
  bi = (bi + 1) % BR.length;
  this.textContent = BR[bi] * 2 + 1;
};
document.getElementById("wind").onclick = function () {
  sim.windDir = (sim.windDir + 1) % 4;
  this.textContent = WIND_ARROWS[sim.windDir];
};
const tr = document.getElementById("tr"), tl = document.getElementById("tl");
const syncShape = () => {
  tr.classList.toggle("on", shape === "rect");
  tl.classList.toggle("on", shape === "line");
};
tr.onclick = () => { shape = shape === "rect" ? "brush" : "rect"; syncShape(); };
tl.onclick = () => { shape = shape === "line" ? "brush" : "line"; syncShape(); };
const pb = document.getElementById("pause");
pb.onclick = () => {
  sim.running = !sim.running;
  pb.innerHTML = S(sim.running
    ? '<path d="M8 5v14M16 5v14"/>'
    : '<path d="M8 5l11 7-11 7z"/>');
};

// --- Main loop ---------------------------------------------------------------
let last = performance.now();
let acc = 0, frames = 0, lastFps = last;
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
  frames++;
  if (now - lastFps > 500) {
    const f = frames * 1000 / (now - lastFps);
    frames = 0; lastFps = now;
    fpsEl.textContent = `FPS: ${Math.min(60, f).toFixed(2)} Parts: ${parts}`;
  }
  requestAnimationFrame(frame);
}

sClear();
fitCanvas();
requestAnimationFrame(frame);
