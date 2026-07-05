(() => {
  "use strict";

  const MASK_SIZE = 224;
  const MAX_STEP = 0.009;
  const BASE_POINTS_PER_SECOND = 420;
  const TWO_PI = Math.PI * 2;

  const ids = [
    "previewCanvas",
    "themeButton",
    "resetButton",
    "imageInput",
    "dropZone",
    "sourceName",
    "thresholdInput",
    "thresholdValue",
    "invertInput",
    "scaleInput",
    "scaleValue",
    "fillModeInput",
    "clearQualityInput",
    "spacingInput",
    "spacingValue",
    "amplitudeInput",
    "amplitudeValue",
    "frequencyInput",
    "frequencyValue",
    "angleInput",
    "angleValue",
    "outlineInput",
    "outlineValue",
    "rhoInput",
    "rhoValue",
    "startCenterInput",
    "endCenterInput",
    "maskPreviewInput",
    "connectorInput",
    "segmentCount",
    "pointCount",
    "playButton",
    "playIcon",
    "playLabel",
    "speedInput",
    "timelineInput",
    "durationLabel",
    "filenameInput",
    "downloadButton",
    "svgButton",
    "copyButton",
    "copyStatus",
    "fileSizeLabel",
    "pathLengthLabel",
    "rhoRangeLabel",
  ];

  const el = {};
  const state = {
    sourceImage: null,
    sourceCanvas: null,
    objectUrl: "",
    mask: new Uint8Array(MASK_SIZE * MASK_SIZE),
    maskPreviewCanvas: null,
    path: [],
    thr: "",
    progress: 0,
    playing: false,
    lastFrame: 0,
    pendingGenerate: false,
    sourceLabel: "Sample mask",
    threshold: 150,
    invert: false,
    shapeScale: 0.86,
    fillMode: "waves",
    clearQuality: "pro",
    spacing: 0.044,
    amplitude: 0.022,
    frequency: 8,
    angleRad: 0,
    outlinePasses: 1,
    rhoMax: 0.96,
    startCenter: true,
    endCenter: true,
    showMask: true,
    showConnectors: true,
    fillSegmentCount: 0,
    outlineSegmentCount: 0,
    currentOutlineSegments: [],
    pathLength: 0,
    rhoMin: 0,
    rhoMaxSeen: 0,
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    ids.forEach((id) => {
      el[id] = document.getElementById(id);
    });

    applyTheme("dark");
    seedDefaultMask();
    attachEvents();
    generate();
  }

  function attachEvents() {
    const generateInputs = [
      "thresholdInput",
      "invertInput",
      "scaleInput",
      "fillModeInput",
      "clearQualityInput",
      "spacingInput",
      "amplitudeInput",
      "frequencyInput",
      "angleInput",
      "outlineInput",
      "rhoInput",
      "startCenterInput",
      "endCenterInput",
    ];

    generateInputs.forEach((id) => {
      el[id].addEventListener("input", scheduleGenerate);
      el[id].addEventListener("change", scheduleGenerate);
    });

    ["maskPreviewInput", "connectorInput"].forEach((id) => {
      el[id].addEventListener("input", () => {
        readControls();
        draw();
      });
    });

    el.imageInput.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        loadImageFile(file);
      }
    });

    el.resetButton.addEventListener("click", () => {
      seedDefaultMask();
      state.progress = 0;
      el.filenameInput.value = "dune-weaver-fill.thr";
      scheduleGenerate();
    });

    el.themeButton.addEventListener("click", () => {
      applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
      draw();
    });

    el.playButton.addEventListener("click", () => {
      if (state.playing) {
        setPlaying(false);
      } else {
        if (state.progress >= 1) {
          state.progress = 0;
        }
        setPlaying(true);
      }
    });

    el.timelineInput.addEventListener("input", () => {
      state.progress = Number(el.timelineInput.value) / 1000;
      draw();
    });

    el.speedInput.addEventListener("change", updatePlaybackLabels);
    el.downloadButton.addEventListener("click", downloadThr);
    el.svgButton.addEventListener("click", downloadSvgTrace);
    el.copyButton.addEventListener("click", copyThr);
    window.addEventListener("resize", draw);

    el.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      el.dropZone.classList.add("dragging");
    });
    el.dropZone.addEventListener("dragleave", () => {
      el.dropZone.classList.remove("dragging");
    });
    el.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      el.dropZone.classList.remove("dragging");
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        loadImageFile(file);
      }
    });
  }

  function seedDefaultMask() {
    const canvas = document.createElement("canvas");
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    ctx.fillStyle = "#111111";
    ctx.font = `900 ${Math.round(MASK_SIZE * 0.38)}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DW", MASK_SIZE / 2, MASK_SIZE * 0.52);
    ctx.lineWidth = Math.max(8, MASK_SIZE * 0.045);
    ctx.strokeStyle = "#111111";
    roundRect(ctx, MASK_SIZE * 0.16, MASK_SIZE * 0.18, MASK_SIZE * 0.68, MASK_SIZE * 0.64, MASK_SIZE * 0.06);
    ctx.stroke();

    state.sourceCanvas = canvas;
    state.sourceImage = null;
    state.sourceLabel = "Sample mask";
    el.sourceName.textContent = state.sourceLabel;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  function loadImageFile(file) {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      if (state.objectUrl) {
        URL.revokeObjectURL(state.objectUrl);
      }
      state.objectUrl = url;
      state.sourceImage = image;
      state.sourceCanvas = null;
      state.sourceLabel = shortName(file.name);
      el.sourceName.textContent = state.sourceLabel;
      el.filenameInput.value = `${fileBaseName(file.name)}.thr`;
      state.progress = 0;
      scheduleGenerate();
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      el.copyStatus.textContent = "Image could not be loaded.";
    };

    image.src = url;
  }

  function shortName(name) {
    return name.length > 24 ? `${name.slice(0, 10)}...${name.slice(-10)}` : name;
  }

  function fileBaseName(name) {
    const base = name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-");
    return base || "dune-weaver-fill";
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const light = theme === "light";
    el.themeButton.innerHTML = light ? "&#9790;" : "&#9788;";
    el.themeButton.title = light ? "Switch to dark mode" : "Switch to light mode";
    el.themeButton.setAttribute("aria-label", el.themeButton.title);
  }

  function scheduleGenerate() {
    if (state.pendingGenerate) {
      return;
    }
    state.pendingGenerate = true;
    requestAnimationFrame(() => {
      state.pendingGenerate = false;
      generate();
    });
  }

  function generate() {
    readControls();
    rebuildMask();

    const fillSegments = generateFillSegments();
    const outlineSegments = extractOutlineSegments();
    const path = [];

    state.fillSegmentCount = fillSegments.length;
    state.outlineSegmentCount = outlineSegments.length * state.outlinePasses;
    state.currentOutlineSegments = outlineSegments;

    const clearIn = state.fillMode === "clearIn";
    const clearOut = state.fillMode === "clearOut";

    if (state.startCenter && !clearOut) {
      path.push(point(0, 0, "connector"));
    }

    appendChains(path, fillSegments, "fill", clearIn || clearOut);

    for (let pass = 0; pass < state.outlinePasses; pass += 1) {
      appendChains(path, cloneSegments(outlineSegments), "outline");
    }

    if (state.endCenter && !clearIn && path.length > 0) {
      appendConnector(path, point(0, 0, "connector"));
    }

    state.path = path;
    state.thr = toThr(path);
    state.pathLength = totalPathLength(path);
    updateStats();
    draw();
  }

  function readControls() {
    state.threshold = Number(el.thresholdInput.value);
    state.invert = el.invertInput.checked;
    state.shapeScale = Number(el.scaleInput.value) / 100;
    state.fillMode = el.fillModeInput.value;
    state.clearQuality = el.clearQualityInput.value;
    state.spacing = Number(el.spacingInput.value) / 1000;
    state.amplitude = Number(el.amplitudeInput.value) / 1000;
    state.frequency = Number(el.frequencyInput.value);
    state.angleRad = (Number(el.angleInput.value) * Math.PI) / 180;
    state.outlinePasses = Number(el.outlineInput.value);
    state.rhoMax = Number(el.rhoInput.value) / 100;
    state.startCenter = el.startCenterInput.checked;
    state.endCenter = el.endCenterInput.checked;
    state.showMask = el.maskPreviewInput.checked;
    state.showConnectors = el.connectorInput.checked;

    el.thresholdValue.textContent = String(state.threshold);
    el.scaleValue.textContent = `${Math.round(state.shapeScale * 100)}%`;
    el.spacingValue.textContent = state.spacing.toFixed(3);
    el.amplitudeValue.textContent = state.amplitude.toFixed(3);
    el.frequencyValue.textContent = String(state.frequency);
    el.angleValue.textContent = `${Math.round((state.angleRad * 180) / Math.PI)} deg`;
    el.outlineValue.textContent = String(state.outlinePasses);
    el.rhoValue.textContent = state.rhoMax.toFixed(2);
  }

  function rebuildMask() {
    const canvas = document.createElement("canvas");
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);

    if (state.sourceImage) {
      drawSourceImage(ctx, state.sourceImage);
    } else if (state.sourceCanvas) {
      ctx.drawImage(state.sourceCanvas, 0, 0);
    }

    const imageData = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    const data = imageData.data;
    const mask = new Uint8Array(MASK_SIZE * MASK_SIZE);
    let transparent = 0;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 245) {
        transparent += 1;
      }
    }

    const hasAlphaMask = transparent > mask.length * 0.04;

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const alpha = data[i + 3];
      const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      let inside = hasAlphaMask ? alpha > 42 : alpha > 10 && luminance < state.threshold;

      if (!hasAlphaMask && state.invert) {
        inside = alpha > 10 && luminance > state.threshold;
      } else if (hasAlphaMask && state.invert) {
        inside = alpha <= 42;
      }

      mask[p] = inside ? 1 : 0;
    }

    state.mask = cleanMask(mask);
    state.maskPreviewCanvas = createMaskPreviewCanvas(state.mask);
  }

  function drawSourceImage(ctx, image) {
    const margin = Math.round(MASK_SIZE * 0.05);
    const available = MASK_SIZE - margin * 2;
    const scale = Math.min(available / image.width, available / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (MASK_SIZE - width) / 2;
    const y = (MASK_SIZE - height) / 2;
    ctx.drawImage(image, x, y, width, height);
  }

  function cleanMask(mask) {
    const out = new Uint8Array(mask.length);

    for (let y = 0; y < MASK_SIZE; y += 1) {
      for (let x = 0; x < MASK_SIZE; x += 1) {
        let count = 0;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx >= 0 && nx < MASK_SIZE && ny >= 0 && ny < MASK_SIZE && mask[ny * MASK_SIZE + nx]) {
              count += 1;
            }
          }
        }
        out[y * MASK_SIZE + x] = count >= 4 ? 1 : 0;
      }
    }

    return out;
  }

  function createMaskPreviewCanvas(mask) {
    const canvas = document.createElement("canvas");
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(MASK_SIZE, MASK_SIZE);
    const data = imageData.data;

    for (let i = 0, p = 0; p < mask.length; i += 4, p += 1) {
      if (mask[p]) {
        data[i] = 215;
        data[i + 1] = 173;
        data[i + 2] = 85;
        data[i + 3] = 92;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function generateFillSegments() {
    if (state.fillMode === "clearIn") {
      return generateClearSegments("in");
    }
    if (state.fillMode === "clearOut") {
      return generateClearSegments("out");
    }
    if (state.fillMode === "sweep") {
      return generateSweepSegments();
    }
    if (state.fillMode === "orbit") {
      return generateOrbitSegments();
    }
    if (state.fillMode === "spiral") {
      return generateSpiralSegments();
    }
    return generateWaveSegments();
  }

  function generateSweepSegments() {
    const segments = [];
    const span = 1.42;
    const steps = Math.ceil((span * 2) / Math.max(0.005, state.spacing / 4));
    let row = 0;

    for (let y = -span; y <= span; y += state.spacing) {
      const rowSegments = traceParametric((t) => rotateLocal(-span + t * span * 2, y), steps);
      if (row % 2 === 1) {
        rowSegments.forEach((segment) => segment.reverse());
      }
      segments.push(...rowSegments);
      row += 1;
    }

    return segments;
  }

  function generateWaveSegments() {
    const segments = [];
    const span = 1.42;
    const steps = Math.ceil((span * 2) / Math.max(0.0045, state.spacing / 4));
    let row = 0;

    for (let baseY = -span; baseY <= span; baseY += state.spacing) {
      const phase = row * 0.47;
      const rowSegments = traceParametric((t) => {
        const x = -span + t * span * 2;
        const wave = Math.sin(t * TWO_PI * state.frequency + phase) * state.amplitude;
        return rotateLocal(x, baseY + wave);
      }, steps);

      if (row % 2 === 1) {
        rowSegments.forEach((segment) => segment.reverse());
      }
      segments.push(...rowSegments);
      row += 1;
    }

    return segments;
  }

  function generateOrbitSegments() {
    const loops = clamp(Math.round(2.7 / state.spacing), 16, 130);
    const steps = loops * 190;

    return traceParametric((t) => {
      const a = t * TWO_PI * loops;
      const wobble = Math.sin(a * 0.13) * 0.16;
      const x = Math.sin(a * 2 + wobble) * 0.97;
      const y = Math.sin(a * 3 + Math.PI / 5) * 0.97;
      return rotateLocal(x, y);
    }, steps);
  }

  function generateSpiralSegments() {
    const turns = clamp(Math.round(1.1 / state.spacing), 9, 54);
    const steps = turns * 240;

    return traceParametric((t) => {
      const radius = 0.018 + t * 0.97;
      const angle = t * TWO_PI * turns;
      return rotateLocal(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }, steps);
  }

  function generateClearSegments(direction) {
    const presets = {
      standard: { turns: 33, stepsPerTurn: 104, wobble: 0.004 },
      pro: { turns: 47, stepsPerTurn: 156, wobble: 0.003 },
      ultra: { turns: 159, stepsPerTurn: 610, wobble: 0.0015 },
    };
    const preset = presets[state.clearQuality] || presets.pro;
    const steps = preset.turns * preset.stepsPerTurn;
    const inward = direction === "in";

    return traceParametric((t) => {
      const sweep = inward ? t : 1 - t;
      const baseRadius = 0.006 + sweep * 0.989;
      const ripple =
        Math.sin(t * TWO_PI * preset.turns * 0.37) * preset.wobble +
        Math.sin(t * TWO_PI * preset.turns * 0.11 + 1.7) * preset.wobble * 0.65;
      const radius = clamp(baseRadius + ripple, 0, 0.995);
      const angleSign = inward ? -1 : 1;
      const angle = Math.PI / 2 + angleSign * t * TWO_PI * preset.turns;
      return rotateLocal(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }, steps);
  }

  function traceParametric(getPoint, steps) {
    const segments = [];
    let run = [];

    for (let i = 0; i <= steps; i += 1) {
      const p = getPoint(i / steps, i);
      if (isInside(p.x, p.y)) {
        run.push(p);
      } else {
        closeRun();
      }
    }

    closeRun();
    return segments;

    function closeRun() {
      if (run.length >= 2 && totalPathLength(run) > state.spacing * 0.55) {
        segments.push(run);
      }
      run = [];
    }
  }

  function rotateLocal(x, y) {
    const c = Math.cos(state.angleRad);
    const s = Math.sin(state.angleRad);
    return {
      x: x * c - y * s,
      y: x * s + y * c,
    };
  }

  function isInside(x, y) {
    if (!inTable(x, y) || state.shapeScale <= 0) {
      return false;
    }

    const sx = x / state.shapeScale;
    const sy = y / state.shapeScale;

    if (sx < -1 || sx > 1 || sy < -1 || sy > 1) {
      return false;
    }

    const gx = Math.round((sx * 0.5 + 0.5) * (MASK_SIZE - 1));
    const gy = Math.round((sy * 0.5 + 0.5) * (MASK_SIZE - 1));
    return state.mask[gy * MASK_SIZE + gx] === 1;
  }

  function inTable(x, y) {
    return x * x + y * y <= 0.995 * 0.995;
  }

  function extractOutlineSegments() {
    const pairsByCase = {
      1: [["L", "T"]],
      2: [["T", "R"]],
      3: [["L", "R"]],
      4: [["R", "B"]],
      5: [
        ["L", "T"],
        ["R", "B"],
      ],
      6: [["T", "B"]],
      7: [["L", "B"]],
      8: [["B", "L"]],
      9: [["T", "B"]],
      10: [
        ["T", "R"],
        ["B", "L"],
      ],
      11: [["R", "B"]],
      12: [["R", "L"]],
      13: [["T", "R"]],
      14: [["L", "T"]],
    };

    const rawSegments = [];

    for (let y = 0; y < MASK_SIZE - 1; y += 1) {
      for (let x = 0; x < MASK_SIZE - 1; x += 1) {
        const tl = state.mask[y * MASK_SIZE + x] ? 1 : 0;
        const tr = state.mask[y * MASK_SIZE + x + 1] ? 1 : 0;
        const br = state.mask[(y + 1) * MASK_SIZE + x + 1] ? 1 : 0;
        const bl = state.mask[(y + 1) * MASK_SIZE + x] ? 1 : 0;
        const code = tl | (tr << 1) | (br << 2) | (bl << 3);
        const pairs = pairsByCase[code];

        if (!pairs) {
          continue;
        }

        pairs.forEach(([a, b]) => {
          rawSegments.push({
            a: edgePoint(x, y, a),
            b: edgePoint(x, y, b),
          });
        });
      }
    }

    return chainRawSegments(rawSegments)
      .flatMap((chain) => splitByTable(simplifyPolyline(chain.map(gridToWorld), 0.003)))
      .filter((segment) => segment.length > 4 && totalPathLength(segment) > 0.02);
  }

  function edgePoint(x, y, edge) {
    if (edge === "T") {
      return { x2: x * 2 + 1, y2: y * 2 };
    }
    if (edge === "R") {
      return { x2: (x + 1) * 2, y2: y * 2 + 1 };
    }
    if (edge === "B") {
      return { x2: x * 2 + 1, y2: (y + 1) * 2 };
    }
    return { x2: x * 2, y2: y * 2 + 1 };
  }

  function chainRawSegments(rawSegments) {
    const adjacency = new Map();
    const unused = new Set(rawSegments.map((_, index) => index));

    rawSegments.forEach((segment, index) => {
      addAdjacency(adjacency, rawKey(segment.a), index);
      addAdjacency(adjacency, rawKey(segment.b), index);
    });

    const chains = [];

    while (unused.size > 0) {
      const firstIndex = unused.values().next().value;
      unused.delete(firstIndex);
      const first = rawSegments[firstIndex];
      const chain = [first.a, first.b];

      let changed = true;
      while (changed) {
        changed = extendChain(chain, true) || extendChain(chain, false);
      }

      chains.push(chain);
    }

    return chains;

    function extendChain(chain, atEnd) {
      const key = rawKey(atEnd ? chain[chain.length - 1] : chain[0]);
      const candidates = adjacency.get(key) || [];

      for (const index of candidates) {
        if (!unused.has(index)) {
          continue;
        }
        unused.delete(index);
        const segment = rawSegments[index];
        const other = rawKey(segment.a) === key ? segment.b : segment.a;

        if (atEnd) {
          chain.push(other);
        } else {
          chain.unshift(other);
        }
        return true;
      }

      return false;
    }
  }

  function addAdjacency(map, key, index) {
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(index);
  }

  function rawKey(p) {
    return `${p.x2},${p.y2}`;
  }

  function gridToWorld(p) {
    const gx = p.x2 / 2;
    const gy = p.y2 / 2;
    return {
      x: ((gx / (MASK_SIZE - 1)) * 2 - 1) * state.shapeScale,
      y: ((gy / (MASK_SIZE - 1)) * 2 - 1) * state.shapeScale,
    };
  }

  function splitByTable(points) {
    const segments = [];
    let run = [];

    points.forEach((p) => {
      if (inTable(p.x, p.y)) {
        run.push(p);
      } else {
        closeRun();
      }
    });

    closeRun();
    return segments;

    function closeRun() {
      if (run.length > 2) {
        segments.push(run);
      }
      run = [];
    }
  }

  function simplifyPolyline(points, tolerance) {
    if (points.length < 3) {
      return points;
    }

    const out = [points[0]];

    for (let i = 1; i < points.length - 1; i += 1) {
      const a = out[out.length - 1];
      const b = points[i];
      const c = points[i + 1];
      const base = distance(a, c);
      const area = Math.abs((c.x - a.x) * (a.y - b.y) - (a.x - b.x) * (c.y - a.y));
      const height = base > 0 ? area / base : 0;

      if (height > tolerance || distance(a, b) > tolerance * 3) {
        out.push(b);
      }
    }

    out.push(points[points.length - 1]);
    return out;
  }

  function appendChains(path, sourceSegments, kind, preserveOrder = false) {
    const segments = sourceSegments
      .filter((segment) => segment.length > 1)
      .map((segment) => resamplePolyline(segment, MAX_STEP));

    if (preserveOrder) {
      segments.forEach((next) => {
        if (path.length > 0) {
          appendConnector(path, next[0]);
        }
        next.forEach((p) => appendPoint(path, point(p.x, p.y, kind)));
      });
      return;
    }

    while (segments.length > 0) {
      const current = path.length > 0 ? path[path.length - 1] : point(0, 0, kind);
      let bestIndex = 0;
      let bestReverse = false;
      let bestDistance = Infinity;

      for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i];
        const startDistance = distanceSquared(current, segment[0]);
        const endDistance = distanceSquared(current, segment[segment.length - 1]);

        if (startDistance < bestDistance) {
          bestIndex = i;
          bestReverse = false;
          bestDistance = startDistance;
        }

        if (endDistance < bestDistance) {
          bestIndex = i;
          bestReverse = true;
          bestDistance = endDistance;
        }
      }

      const next = segments.splice(bestIndex, 1)[0];
      if (bestReverse) {
        next.reverse();
      }

      if (path.length > 0) {
        appendConnector(path, next[0]);
      }

      next.forEach((p) => appendPoint(path, point(p.x, p.y, kind)));
    }
  }

  function appendConnector(path, target) {
    if (path.length === 0) {
      appendPoint(path, point(target.x, target.y, "connector"));
      return;
    }

    const start = path[path.length - 1];
    const length = distance(start, target);
    const steps = Math.max(1, Math.ceil(length / MAX_STEP));

    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      appendPoint(
        path,
        point(start.x + (target.x - start.x) * t, start.y + (target.y - start.y) * t, "connector"),
      );
    }
  }

  function appendPoint(path, p) {
    const last = path[path.length - 1];
    if (!last || distanceSquared(last, p) > 0.0000004 || last.kind !== p.kind) {
      path.push(p);
    }
  }

  function resamplePolyline(points, step) {
    const out = [];

    for (let i = 0; i < points.length; i += 1) {
      if (i === 0) {
        out.push({ x: points[i].x, y: points[i].y });
        continue;
      }

      const start = points[i - 1];
      const end = points[i];
      const length = distance(start, end);
      const count = Math.max(1, Math.ceil(length / step));

      for (let j = 1; j <= count; j += 1) {
        const t = j / count;
        out.push({
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        });
      }
    }

    return out;
  }

  function cloneSegments(segments) {
    return segments.map((segment) => segment.map((p) => ({ x: p.x, y: p.y })));
  }

  function toThr(path) {
    let theta = 0;
    let rawTheta = 0;
    let rhoMin = Infinity;
    let rhoMaxSeen = 0;
    const rows = [];

    path.forEach((p) => {
      const radius = Math.min(Math.hypot(p.x, p.y) * state.rhoMax, state.rhoMax);
      let nextRawTheta = Math.atan2(p.x, p.y);
      nextRawTheta = (nextRawTheta + TWO_PI) % TWO_PI;

      let delta = nextRawTheta - rawTheta;
      if (delta < -Math.PI) {
        delta += TWO_PI;
      }
      if (delta > Math.PI) {
        delta -= TWO_PI;
      }

      theta += delta;
      rawTheta = nextRawTheta;
      rhoMin = Math.min(rhoMin, radius);
      rhoMaxSeen = Math.max(rhoMaxSeen, radius);
      rows.push(`${theta.toFixed(5)} ${radius.toFixed(5)}`);
    });

    state.rhoMin = Number.isFinite(rhoMin) ? rhoMin : 0;
    state.rhoMaxSeen = rhoMaxSeen;
    return rows.length ? `${rows.join("\n")}\n` : "";
  }

  function totalPathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
      length += distance(points[i - 1], points[i]);
    }
    return length;
  }

  function updateStats() {
    const totalSegments = state.fillSegmentCount + state.outlineSegmentCount;
    const bytes = new Blob([state.thr]).size;
    const seconds = state.path.length / BASE_POINTS_PER_SECOND / Number(el.speedInput.value);

    el.segmentCount.textContent = `${totalSegments.toLocaleString()} segments`;
    el.pointCount.textContent = `${state.path.length.toLocaleString()} pts`;
    el.fileSizeLabel.textContent = `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;
    el.pathLengthLabel.textContent = `${(state.pathLength / 2).toFixed(2)} table widths`;
    el.rhoRangeLabel.textContent = `rho ${state.rhoMin.toFixed(2)}-${state.rhoMaxSeen.toFixed(2)}`;
    el.durationLabel.textContent = formatTime(seconds);
    el.timelineInput.value = String(Math.round(state.progress * 1000));
  }

  function updatePlaybackLabels() {
    updateStats();
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "0:00";
    }
    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const rest = String(rounded % 60).padStart(2, "0");
    return `${minutes}:${rest}`;
  }

  function setPlaying(isPlaying) {
    state.playing = isPlaying;
    state.lastFrame = 0;
    el.playIcon.innerHTML = isPlaying ? "&#10074;&#10074;" : "&#9654;";
    el.playLabel.textContent = isPlaying ? "Pause" : "Play";

    if (isPlaying) {
      requestAnimationFrame(animate);
    }
  }

  function animate(timestamp) {
    if (!state.playing) {
      return;
    }

    if (!state.lastFrame) {
      state.lastFrame = timestamp;
    }

    const deltaSeconds = Math.min(0.08, (timestamp - state.lastFrame) / 1000);
    const speed = Number(el.speedInput.value);
    state.lastFrame = timestamp;

    if (state.path.length > 1) {
      state.progress += (deltaSeconds * BASE_POINTS_PER_SECOND * speed) / state.path.length;
    }

    if (state.progress >= 1) {
      state.progress = 1;
      setPlaying(false);
    }

    el.timelineInput.value = String(Math.round(state.progress * 1000));
    draw();
    requestAnimationFrame(animate);
  }

  function draw() {
    const canvas = el.previewCanvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(320, rect.width);
    const height = Math.max(320, rect.height);

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.43;
    const colors = previewColors();

    drawStageBackground(ctx, width, height, cx, cy, radius, colors);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.clip();

    if (state.showMask && state.maskPreviewCanvas) {
      const size = radius * 2 * state.shapeScale;
      ctx.drawImage(state.maskPreviewCanvas, cx - size / 2, cy - size / 2, size, size);
    }

    if (state.showConnectors) {
      drawPathByKind(ctx, cx, cy, radius, "connector", colors.connector, 1.3, [6, 5]);
    }
    drawPathByKind(ctx, cx, cy, radius, "fill", colors.fill, 1.15, []);
    drawPathByKind(ctx, cx, cy, radius, "outline", colors.outline, 1.8, []);
    drawProgressPath(ctx, cx, cy, radius, colors);
    drawBall(ctx, cx, cy, radius, colors);

    ctx.restore();
  }

  function previewColors() {
    if (document.body.dataset.theme === "light") {
      return {
        screen: "#f3ecdf",
        sandInner: "#eadfc8",
        sandOuter: "#d8c7a8",
        ring: "rgba(23, 33, 36, 0.12)",
        rim: "rgba(23, 33, 36, 0.36)",
        connector: "rgba(184, 95, 61, 0.42)",
        fill: "rgba(11, 102, 112, 0.34)",
        outline: "rgba(23, 33, 36, 0.62)",
        progress: "rgba(7, 67, 76, 0.92)",
        ball: "#b85f3d",
        ballHighlight: "#f2d48e",
        shadow: "rgba(23, 33, 36, 0.32)",
      };
    }

    return {
      screen: "#101819",
      sandInner: "#b8a476",
      sandOuter: "#574b36",
      ring: "rgba(238, 246, 241, 0.11)",
      rim: "rgba(238, 246, 241, 0.34)",
      connector: "rgba(226, 138, 98, 0.52)",
      fill: "rgba(94, 215, 224, 0.42)",
      outline: "rgba(240, 231, 203, 0.7)",
      progress: "rgba(91, 228, 236, 0.94)",
      ball: "#e28a62",
      ballHighlight: "#f8d887",
      shadow: "rgba(0, 0, 0, 0.48)",
    };
  }

  function drawStageBackground(ctx, width, height, cx, cy, radius, colors) {
    ctx.fillStyle = colors.screen;
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.28, radius * 0.1, cx, cy, radius);
    gradient.addColorStop(0, colors.sandInner);
    gradient.addColorStop(1, colors.sandOuter);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.fill();

    ctx.strokeStyle = colors.ring;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, (radius * i) / 5, 0, TWO_PI);
      ctx.stroke();
    }

    ctx.strokeStyle = colors.rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.stroke();
  }

  function drawPathByKind(ctx, cx, cy, radius, kind, stroke, width, dash) {
    if (!state.path.length) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dash);
    ctx.beginPath();

    let drawing = false;
    for (let i = 1; i < state.path.length; i += 1) {
      const current = state.path[i];
      const previous = state.path[i - 1];

      if (current.kind !== kind) {
        drawing = false;
        continue;
      }

      const start = toCanvas(previous, cx, cy, radius);
      const end = toCanvas(current, cx, cy, radius);

      if (!drawing) {
        ctx.moveTo(start.x, start.y);
        drawing = true;
      }
      ctx.lineTo(end.x, end.y);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawProgressPath(ctx, cx, cy, radius, colors) {
    if (state.path.length < 2) {
      return;
    }

    const endIndex = Math.max(1, Math.floor(state.progress * (state.path.length - 1)));
    ctx.save();
    ctx.strokeStyle = colors.progress;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    const first = toCanvas(state.path[0], cx, cy, radius);
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i <= endIndex; i += 1) {
      const p = toCanvas(state.path[i], cx, cy, radius);
      ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawBall(ctx, cx, cy, radius, colors) {
    if (!state.path.length) {
      return;
    }

    const index = Math.min(state.path.length - 1, Math.floor(state.progress * (state.path.length - 1)));
    const p = toCanvas(state.path[index], cx, cy, radius);

    ctx.save();
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = colors.ball;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(5, radius * 0.019), 0, TWO_PI);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = colors.ballHighlight;
    ctx.beginPath();
    ctx.arc(p.x - radius * 0.006, p.y - radius * 0.007, Math.max(2, radius * 0.006), 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  function toCanvas(p, cx, cy, radius) {
    return {
      x: cx + p.x * radius,
      y: cy + p.y * radius,
    };
  }

  function downloadThr() {
    const name = normalizedFilename();
    const blob = new Blob([state.thr], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function downloadSvgTrace() {
    const svg = buildSvgTrace();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = normalizedFilename().replace(/\.thr$/i, "-trace.svg");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function buildSvgTrace() {
    const size = 1000;
    const contourPaths = state.currentOutlineSegments
      .map((segment) => `<path d="${svgPathData(segment)}" />`)
      .join("\n    ");
    const toolPath = state.path.length ? svgPathData(state.path) : "";

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
      "  <title>Dune Weaver traced source and generated path</title>",
      '  <circle id="table" cx="500" cy="500" r="497" fill="#f3ecdf" stroke="#172124" stroke-width="2" />',
      '  <g id="source-contours" fill="none" stroke="#172124" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">',
      `    ${contourPaths}`,
      "  </g>",
      `  <path id="generated-thr-path" d="${toolPath}" fill="none" stroke="#0b6670" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.72" />`,
      "</svg>",
      "",
    ].join("\n");
  }

  function svgPathData(points) {
    if (!points.length) {
      return "";
    }

    return points
      .map((p, index) => {
        const x = ((p.x * 0.5 + 0.5) * 1000).toFixed(2);
        const y = ((p.y * 0.5 + 0.5) * 1000).toFixed(2);
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  }

  async function copyThr() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(state.thr);
      } else {
        fallbackCopy(state.thr);
      }
      el.copyStatus.textContent = "Copied.";
    } catch (error) {
      el.copyStatus.textContent = "Copy failed.";
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function normalizedFilename() {
    const raw = el.filenameInput.value.trim() || "dune-weaver-fill.thr";
    const cleaned = raw.replace(/[\\/:*?"<>|]+/g, "-");
    return cleaned.toLowerCase().endsWith(".thr") ? cleaned : `${cleaned}.thr`;
  }

  function point(x, y, kind) {
    return { x, y, kind };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
})();
