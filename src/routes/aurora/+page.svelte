<script lang="ts">
  import { onMount } from 'svelte';
  import { COASTLINE_PATHS } from '$lib/coastlines';

  type AuroraBin = {
    lat: number;
    lon: number;
    p: number;
  };

  type ForecastFrame = {
    label: string;
    time: string;
    kp: number;
    bins: AuroraBin[];
  };

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  let width = 840;
  let height = 840;
  let radius = 360;

  let frames: ForecastFrame[] = [];
  let selected = 0;
  let loading = true;
  let error = '';

  let customLocalTime = '';
  let mode: 'default' | 'night' | 'custom' = 'night';

  const DEG = Math.PI / 180;
  const centerLat = 90;
  const centerLon = -40;

  function project(lat: number, lon: number) {
    const φ = lat * DEG;
    const λ = lon * DEG;
    const φ0 = centerLat * DEG;
    const λ0 = centerLon * DEG;

    const cosC =
      Math.sin(φ0) * Math.sin(φ) +
      Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);

    if (cosC < 0) return { visible: false, x: 0, y: 0 };

    const x = radius * Math.cos(φ) * Math.sin(λ - λ0);
    const y =
      radius *
      (Math.cos(φ0) * Math.sin(φ) -
        Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0));

    return {
      visible: true,
      x: width / 2 + x,
      y: height / 2 - y
    };
  }

  function auroraStyle(p: number) {
    const t = Math.min(Math.max(p / 100, 0), 1);

    if (t < 0.015) {
      return { color: 'rgba(0,0,0,0)', size: 0, glow: 0 };
    }

    let r = 0;
    let g = 0;
    let b = 0;

    if (t < 0.45) {
      const u = t / 0.45;
      r = Math.round(20 * u);
      g = Math.round(120 + 135 * u);
      b = Math.round(20 - 10 * u);
    } else if (t < 0.75) {
      const u = (t - 0.45) / 0.30;
      r = Math.round(20 + 180 * u);
      g = Math.round(255 - 35 * u);
      b = 10;
    } else {
      const u = (t - 0.75) / 0.25;
      r = Math.round(200 + 55 * u);
      g = Math.round(220 - 150 * u);
      b = 10;
    }

    const alpha = 0.06 + 0.62 * Math.pow(t, 0.9);
    const size = 1.8 + 2.8 * Math.pow(t, 0.7);
    const glow = 2 + 10 * Math.pow(t, 1.2);

    return {
      color: `rgba(${r},${g},${b},${alpha})`,
      size,
      glow
    };
  }

  function drawGlobeBase() {
    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#071425';
    ctx.fill();

    const oceanGlow = ctx.createRadialGradient(
      width / 2,
      height / 2,
      radius * 0.12,
      width / 2,
      height / 2,
      radius
    );
    oceanGlow.addColorStop(0, 'rgba(10,28,52,0.35)');
    oceanGlow.addColorStop(1, 'rgba(4,10,18,0)');
    ctx.fillStyle = oceanGlow;
    ctx.fill();

    ctx.strokeStyle = '#243a58';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawGraticule() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(150,180,210,0.12)';
    ctx.lineWidth = 0.6;

    for (let lat = -80; lat <= 80; lat += 20) {
      ctx.beginPath();
      let started = false;

      for (let lon = -180; lon <= 180; lon += 2) {
        const p = project(lat, lon);
        if (!p.visible) continue;
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath();
      let started = false;

      for (let lat = -90; lat <= 90; lat += 2) {
        const p = project(lat, lon);
        if (!p.visible) continue;
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCoastlines() {
    if (!COASTLINE_PATHS?.length) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(210,220,230,0.38)';
    ctx.lineWidth = 0.9;

    for (const path of COASTLINE_PATHS) {
      ctx.beginPath();
      let started = false;

      for (const [lon, lat] of path) {
        const p = project(lat, lon);
        if (p.visible) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        } else {
          started = false;
        }
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  function drawAurora(frame: ForecastFrame) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.clip();

    for (const bin of frame.bins) {
      if (bin.p < 2) continue;

      const p = project(bin.lat, bin.lon);
      if (!p.visible) continue;

      const style = auroraStyle(bin.p);
      if (style.size <= 0) continue;

      ctx.shadowBlur = style.glow;
      ctx.shadowColor = style.color;
      ctx.fillStyle = style.color;

      const s = style.size * 1.6;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    ctx.shadowBlur = 0;

    for (const bin of frame.bins) {
      if (bin.p < 2) continue;

      const p = project(bin.lat, bin.lon);
      if (!p.visible) continue;

      const style = auroraStyle(bin.p);
      if (style.size <= 0) continue;

      ctx.fillStyle = style.color;
      const s = Math.max(1.2, style.size * 0.72);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    ctx.restore();
  }

  function drawLegend() {
    const x = 28;
    const y = height - 78;
    const w = 210;
    const h = 14;

    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#c7d8ea';
    ctx.fillText('Aurora Probability', x, y - 8);

    const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
    gradient.addColorStop(0.0, 'rgba(0,160,40,0.75)');
    gradient.addColorStop(0.45, 'rgba(90,255,40,0.78)');
    gradient.addColorStop(0.72, 'rgba(255,210,20,0.82)');
    gradient.addColorStop(1.0, 'rgba(255,80,10,0.86)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = '#50657f';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#9eb2c8';
    ctx.fillText('LOW', x, y + h + 12);
    ctx.fillText('HIGH', x + w - 28, y + h + 12);

    ctx.restore();
  }

  function frameDisplayLabel(frame: ForecastFrame) {
    const d = new Date(frame.time);
    return `${frame.label}  •  Kp ${frame.kp.toFixed(1)}  •  ${d.toLocaleString()}`;
  }

  function drawInfo() {
    if (!frames.length) return;

    const frame = frames[selected];

    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#b2c8de';
    ctx.fillText(frameDisplayLabel(frame), 28, 30);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#7f95ab';
    ctx.restore();
  }

  function drawGlobe() {
    if (!ctx) return;

    drawGlobeBase();
    drawGraticule();

    if (frames.length) drawAurora(frames[selected]);

    drawCoastlines();

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#324b6a';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawLegend();
    drawInfo();
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const container = canvas?.parentElement;
    if (!container) return;

    const size = Math.min(container.clientWidth - 24, 980);
    width = Math.max(420, size);
    height = width;
    radius = width * 0.43;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    drawGlobe();
  }

  function formatLocalInputValue(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function makeLocalNight(offsetDays: number, hour = 22, minute = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  function buildNightRequests() {
    return [
      { label: 'Last night', date: makeLocalNight(-1) },
      { label: 'Tonight', date: makeLocalNight(0) },
      { label: 'Tomorrow night', date: makeLocalNight(1) }
    ];
  }

  async function loadDefaultFrames() {
    loading = true;
    error = '';
    mode = 'default';

    try {
      const res = await fetch('/api/aurora-forecast');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      frames = (data.frames ?? []).map((frame: ForecastFrame) => ({
        ...frame,
        bins: (frame.bins ?? []).filter((b) => Number.isFinite(b.p) && b.p > 0)
      }));

      selected = 0;
    } catch (e) {
      error = `Failed to load aurora forecast: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      loading = false;
      drawGlobe();
    }
  }

  async function loadNightFrames() {
    loading = true;
    error = '';
    mode = 'night';

    try {
      const requests = buildNightRequests();
      const times = requests.map((r) => r.date.toISOString()).join(',');

      const res = await fetch(`/api/aurora-forecast?times=${encodeURIComponent(times)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const apiFrames = (data.frames ?? []) as ForecastFrame[];

      frames = apiFrames.map((frame, i) => ({
        ...frame,
        label: requests[i]?.label ?? frame.label,
        bins: (frame.bins ?? []).filter((b) => Number.isFinite(b.p) && b.p > 0)
      }));

      selected = Math.min(1, Math.max(0, frames.length - 1));
      customLocalTime = formatLocalInputValue(makeLocalNight(0));
    } catch (e) {
      error = `Failed to load night forecast: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      loading = false;
      drawGlobe();
    }
  }

  async function loadCustomTime(localValue: string) {
    if (!localValue) return;

    loading = true;
    error = '';
    mode = 'custom';

    try {
      const localDate = new Date(localValue);
      if (Number.isNaN(localDate.getTime())) throw new Error('Invalid date/time');

      const res = await fetch(
        `/api/aurora-forecast?time=${encodeURIComponent(localDate.toISOString())}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const frame = (data.frames?.[0] ?? null) as ForecastFrame | null;
      if (!frame) throw new Error('No frame returned');

      frames = [
        {
          ...frame,
          label: 'Custom',
          bins: (frame.bins ?? []).filter((b) => Number.isFinite(b.p) && b.p > 0)
        }
      ];

      selected = 0;
      customLocalTime = localValue;
    } catch (e) {
      error = `Failed to load custom forecast: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      loading = false;
      drawGlobe();
    }
  }

  function selectFrame(i: number) {
    selected = i;
    drawGlobe();
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    resize();
    loadNightFrames();

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  });
</script>

<svelte:head>
  <title>Aurora Forecast</title>
</svelte:head>

<div class="aurora-page">
  <header>
    <h1>Aurora Forecast</h1>
  </header>

  <div class="preset-row">
    <button class="preset-btn" on:click={loadNightFrames}>Last night / Tonight / Tomorrow night</button>

    <label class="custom-label">
      <span>Custom local time</span>
      <input
        type="datetime-local"
        bind:value={customLocalTime}
      />
    </label>

    <button
      class="preset-btn apply-btn"
      on:click={() => loadCustomTime(customLocalTime)}
    >
      Show custom time
    </button>
  </div>

  <div class="controls">
    {#each frames as frame, i}
      <button
        class="forecast-btn"
        class:active={selected === i}
        on:click={() => selectFrame(i)}
      >
        {frame.label} (Kp {frame.kp.toFixed(1)})
      </button>
    {/each}
  </div>

  <div class="canvas-wrap">
    {#if loading}
      <div class="overlay">Loading aurora data...</div>
    {/if}

    {#if error}
      <div class="overlay error">{error}</div>
    {/if}

    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .aurora-page {
    background: #03070d;
    color: #d5e4f2;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 16px 28px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  header {
    text-align: center;
    margin-bottom: 14px;
  }

  h1 {
    margin: 0 0 4px 0;
    color: #76e0b7;
    font-size: 1.6rem;
  }

  .preset-row,
  .controls {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 12px;
  }

  .preset-btn,
  .forecast-btn {
    background: #0f1825;
    border: 1px solid #27415e;
    color: #b6cde3;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.18s, border-color 0.18s, color 0.18s;
  }

  .preset-btn:hover,
  .forecast-btn:hover {
    background: #162233;
    border-color: #3d6691;
  }

  .forecast-btn.active {
    background: #163150;
    border-color: #50a6ff;
    color: #e2f0ff;
  }

  .custom-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #0c141f;
    border: 1px solid #22354d;
    color: #aac2d9;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 0.82rem;
  }

  .custom-label input {
    background: #101b29;
    border: 1px solid #2b4560;
    color: #dbe8f6;
    padding: 6px 8px;
    border-radius: 4px;
    font: inherit;
  }

  .apply-btn {
    background: #12301f;
    border-color: #2e7a4f;
    color: #d9f5e6;
  }

  .apply-btn:hover {
    background: #18452d;
    border-color: #43a66a;
  }

  .canvas-wrap {
    position: relative;
    width: min(900px, 100%);
    display: flex;
    justify-content: center;
  }

  .overlay {
    position: absolute;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    background: rgba(10, 20, 36, 0.9);
    color: #9dc2e8;
    border: 1px solid rgba(90, 130, 170, 0.35);
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.9rem;
    backdrop-filter: blur(6px);
  }

  .overlay.error {
    background: rgba(48, 12, 12, 0.92);
    color: #ff9d9d;
    border-color: rgba(180, 80, 80, 0.45);
  }

  canvas {
    display: block;
    border-radius: 10px;
  }
</style>