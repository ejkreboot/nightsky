<script lang="ts">
  import { onMount } from 'svelte';
  import { STARS, CONSTELLATIONS, CON_NAMES } from '$lib/stars';

  // Build HIP ID → array index lookup (constellation data uses HIP IDs)
  const hipToIndex = new Map<number, number>();
  STARS.forEach((s, i) => { if ((s as any).hip) hipToIndex.set((s as any).hip, i); });
  import { raDecToAltAz, project, gmst, dateToJD, aircraftToAltAz, DEG } from '$lib/coordinates';
  import { getPlanetPositions, PLANETS, PLANET_TEXTURE_URLS, createPlanetSprite } from '$lib/planets';
  import type { PlanetPosition } from '$lib/planets';
  import { classifySatellite, SAT_TYPE_LABELS, getSatelliteAltAz, fetchSatelliteTLEs, drawSatelliteVector } from '$lib/satellites';
  import type { SatRecord } from '$lib/satellites';
  import { fetchAircraft, getAircraftSvgKey, drawAircraftVector, aircraftSvgCatalog } from '$lib/aircraft';
  import type { AircraftData } from '$lib/aircraft';

  type AuroraBin = {
    lat: number;
    lon: number;
    p: number;
  };

  type AuroraFrame = {
    label: string;
    time: string;
    kp: number;
    bins: AuroraBin[];
  };

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0, H = 0;

  // View state
  let lat = 42.96, lon = -85.66;
  let centerAz = 180, centerAlt = 30;
  let fov = 60;
  let showLines = true, showLabels = true, showConNames = false;
  let showPlanets = true, showGrid = false;
  let showSatellites = true, showAircraft = true;
  let showAurora = true;
  let magLimit = 5.0;
  let isDragging = false, lastMX = 0, lastMY = 0;
  let mouseX = 0, mouseY = 0;
  let locationSet = false;
  let skyTimeAnchorMs: number | null = null;
  let skyTimeAnchorRealMs = 0;
  let hudDateEditing = false;
  let hudTimeEditing = false;
  let hudLocationEditing = false;
  let hudLocationDisplayEl: HTMLElement | null = null;
  let hudLocationEditorEl: HTMLElement | null = null;
  let hudLatInputEl: HTMLInputElement | null = null;
  let hudLonInputEl: HTMLInputElement | null = null;
  let hudDateDisplayEl: HTMLElement | null = null;
  let hudDateInputEl: HTMLInputElement | null = null;
  let hudTimeDisplayEl: HTMLElement | null = null;
  let hudTimeInputEl: HTMLInputElement | null = null;
  let hudAzValueEl: HTMLElement | null = null;
  let hudAltValueEl: HTMLElement | null = null;
  let hudFovValueEl: HTMLElement | null = null;
  let hudStarCountValueEl: HTMLElement | null = null;
  const hudTextCache = {
    location: '',
    date: '',
    time: '',
    az: '',
    alt: '',
    fov: '',
    stars: ''
  };
  let pinnedAircraftHex: string | null = null;
  let pinnedTooltipPos: { x: number; y: number } | null = null;
  let animFrame: number;
  const MOON_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/e/e1/FullMoon2010.jpg';
  let moonTexture: HTMLImageElement;
  let moonTextureReady = false;
  let moonTextureFailed = false;
  const planetSpriteCache: Record<string, HTMLCanvasElement | HTMLImageElement> = Object.create(null);
  const planetTextureState: Record<string, {loaded: boolean; failed: boolean; img: HTMLImageElement}> = Object.create(null);



  let starScreenPos: Array<{x: number; y: number} | null> = [];
  let planetScreenPos: Array<any> = [];
  let satScreenPos: Array<any> = [];
  let satData: SatRecord[] = [];
  let satFetchDone = false;
  let aircraftData: AircraftData[] = [];
  let aircraftScreenPos: Array<any> = [];
  let auroraFrame: AuroraFrame | null = null;
  let flightDataCache: Record<string, any> = {};
  let aircraftDataTimestamp = 0;
  let aircraftFetchInProgress = false;
  let auroraFetchKey = '';
  let auroraRequestSeq = 0;
  let lastAuroraFetchSkyMs = 0;
  let lastSatUpdateMs = 0;
  const SAT_UPDATE_INTERVAL = 60000;
  const AURORA_REFRESH_INTERVAL = 5 * 60 * 1000;
  const EARTH_RADIUS_KM = 6371;
  const AURORA_HEIGHT_KM = 110;

  function getSkyNow() {
    if (skyTimeAnchorMs === null) return new Date();
    return new Date(skyTimeAnchorMs + (Date.now() - skyTimeAnchorRealMs));
  }
  function setSkyNow(date: Date) {
    skyTimeAnchorMs = date.getTime();
    skyTimeAnchorRealMs = Date.now();
  }
  function formatDateInputValue(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function formatTimeInputValue(date: Date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  function setElementText(el: HTMLElement | null, value: string, cacheKey: keyof typeof hudTextCache) {
    if (!el || hudTextCache[cacheKey] === value) return;
    el.textContent = value;
    hudTextCache[cacheKey] = value;
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    if (locationSet) render();
  }

  function render() {
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(doRender);
  }

  function doRender() {
    const now = getSkyNow();
    maybeRefreshAurora(now);
    const jd = dateToJD(now);
    const lst = (gmst(jd) + lon) % 360;

    ctx.fillStyle = '#05080e';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const radius = Math.min(W, H) * 0.42;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
    grad.addColorStop(0, 'rgba(8, 16, 32, 0)');
    grad.addColorStop(0.8, 'rgba(8, 16, 32, 0)');
    grad.addColorStop(1, 'rgba(15, 25, 40, 0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawHorizon(cx, cy, radius, lst);
    if (showGrid) drawGrid(cx, cy, radius, lst);
    drawAuroraSky(cx, cy, radius);

    // Constellation lines
    starScreenPos = [];
    const starAltAz = STARS.map(s => raDecToAltAz(s.ra, s.dec, lat, lon, lst));

    if (showLines) {
      ctx.strokeStyle = 'rgba(80, 120, 180, 0.4)';
      ctx.lineWidth = 1.2;
      for (const con in CONSTELLATIONS) {
        let sumX = 0, sumY = 0, count = 0;
        for (const seg of CONSTELLATIONS[con]) {
          const i1 = hipToIndex.get(seg[0]);
          const i2 = hipToIndex.get(seg[1]);
          if (i1 === undefined || i2 === undefined) continue;
          const aa1 = starAltAz[i1];
          const aa2 = starAltAz[i2];
          if (aa1.alt < -2 && aa2.alt < -2) continue;
          if (STARS[i1].mag > magLimit || STARS[i2].mag > magLimit) continue;
          const p1 = project(aa1.alt, aa1.az, centerAz, centerAlt, fov, cx, cy, radius);
          const p2 = project(aa2.alt, aa2.az, centerAz, centerAlt, fov, cx, cy, radius);
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            sumX += p1.x + p2.x; sumY += p1.y + p2.y; count += 2;
          }
        }
        if (showConNames && count > 0) {
          const cx2 = sumX / count, cy2 = sumY / count;
          if (cx2 > 20 && cx2 < W - 20 && cy2 > 20 && cy2 < H - 20) {
            const label = CON_NAMES[con] || con;
            ctx.fillStyle = 'rgba(70, 100, 150, 0.5)';
            ctx.font = "300 11px 'Outfit', sans-serif";
            ctx.textAlign = 'center';
            ctx.fillText(label, cx2, cy2);
          }
        }
      }
    }

    // Stars
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i];
      const aa = starAltAz[i];
      if (aa.alt < -1 || s.mag > magLimit) { starScreenPos.push(null); continue; }
      const p = project(aa.alt, aa.az, centerAz, centerAlt, fov, cx, cy, radius);
      if (!p || p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) {
        starScreenPos.push(null); continue;
      }
      starScreenPos.push(p);
      const magScale = Math.max(0.15, (5.5 - s.mag) / 5.5);
      const sz = magScale * 1.6 * (120 / fov);
      const alpha = Math.min(1, magScale * 1.2);
      const col = 'rgb(210,220,235)';

      const rawGlowRadius = sz * (4.5 + Math.max(0, (3.0 - s.mag) * 1.0)) * (60 / fov);
      const glowRadiusCap = s.mag < 1.0 ? sz * 5 : sz * 20;
      const glowRadius = Math.min(rawGlowRadius, glowRadiusCap);
      const glowAlphaCap = s.mag < 1.0 ? 0.38 : 1;
      const glowAlpha = alpha * Math.min(glowAlphaCap, 0.28 + Math.max(0, (3.5 - s.mag)) * 0.05);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
      glow.addColorStop(0, col.replace('rgb', 'rgba').replace(')', `,${glowAlpha})`));
      glow.addColorStop(0.4, col.replace('rgb', 'rgba').replace(')', `,${glowAlpha * 0.4})`));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(p.x - glowRadius, p.y - glowRadius, glowRadius * 2, glowRadius * 2);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fill();

      if (s.mag < 1.0) {
        ctx.strokeStyle = col.replace('rgb', 'rgba').replace(')', ',0.15)');
        ctx.lineWidth = 0.5;
        const spikeLen = (2.0 - s.mag) * 5 * (120 / fov);
        ctx.beginPath();
        ctx.moveTo(p.x - spikeLen, p.y); ctx.lineTo(p.x + spikeLen, p.y);
        ctx.moveTo(p.x, p.y - spikeLen); ctx.lineTo(p.x, p.y + spikeLen);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (showLabels && s.n && s.mag < 3.5) {
        ctx.fillStyle = `rgba(140, 170, 210, ${Math.min(0.7, (3.5 - s.mag) / 3.5)})`;
        ctx.font = `${s.mag < 1 ? 11 : 10}px 'Outfit', sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(s.n, p.x + sz + 4, p.y + 3);
      }
    }

    // Planets
    planetScreenPos = [];
    if (showPlanets) {
      const planets = getPlanetPositions(now);
      for (const pl of planets) {
        const aa = raDecToAltAz(pl.ra, pl.dec, lat, lon, lst);
        if (aa.alt < -1) { planetScreenPos.push(null); continue; }
        const sp = project(aa.alt, aa.az, centerAz, centerAlt, fov, cx, cy, radius);
        if (!sp) { planetScreenPos.push(null); continue; }
        planetScreenPos.push({ ...sp, ...pl, alt: aa.alt, az: aa.az });

        const isMoon = pl.name === 'Moon';
        const sz = (isMoon ? 8.5 : 2) * (120 / fov);
        const planetImageRadius = isMoon ? sz : sz * 1.45;

        const glowRadius = isMoon ? planetImageRadius * 3.5 : planetImageRadius * 3.8;
        const planetGlow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, glowRadius);
        planetGlow.addColorStop(0, pl.color + (isMoon ? '55' : '40'));
        planetGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = planetGlow;
        ctx.fillRect(sp.x - glowRadius, sp.y - glowRadius, glowRadius * 2, glowRadius * 2);

        if (isMoon) {
          drawMoonDisc(sp.x, sp.y, planetImageRadius, pl);
        } else {
          const sprite = planetSpriteCache[pl.name];
          if (sprite) {
            const d = planetImageRadius * 2;
            ctx.drawImage(sprite, sp.x - d / 2, sp.y - d / 2, d, d);
          } else {
            ctx.fillStyle = pl.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, planetImageRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (showLabels) {
          ctx.fillStyle = pl.color + 'cc';
          ctx.font = "500 11px 'Outfit', sans-serif";
          ctx.textAlign = 'left';
          ctx.fillText(pl.name, sp.x + planetImageRadius + (isMoon ? 7 : 5), sp.y + 4);
        }
      }
    }

    // Satellites — recompute positions every 5 seconds, draw cached every frame
    const nowMs = Date.now();
    if (showSatellites && satData.length > 0 && nowMs - lastSatUpdateMs >= SAT_UPDATE_INTERVAL) {
      lastSatUpdateMs = nowMs;
      satScreenPos = [];
      computeSatellitePositions(now, lst, cx, cy, radius);
    }
    if (showSatellites) drawSatellitesOnCanvas(cx, cy, radius);

    // Aircraft — dead reckon from last fetch (no periodic re-fetch)
    if (showAircraft) {
      aircraftScreenPos = [];
      computeAircraftPositions(lst, cx, cy, radius);
      drawAircraftOnCanvas(cx, cy, radius);
    }

    drawCardinals(cx, cy, radius, lst);
    updateHUD(now, lst);
    updatePinnedTooltip();
    setTimeout(render, 1000);
  }

  function drawMoonDisc(x: number, y: number, radius: number, moon: any) {
    const moonRadius = radius * 0.86;
    const textureZoom = 1.28;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, moonRadius, 0, Math.PI * 2);
    ctx.clip();
    if (moonTextureReady) {
      const texHalf = moonRadius * textureZoom;
      ctx.drawImage(moonTexture, x - texHalf, y - texHalf, texHalf * 2, texHalf * 2);
    } else {
      const fallback = ctx.createRadialGradient(x - moonRadius * 0.35, y - moonRadius * 0.35, moonRadius * 0.15, x, y, moonRadius);
      fallback.addColorStop(0, '#f1efe6');
      fallback.addColorStop(1, '#bcb7aa');
      ctx.fillStyle = fallback;
      ctx.fillRect(x - moonRadius, y - moonRadius, moonRadius * 2, moonRadius * 2);
    }
    const displayIlluminated = Math.max(0, Math.min(1, 0.5 + (moon.illuminated - 0.5) * 0.78));
    const litRadiusX = moonRadius * displayIlluminated;
    const hemisphereFlip = lat < 0 ? -1 : 1;
    const litOnRight = moon.waxing ? hemisphereFlip > 0 : hemisphereFlip < 0;
    const offset = moonRadius - litRadiusX;
    const litCenterX = x + (litOnRight ? offset : -offset);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.arc(x, y, moonRadius, 0, Math.PI * 2);
    ctx.ellipse(litCenterX, y, litRadiusX, moonRadius, 0, 0, Math.PI * 2);
    ctx.fill('evenodd');
    ctx.restore();
  }

  function drawHorizon(cx: number, cy: number, radius: number, _lst: number) {
    const pts: Array<{x: number; y: number}> = [];
    for (let az = 0; az < 360; az += 2) {
      const p = project(0, az, centerAz, centerAlt, fov, cx, cy, radius);
      if (p) pts.push(p);
    }
    if (pts.length > 2) {
      ctx.strokeStyle = 'rgba(60, 100, 160, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x;
        const dy = pts[i].y - pts[i - 1].y;
        if (Math.abs(dx) < 200 && Math.abs(dy) < 200) ctx.lineTo(pts[i].x, pts[i].y);
        else ctx.moveTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function geodeticToECEF(latDeg: number, lonDeg: number, altKm = 0) {
    const latRad = latDeg * DEG;
    const lonRad = lonDeg * DEG;
    const r = EARTH_RADIUS_KM + altKm;

    return {
      x: r * Math.cos(latRad) * Math.cos(lonRad),
      y: r * Math.cos(latRad) * Math.sin(lonRad),
      z: r * Math.sin(latRad)
    };
  }

  function ecefToENU(
    dx: number,
    dy: number,
    dz: number,
    obsLatDeg: number,
    obsLonDeg: number
  ) {
    const latRad = obsLatDeg * DEG;
    const lonRad = obsLonDeg * DEG;

    const east =
      -Math.sin(lonRad) * dx +
      Math.cos(lonRad) * dy;

    const north =
      -Math.sin(latRad) * Math.cos(lonRad) * dx -
      Math.sin(latRad) * Math.sin(lonRad) * dy +
      Math.cos(latRad) * dz;

    const up =
      Math.cos(latRad) * Math.cos(lonRad) * dx +
      Math.cos(latRad) * Math.sin(lonRad) * dy +
      Math.sin(latRad) * dz;

    return { east, north, up };
  }

  function enuToAltAz(east: number, north: number, up: number) {
    const horizDist = Math.sqrt(east * east + north * north);
    const alt = Math.atan2(up, horizDist) / DEG;
    let az = Math.atan2(east, north) / DEG;
    if (az < 0) az += 360;
    const rangeKm = Math.sqrt(east * east + north * north + up * up);

    return { alt, az, rangeKm };
  }

  function auroraBinToAltAz(
    binLat: number,
    binLon: number,
    obsLat: number,
    obsLon: number,
    auroraHeightKm = AURORA_HEIGHT_KM
  ) {
    const obs = geodeticToECEF(obsLat, obsLon, 0);
    const aur = geodeticToECEF(binLat, binLon, auroraHeightKm);

    const dx = aur.x - obs.x;
    const dy = aur.y - obs.y;
    const dz = aur.z - obs.z;

    const enu = ecefToENU(dx, dy, dz, obsLat, obsLon);
    return enuToAltAz(enu.east, enu.north, enu.up);
  }

  function drawAuroraSky(cx: number, cy: number, radius: number) {
    if (!showAurora || !auroraFrame?.bins?.length) return;

    const nowMs = performance.now();

    // Collect visible aurora samples
    const samples: Array<{ x: number; y: number; effectiveP: number; alt: number; seed: number }> = [];
    for (let i = 0; i < auroraFrame.bins.length; i++) {
      const bin = auroraFrame.bins[i];
      if (bin.p < 3) continue;

      const aa = auroraBinToAltAz(bin.lat, bin.lon, lat, lon);
      if (aa.alt < -2) continue;

      const sp = project(aa.alt, aa.az, centerAz, centerAlt, fov, cx, cy, radius);
      if (!sp) continue;

      const rangeFade = Math.max(0.15, Math.min(1, 500 / aa.rangeKm));
      const altFade = Math.max(0.12, Math.min(1, (aa.alt + 2) / 20));
      const effectiveP = bin.p * rangeFade * altFade;
      if (effectiveP < 2) continue;

      samples.push({ x: sp.x, y: sp.y, effectiveP, alt: aa.alt, seed: i });
    }

    if (samples.length === 0) return;

    // Sort dim→bright so brighter patches accumulate on top
    samples.sort((a, b) => a.effectiveP - b.effectiveP);

    // Use additive compositing so overlapping blobs build up luminance naturally
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const scale = radius / 400;

    for (const s of samples) {
      const t = Math.min(s.effectiveP / 100, 1);

      // Motion: slow independent drift per bin (golden-ratio phase spread)
      const driftPhase = s.seed * 2.3999; // irrational spread → no two bins in sync
      const driftX = Math.sin(nowMs * 0.00022 + driftPhase) * 7 * scale;
      const driftY = Math.cos(nowMs * 0.00015 + driftPhase * 0.71) * 2.5 * scale;
      const px = s.x + driftX;
      const py = s.y + driftY;

      // Horizon extinction — atmospheric path length increases sharply below ~10°
      const horizonFade = Math.max(0, Math.min(1, s.alt / 10));

      // Low-frequency east-west ribbon modulation: varies brightness along the oval
      const ribbonNoise = 0.55 + 0.45 * Math.abs(Math.sin(s.x * 0.014 + nowMs * 0.000085));

      // Aurora palette: teal-green (low) → vivid green (mid) → yellow-white (high)
      let r: number, g: number, b: number;
      if (t < 0.35) {
        const u = t / 0.35;
        r = Math.round(5 + 20 * u);
        g = Math.round(140 + 80 * u);
        b = Math.round(90 + 50 * u);
      } else if (t < 0.68) {
        const u = (t - 0.35) / 0.33;
        r = Math.round(25 + 80 * u);
        g = Math.round(220 + 35 * u);
        b = Math.round(140 - 110 * u);
      } else {
        const u = (t - 0.68) / 0.32;
        r = Math.round(105 + 150 * u);
        g = Math.round(255);
        b = Math.round(30 - 20 * u);
      }

      const alpha = (0.028 + 0.13 * Math.pow(t, 0.55)) * horizonFade * ribbonNoise;

      // --- Blob pass: wide soft ellipse ---
      const rx = (22 + 72 * Math.pow(t, 0.6)) * scale;
      const ry = rx * 0.38;

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1, ry / rx);

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0,    `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},${(alpha * 0.35).toFixed(4)})`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- Ribbon/arc pass: very elongated east-west streak for curtain structure ---
      if (t > 0.12) {
        const arcAlpha = alpha * 0.42;
        const arcRx = rx * 4.8;
        const arcRy = ry * 0.45;

        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1, arcRy / arcRx);

        const arcGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, arcRx);
        arcGrad.addColorStop(0,   `rgba(${r},${g},${b},${arcAlpha})`);
        arcGrad.addColorStop(0.4, `rgba(${r},${g},${b},${(arcAlpha * 0.18).toFixed(4)})`);
        arcGrad.addColorStop(1,   `rgba(${r},${g},${b},0)`);

        ctx.fillStyle = arcGrad;
        ctx.beginPath();
        ctx.arc(0, 0, arcRx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();

    // Keep looping for motion animation while aurora is visible
    if (showAurora && auroraFrame?.bins?.length) {
      animFrame = requestAnimationFrame(doRender);
    }
  }

  function drawGrid(cx: number, cy: number, radius: number, _lst: number) {
    ctx.strokeStyle = 'rgba(50, 90, 140, 0.5)';
    ctx.lineWidth = 0.8;
    for (let alt = 0; alt <= 80; alt += 20) {
      const pts: Array<{x: number; y: number}> = [];
      for (let az = 0; az < 360; az += 3) {
        const p = project(alt, az, centerAz, centerAlt, fov, cx, cy, radius);
        if (p) pts.push(p);
      }
      if (pts.length > 2) {
        ctx.setLineDash(alt === 0 ? [] : [3, 5]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const dx = Math.abs(pts[i].x - pts[i - 1].x);
          const dy = Math.abs(pts[i].y - pts[i - 1].y);
          if (dx < 200 && dy < 200) ctx.lineTo(pts[i].x, pts[i].y);
          else ctx.moveTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
        if (alt > 0) {
          const labelP = project(alt, (centerAz + fov * 0.35) % 360, centerAz, centerAlt, fov, cx, cy, radius);
          if (labelP && labelP.x > 20 && labelP.x < W - 20 && labelP.y > 20 && labelP.y < H - 20) {
            ctx.fillStyle = 'rgba(60, 100, 150, 0.5)';
            ctx.font = "10px 'JetBrains Mono', monospace";
            ctx.textAlign = 'center';
            ctx.fillText(alt + '°', labelP.x, labelP.y - 4);
          }
        }
      }
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(50, 90, 140, 0.5)';
    for (let az = 0; az < 360; az += 30) {
      const pts: Array<{x: number; y: number}> = [];
      for (let alt = 0; alt <= 90; alt += 3) {
        const p = project(alt, az, centerAz, centerAlt, fov, cx, cy, radius);
        if (p) pts.push(p);
      }
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
  }

  function drawCardinals(cx: number, cy: number, radius: number, _lst: number) {
    const dirs: Array<[number, string, string]> = [
      [0, 'N', '#6a9bd1'], [90, 'E', '#556270'], [180, 'S', '#556270'], [270, 'W', '#556270'],
      [45, 'NE', '#3a4a5a'], [135, 'SE', '#3a4a5a'], [225, 'SW', '#3a4a5a'], [315, 'NW', '#3a4a5a']
    ];
    ctx.font = "600 12px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';
    for (const [az, label, color] of dirs) {
      const p = project(-2, az, centerAz, centerAlt, fov, cx, cy, radius);
      if (p && p.x > 10 && p.x < W - 10 && p.y > 10 && p.y < H - 10) {
        ctx.fillStyle = color;
        ctx.fillText(label, p.x, p.y + 5);
      }
    }
  }

  function computeSatellitePositions(now: Date, lst: number, cx: number, cy: number, radius: number) {
    for (const sat of satData) {
      const result = getSatelliteAltAz(sat.satrec, now, lat, lon);
      if (!result) continue;
      if (result.alt < 0) continue;
      const sp = project(result.alt, result.az, centerAz, centerAlt, fov, cx, cy, radius);
      if (!sp || sp.x < -50 || sp.x > W + 50 || sp.y < -50 || sp.y > H + 50) continue;
      const satType = classifySatellite(sat.name);
      satScreenPos.push({ ...sp, name: sat.name, alt: result.alt, az: result.az, rangeSat: result.rangeSat, satAltKm: result.satAltKm, satType });
    }
  }

  function drawSatellitesOnCanvas(cx: number, cy: number, radius: number) {
    const zoomScale = 120 / fov;
    for (const sp of satScreenPos) {
      if (!sp) continue;
      const vectorScale = (sp.satType === 'iss' ? 0.55 : 0.42) * zoomScale;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.globalAlpha = 0.85;
      drawSatelliteVector(ctx, sp.satType, vectorScale);
      ctx.globalAlpha = 1;
      ctx.restore();
      const labelOffsetX = 10 * vectorScale;
      if (showLabels && (fov < 50 || sp.name === 'ISS (ZARYA)')) {
        ctx.fillStyle = 'rgba(160, 200, 240, 0.6)';
        ctx.font = "300 9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'left';
        const label = sp.name === 'ISS (ZARYA)' ? 'ISS' : sp.name;
        ctx.fillText(label, sp.x + labelOffsetX + 3, sp.y + 3);
      }
    }
  }

  function computeAircraftPositions(lst: number, cx: number, cy: number, radius: number) {
    if (aircraftData.length === 0) return;
    const elapsed = (Date.now() - aircraftDataTimestamp) / 1000; // seconds since last fetch
    for (const aircraft of aircraftData) {
      try {
        const altMeters = (aircraft.alt_baro || 0) * 0.3048;
        // Dead-reckon position from heading and ground speed
        let acLat = aircraft.lat;
        let acLon = aircraft.lon;
        if (elapsed > 0 && aircraft.track !== undefined && aircraft.gs !== undefined && aircraft.gs > 0) {
          const trackRad = aircraft.track * DEG;
          const distNm = aircraft.gs * (elapsed / 3600); // nautical miles
          const distDeg = distNm / 60; // 1 nm = 1 arcminute = 1/60 degree
          acLat = aircraft.lat + distDeg * Math.cos(trackRad);
          acLon = aircraft.lon + distDeg * Math.sin(trackRad) / Math.cos(aircraft.lat * DEG);
        }
        const aa = aircraftToAltAz(acLat, acLon, altMeters, lat, lon);
        if (aa.alt < 5) continue;
        const sp = project(aa.alt, aa.az, centerAz, centerAlt, fov, cx, cy, radius);
        if (!sp || sp.x < -50 || sp.x > W + 50 || sp.y < -50 || sp.y > H + 50) continue;
        const cachedData = flightDataCache[aircraft.hex];
        const icaoType = cachedData?.aircraft?.icaoType;
        const svgKey = getAircraftSvgKey(icaoType);
        // Compute screen heading by projecting a point slightly ahead along track
        let screenHeading = 0;
        if (aircraft.track !== undefined) {
          const trackRad = aircraft.track * DEG;
          const step = 0.01; // ~1km
          const aheadLat = acLat + step * Math.cos(trackRad);
          const aheadLon = acLon + step * Math.sin(trackRad) / Math.cos(acLat * DEG);
          const aa2 = aircraftToAltAz(aheadLat, aheadLon, altMeters, lat, lon);
          const sp2 = project(aa2.alt, aa2.az, centerAz, centerAlt, fov, cx, cy, radius);
          if (sp2) {
            screenHeading = Math.atan2(sp2.x - sp.x, -(sp2.y - sp.y));
          }
        }
        aircraftScreenPos.push({ ...sp, ...aircraft, alt: aa.alt, az: aa.az, slantRange: aa.slantRange, groundDist: aa.groundDist, altMeters, svgKey, screenHeading });
      } catch (err) {
        console.error('Error computing aircraft position:', aircraft.hex, err);
      }
    }
  }

  function drawAircraftOnCanvas(cx: number, cy: number, radius: number) {
    if (aircraftScreenPos.length === 0) return;
    const zoomScale = 120 / fov;
    for (const ap of aircraftScreenPos) {
      const vectorScale = 0.35 * zoomScale;
      ctx.save();
      ctx.translate(ap.x, ap.y);
      ctx.rotate(ap.screenHeading || 0);
      ctx.globalAlpha = 0.85;
      drawAircraftVector(ctx, vectorScale, ap.svgKey || 'default');
      ctx.globalAlpha = 1;
      ctx.restore();
      const labelOffsetX = 10 * vectorScale;
      if (showLabels && fov < 55) {
        ctx.fillStyle = 'rgba(136, 180, 224, 0.8)';
        ctx.font = "300 9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'left';
        const label = ap.flight ? ap.flight.trim() : (ap.hex || 'Aircraft');
        ctx.fillText(label, ap.x + labelOffsetX + 3, ap.y + 3);
      }
    }
  }

  function updateHUD(now: Date, _lst: number) {
    const latStr = Math.abs(lat).toFixed(2) + '°' + (lat >= 0 ? 'N' : 'S');
    const lonStr = Math.abs(lon).toFixed(2) + '°' + (lon >= 0 ? 'E' : 'W');
    if (!hudLocationEditing) setElementText(hudLocationDisplayEl, `${latStr} / ${lonStr}`, 'location');

    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    if (!hudDateEditing) setElementText(hudDateDisplayEl, dateStr, 'date');
    if (!hudTimeEditing) setElementText(hudTimeDisplayEl, timeStr, 'time');

    const azStr = centerAz.toFixed(1) + '°';
    const altStr = centerAlt.toFixed(1) + '°';
    const visCount = starScreenPos.filter(p => p !== null).length;
    setElementText(hudAzValueEl, azStr, 'az');
    setElementText(hudAltValueEl, altStr, 'alt');
    setElementText(hudFovValueEl, fov.toFixed(0) + '°', 'fov');
    setElementText(hudStarCountValueEl, `${visCount} stars`, 'stars');
  }

  // Input handlers
  function onMouseDown(e: MouseEvent) {
    // If clicking on the tooltip itself, don't start dragging or dismiss pin
    const tooltipEl = document.getElementById('tooltip');
    if (tooltipEl && tooltipEl.contains(e.target as Node)) return;
    // Click to pin/unpin aircraft tooltip
    if (!isDragging) {
      const clickedAircraft = findClosestAircraft(e.clientX, e.clientY, 20);
      if (clickedAircraft) {
        pinnedAircraftHex = clickedAircraft.hex;
        pinnedTooltipPos = { x: e.clientX, y: e.clientY };
        updateTooltip(e.clientX, e.clientY);
        return;
      } else {
        pinnedAircraftHex = null;
        pinnedTooltipPos = null;
      }
    }
    isDragging = true; lastMX = e.clientX; lastMY = e.clientY;
  }
  function findClosestAircraft(mx: number, my: number, maxDist: number) {
    let closest: any = null, closestD = maxDist;
    for (const ap of aircraftScreenPos) {
      if (!ap) continue;
      const d = Math.sqrt((ap.x - mx) ** 2 + (ap.y - my) ** 2);
      if (d < closestD) { closest = ap; closestD = d; }
    }
    return closest;
  }
  function onMouseMove(e: MouseEvent) {
    mouseX = e.clientX; mouseY = e.clientY;
    if (isDragging) {
      const dx = e.clientX - lastMX;
      const dy = e.clientY - lastMY;
      centerAz = (centerAz + dx * 0.3 + 360) % 360;
      centerAlt = Math.max(-5, Math.min(60, centerAlt + dy * 0.3));
      lastMX = e.clientX; lastMY = e.clientY;
      lastSatUpdateMs = 0;
      render();
    }
    if (!pinnedAircraftHex) updateTooltip(e.clientX, e.clientY);
  }
  function onMouseUp() { isDragging = false; }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    fov = Math.max(20, Math.min(70, fov + e.deltaY * 0.1));
    lastSatUpdateMs = 0;
    render();
  }

  let touchStartDist = 0;
  let touchStartFov = 0;
  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1) {
      isDragging = true;
      lastMX = e.touches[0].clientX;
      lastMY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      touchStartDist = Math.sqrt(dx * dx + dy * dy);
      touchStartFov = fov;
    }
  }
  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - lastMX;
      const dy = e.touches[0].clientY - lastMY;
      centerAz = (centerAz + dx * 0.3 + 360) % 360;
      centerAlt = Math.max(-5, Math.min(60, centerAlt + dy * 0.3));
      lastMX = e.touches[0].clientX;
      lastMY = e.touches[0].clientY;
      lastSatUpdateMs = 0;
      render();
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      fov = Math.max(20, Math.min(70, touchStartFov * (touchStartDist / dist)));
      lastSatUpdateMs = 0;
      render();
    }
  }
  function onTouchEnd() { isDragging = false; }

  function updatePinnedTooltip() {
    if (!pinnedAircraftHex || !pinnedTooltipPos) return;
    // Only update the time-ago text, don't rebuild the whole tooltip
    const agoEl = document.querySelector('.tip-ago');
    if (agoEl) {
      const elapsedSec = Math.floor((Date.now() - aircraftDataTimestamp) / 1000);
      let agoText: string;
      if (elapsedSec < 60) agoText = `${elapsedSec}s ago`;
      else if (elapsedSec < 3600) agoText = `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s ago`;
      else agoText = `${Math.floor(elapsedSec / 3600)}h ${Math.floor((elapsedSec % 3600) / 60)}m ago`;
      agoEl.textContent = `\u23f1 ${agoText}`;
    }
  }

  function updateTooltip(mx: number, my: number) {
    const tooltip = document.getElementById('tooltip')!;
    let closest: any = null, closestDist = 20;

    for (const ap of aircraftScreenPos) {
      if (!ap) continue;
      const d = Math.sqrt((ap.x - mx) ** 2 + (ap.y - my) ** 2);
      if (d < closestDist) { closest = { type: 'aircraft', data: ap }; closestDist = d; }
    }
    for (const sp of satScreenPos) {
      if (!sp) continue;
      const d = Math.sqrt((sp.x - mx) ** 2 + (sp.y - my) ** 2);
      if (d < closestDist) { closest = { type: 'satellite', data: sp }; closestDist = d; }
    }
    for (const pp of planetScreenPos) {
      if (!pp) continue;
      const d = Math.sqrt((pp.x - mx) ** 2 + (pp.y - my) ** 2);
      if (d < closestDist) { closest = { type: 'planet', data: pp }; closestDist = d; }
    }
    for (let i = 0; i < starScreenPos.length; i++) {
      const sp = starScreenPos[i];
      if (!sp) continue;
      const d = Math.sqrt((sp.x - mx) ** 2 + (sp.y - my) ** 2);
      if (d < closestDist) { closest = { type: 'star', data: STARS[i], pos: sp }; closestDist = d; }
    }

    if (closest) {
      tooltip.style.display = 'block';
      tooltip.style.left = (mx + 16) + 'px';
      tooltip.style.top = (my - 10) + 'px';
      tooltip.style.pointerEvents = 'none';
      const tipName = document.getElementById('tip-name')!;
      const tipDetail = document.getElementById('tip-detail')!;

      if (closest.type === 'aircraft') {
        const ac = closest.data;
        const label = ac.flight ? ac.flight.trim() : (ac.hex || 'Aircraft');
        tipName.textContent = `✈ ${label}`;
        const altFt = Math.round(ac.alt_baro || 0);
        const speed = ac.gs !== undefined ? Math.round(ac.gs) : '?';
        const heading = ac.track !== undefined ? Math.round(ac.track) : '?';
        const cached = flightDataCache[ac.hex];
        const icaoType = cached?.aircraft?.icaoType;
        let baseHtml = (icaoType ? `${icaoType}<br>` : '') + `Alt ${ac.alt.toFixed(1)}° Az ${ac.az.toFixed(1)}°<br>Altitude ${altFt.toLocaleString()} ft<br>Speed ${speed} kts · Heading ${heading}°<br>Range ${ac.slantRange.toFixed(1)} km`;
        if (cached && cached.origin && cached.destination) {
          const routeHtml = `<br>${cached.origin.iata || cached.origin.icao || '?'} → ${cached.destination.iata || cached.destination.icao || '?'}`;
          baseHtml += routeHtml;
        }
        // Time since last update + refresh (only when pinned)
        const elapsedSec = Math.floor((Date.now() - aircraftDataTimestamp) / 1000);
        let agoText: string;
        if (elapsedSec < 60) agoText = `${elapsedSec}s ago`;
        else if (elapsedSec < 3600) agoText = `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s ago`;
        else agoText = `${Math.floor(elapsedSec / 3600)}h ${Math.floor((elapsedSec % 3600) / 60)}m ago`;
        const isPinned = pinnedAircraftHex === ac.hex;
        if (isPinned) {
          baseHtml += `<div class="tip-update-row"><span class="tip-ago">⏱ ${agoText}</span><button class="tip-refresh-btn" id="tip-refresh-aircraft">↻ Refresh</button></div>`;
          tooltip.style.pointerEvents = 'auto';
        } else {
          baseHtml += `<div class="tip-update-row"><span class="tip-ago">⏱ ${agoText}</span><span class="tip-ago">click to pin</span></div>`;
        }
        tipDetail.innerHTML = baseHtml;
        if (isPinned) {
          const refreshBtn = document.getElementById('tip-refresh-aircraft');
          if (refreshBtn) {
            refreshBtn.onclick = (e) => { e.stopPropagation(); refreshAircraft(); };
          }
        }
      } else if (closest.type === 'satellite') {
        const s = closest.data;
        const typeLabel = SAT_TYPE_LABELS[s.satType] || 'Satellite';
        const displayName = s.name === 'ISS (ZARYA)' ? 'ISS' : s.name;
        tipName.textContent = `🛰 ${displayName}`;
        tipDetail.innerHTML = `${typeLabel}<br>Alt ${s.alt.toFixed(1)}° Az ${s.az.toFixed(1)}°<br>Range ${Math.round(s.rangeSat).toLocaleString()} km<br>Orbit alt ${Math.round(s.satAltKm).toLocaleString()} km`;
      } else if (closest.type === 'planet') {
        const p = closest.data;
        tipName.textContent = `${p.symbol} ${p.name}`;
        if (p.name === 'Moon') {
          const distKm = Math.round(p.dist * 149597870.7);
          tipDetail.innerHTML = `Alt ${p.alt.toFixed(1)}° Az ${p.az.toFixed(1)}°<br>${p.phaseName} · ${(p.illuminated * 100).toFixed(0)}% lit<br>RA ${(p.ra).toFixed(2)}h Dec ${(p.dec).toFixed(1)}°<br>Dist ${distKm.toLocaleString()} km`;
        } else {
          tipDetail.innerHTML = `Alt ${p.alt.toFixed(1)}° Az ${p.az.toFixed(1)}°<br>RA ${(p.ra).toFixed(2)}h Dec ${(p.dec).toFixed(1)}°<br>Dist ${p.dist.toFixed(2)} AU`;
        }
      } else {
        const s = closest.data;
        const name = s.n || s.bf || `HIP ${s.hip}`;
        const conName = CON_NAMES[s.con] || s.con;
        tipName.textContent = name;
        tipDetail.innerHTML = `Mag ${s.mag.toFixed(2)} · ${conName}<br>RA ${s.ra.toFixed(3)}h Dec ${s.dec.toFixed(2)}°` + (s.bf && s.bf !== name ? `<br>${s.bf}` : '');
      }
      const rect = tooltip.getBoundingClientRect();
      if (rect.right > W) tooltip.style.left = (mx - rect.width - 10) + 'px';
      if (rect.bottom > H) tooltip.style.top = (my - rect.height - 10) + 'px';
    } else {
      tooltip.style.display = 'none';
      tooltip.style.pointerEvents = 'none';
    }
  }

  // Toggle functions
  function toggleLines() { showLines = !showLines; document.getElementById('btn-lines')?.classList.toggle('active', showLines); render(); }
  function toggleNames() { showLabels = !showLabels; document.getElementById('btn-names')?.classList.toggle('active', showLabels); render(); }
  function toggleConNames() { showConNames = !showConNames; document.getElementById('btn-connames')?.classList.toggle('active', showConNames); render(); }
  function togglePlanets() { showPlanets = !showPlanets; document.getElementById('btn-planets')?.classList.toggle('active', showPlanets); render(); }
  function toggleAurora() {
    showAurora = !showAurora;
    document.getElementById('btn-aurora')?.classList.toggle('active', showAurora);
    if (showAurora) {
      void refreshAuroraForSkyTime(true);
    }
    render();
  }
  function toggleGrid() { showGrid = !showGrid; document.getElementById('btn-grid')?.classList.toggle('active', showGrid); render(); }
  function onMagSlider(val: string) { magLimit = parseFloat(val); const el = document.getElementById('mag-value'); if (el) el.textContent = magLimit.toFixed(1); render(); }

  function toggleSats() { showSatellites = !showSatellites; document.getElementById('btn-sats')?.classList.toggle('active', showSatellites); render(); }
  function toggleAircraftBtn() { showAircraft = !showAircraft; document.getElementById('btn-aircraft')?.classList.toggle('active', showAircraft); render(); }

  // HUD location editor (combined lat/lon)
  function beginLocationEdit() {
    if (hudLocationEditing || hudDateEditing || hudTimeEditing) return;
    hudLocationEditing = true;
    const display = hudLocationDisplayEl!;
    const editor = hudLocationEditorEl!;
    const latInput = hudLatInputEl!;
    const lonInput = hudLonInputEl!;
    latInput.value = lat.toFixed(4);
    lonInput.value = lon.toFixed(4);
    display.style.display = 'none';
    editor.style.display = 'flex';
    latInput.focus();
    latInput.select();
  }
  function endLocationEdit(commit: boolean) {
    if (!hudLocationEditing) return;
    if (commit) {
      const latInput = hudLatInputEl!;
      const lonInput = hudLonInputEl!;
      const newLat = parseFloat(latInput.value);
      const newLon = parseFloat(lonInput.value);
      const changed = Number.isFinite(newLat) && Number.isFinite(newLon) &&
        newLat >= -90 && newLat <= 90 && newLon >= -180 && newLon <= 180 &&
        (newLat !== lat || newLon !== lon);
      if (changed) {
        lat = newLat;
        lon = newLon;
        refreshAircraft();
        void refreshAuroraForSkyTime(true);
      }
    }
    hudLocationEditing = false;
    hudLocationEditorEl!.style.display = 'none';
    hudLocationDisplayEl!.style.display = 'inline';
    render();
  }

  // HUD date/time editors
  function beginDateEdit() {
    if (hudDateEditing || hudTimeEditing) return;
    hudDateEditing = true;
    const now = getSkyNow();
    const display = hudDateDisplayEl!;
    const input = hudDateInputEl!;
    input.value = formatDateInputValue(now);
    display.style.display = 'none';
    input.style.display = 'inline-block';
    input.focus();
  }
  function endDateEdit(commit: boolean) {
    if (!hudDateEditing) return;
    const input = hudDateInputEl!;
    if (commit && input.value) {
      const [y, m, d] = input.value.split('-').map(Number);
      if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
        const updated = getSkyNow();
        updated.setFullYear(y, m - 1, d);
        setSkyNow(updated);
        void refreshAuroraForSkyTime(true);
      }
    }
    hudDateEditing = false;
    input.style.display = 'none';
    hudDateDisplayEl!.style.display = 'inline';
    render();
  }
  function beginTimeEdit() {
    if (hudTimeEditing || hudDateEditing) return;
    hudTimeEditing = true;
    const now = getSkyNow();
    const display = hudTimeDisplayEl!;
    const input = hudTimeInputEl!;
    input.value = formatTimeInputValue(now);
    display.style.display = 'none';
    input.style.display = 'inline-block';
    input.focus();
  }
  function endTimeEdit(commit: boolean) {
    if (!hudTimeEditing) return;
    const input = hudTimeInputEl!;
    if (commit && input.value) {
      const parts = input.value.split(':').map(Number);
      const hh = parts[0] || 0;
      const mm = parts[1] || 0;
      const ss = parts[2] || 0;
      const updated = getSkyNow();
      updated.setHours(hh, mm, ss, 0);
      setSkyNow(updated);
      void refreshAuroraForSkyTime(true);
    }
    hudTimeEditing = false;
    input.style.display = 'none';
    hudTimeDisplayEl!.style.display = 'inline';
    render();
  }

  function loadMoonTexture() {
    if (moonTextureReady || moonTextureFailed || moonTexture.src) return;
    moonTexture.crossOrigin = 'anonymous';
    moonTexture.decoding = 'async';
    moonTexture.onload = () => { moonTextureReady = true; if (locationSet) render(); };
    moonTexture.onerror = () => { moonTextureFailed = true; };
    moonTexture.src = MOON_TEXTURE_URL;
  }

  function buildPlanetSprites() {
    for (const planet of PLANETS) {
      planetSpriteCache[planet.name] = createPlanetSprite(planet);
    }
  }

  function loadPlanetTextures() {
    for (const planet of PLANETS) {
      const url = PLANET_TEXTURE_URLS[planet.name];
      if (!url) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      planetTextureState[planet.name] = { loaded: false, failed: false, img };
      img.onload = () => {
        planetTextureState[planet.name].loaded = true;
        planetSpriteCache[planet.name] = img;
        if (locationSet) render();
      };
      img.onerror = () => { planetTextureState[planet.name].failed = true; };
      img.src = url;
    }
  }

  function initHudLocationEditor() {
    document.getElementById('hud-location')!.innerHTML =
      `<span class="hud-value hud-editable" id="hud-loc-display" title="Click to edit location"></span>` +
      `<span id="hud-loc-editor" class="hud-loc-editor" style="display:none;">` +
        `<input id="hud-lat-input" class="hud-inline-input" type="text" inputmode="decimal" placeholder="Lat" style="width:6em;">` +
        `<input id="hud-lon-input" class="hud-inline-input" type="text" inputmode="decimal" placeholder="Lon" style="width:6em;">` +
        `<button class="hud-loc-btn hud-loc-accept" id="hud-loc-accept">✓</button>` +
        `<button class="hud-loc-btn hud-loc-cancel" id="hud-loc-cancel">✕</button>` +
      `</span>`;

    hudLocationDisplayEl = document.getElementById('hud-loc-display');
    hudLocationEditorEl = document.getElementById('hud-loc-editor');
    hudLatInputEl = document.getElementById('hud-lat-input') as HTMLInputElement;
    hudLonInputEl = document.getElementById('hud-lon-input') as HTMLInputElement;

    hudLocationDisplayEl!.addEventListener('click', beginLocationEdit);
    document.getElementById('hud-loc-accept')!.addEventListener('click', () => endLocationEdit(true));
    document.getElementById('hud-loc-cancel')!.addEventListener('click', () => endLocationEdit(false));

    const latInput = hudLatInputEl!;
    const lonInput = hudLonInputEl!;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); endLocationEdit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); endLocationEdit(false); }
    };
    latInput.addEventListener('keydown', handleKey);
    lonInput.addEventListener('keydown', handleKey);
  }

  function initHudDateTimeEditor() {
    document.getElementById('hud-time')!.innerHTML =
      `Date <span class="hud-value hud-editable" id="hud-date-display" title="Click to edit date"></span>` +
      `<input id="hud-date-input" class="hud-inline-input" type="date" style="display:none;">` +
      ` · Time <span class="hud-value hud-editable" id="hud-time-display" title="Click to edit time"></span>` +
      `<input id="hud-time-input" class="hud-inline-input" type="time" step="1" style="display:none;">`;

    hudDateDisplayEl = document.getElementById('hud-date-display');
    hudDateInputEl = document.getElementById('hud-date-input') as HTMLInputElement;
    hudTimeDisplayEl = document.getElementById('hud-time-display');
    hudTimeInputEl = document.getElementById('hud-time-input') as HTMLInputElement;


    hudDateDisplayEl!.addEventListener('click', beginDateEdit);
    hudTimeDisplayEl!.addEventListener('click', beginTimeEdit);

    const dateInput = hudDateInputEl!;
    dateInput.addEventListener('blur', () => { if (hudDateEditing) endDateEdit(true); });
    dateInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); endDateEdit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); endDateEdit(false); }
    });

    const timeInput = hudTimeInputEl!;
    timeInput.addEventListener('blur', () => { if (hudTimeEditing) endTimeEdit(true); });
    timeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); endTimeEdit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); endTimeEdit(false); }
    });
  }

  function initHudStatusFields() {
    document.getElementById('hud-az')!.innerHTML =
      `Az <span class="hud-value" id="hud-az-value"></span> Alt <span class="hud-value" id="hud-alt-value"></span>`;
    document.getElementById('hud-fov')!.innerHTML =
      `FOV <span class="hud-value" id="hud-fov-value"></span> · <span class="hud-value" id="hud-star-count-value"></span>`;

    hudAzValueEl = document.getElementById('hud-az-value');
    hudAltValueEl = document.getElementById('hud-alt-value');
    hudFovValueEl = document.getElementById('hud-fov-value');
    hudStarCountValueEl = document.getElementById('hud-star-count-value');
  }

  function useGeolocation() {
    navigator.geolocation.getCurrentPosition(pos => {
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
      locationSet = true;
      document.getElementById('location-prompt')!.style.display = 'none';
      startRendering();
    }, () => {
      alert('Geolocation failed. Please enter coordinates manually.');
    });
  }

  function applyManualLocation() {
    lat = parseFloat((document.getElementById('inp-lat') as HTMLInputElement).value) || 42.96;
    lon = parseFloat((document.getElementById('inp-lon') as HTMLInputElement).value) || -85.66;
    locationSet = true;
    document.getElementById('location-prompt')!.style.display = 'none';
    startRendering();
  }

  async function refreshAuroraForSkyTime(force = false) {
    if (!locationSet || !showAurora) return;

    const now = getSkyNow();
    const key = `${lat.toFixed(3)},${lon.toFixed(3)},${now.toISOString().slice(0, 16)}`;
    if (!force && key === auroraFetchKey) return;

    auroraFetchKey = key;
    lastAuroraFetchSkyMs = now.getTime();
    const requestSeq = ++auroraRequestSeq;

    try {
      const res = await fetch(`/api/aurora-forecast?time=${encodeURIComponent(now.toISOString())}`);
      if (!res.ok) {
        if (requestSeq === auroraRequestSeq) auroraFetchKey = '';
        return;
      }

      const data = await res.json();
      if (requestSeq !== auroraRequestSeq) return;

      auroraFrame = data.frames?.[0] ?? null;
      render();
    } catch {
      if (requestSeq === auroraRequestSeq) auroraFetchKey = '';
    }
  }

  function maybeRefreshAurora(now: Date) {
    if (!locationSet || !showAurora) return;
    if (Math.abs(now.getTime() - lastAuroraFetchSkyMs) < AURORA_REFRESH_INTERVAL) return;
    void refreshAuroraForSkyTime();
  }

  function refreshAircraft() {
    if (aircraftFetchInProgress) return;
    aircraftFetchInProgress = true;
    fetchAircraft(lat, lon, 800).then(data => {
      aircraftFetchInProgress = false;
      console.log(`Aircraft loaded: ${data.length}`);
      if (data.length > 0) {
        aircraftData = data;
        aircraftDataTimestamp = Date.now();
        aircraftData.forEach(ac => {
          if (ac.hex && (ac.dep_iata || ac.dep_icao)) {
            flightDataCache[ac.hex] = {
              origin: { iata: ac.dep_iata, icao: ac.dep_icao },
              destination: { iata: ac.arr_iata, icao: ac.arr_icao },
              aircraft: ac.aircraft_icao ? { icaoType: ac.aircraft_icao } : undefined,
              timestamp: Date.now()
            };
          }
        });
      }
    }).catch(() => { aircraftFetchInProgress = false; });
  }

  function startRendering() {
    fetchSatelliteTLEs().then(data => { satData = data; satFetchDone = true; render(); });
    refreshAircraft();
    void refreshAuroraForSkyTime(true);
    render();
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    moonTexture = new Image();
    initHudLocationEditor();
    initHudDateTimeEditor();
    initHudStatusFields();
    loadMoonTexture();
    buildPlanetSprites();
    loadPlanetTextures();
    document.getElementById('btn-aurora')?.classList.toggle('active', showAurora);
    document.getElementById('btn-aircraft')?.classList.toggle('active', showAircraft);
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    document.getElementById('loading')!.style.display = 'none';

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { lat = pos.coords.latitude; lon = pos.coords.longitude; locationSet = true; startRendering(); },
        () => { document.getElementById('location-prompt')!.style.display = 'block'; },
        { timeout: 5000 }
      );
    } else {
      document.getElementById('location-prompt')!.style.display = 'block';
    }
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&family=Outfit:wght@200;300;400;600&display=swap" rel="stylesheet">
</svelte:head>

<canvas bind:this={canvas} id="sky"></canvas>

<div id="hud">
  <div class="hud-left">
    <div class="hud-title">Night Sky</div>
    <div class="hud-label" id="hud-location"></div>
    <div class="hud-label" id="hud-time"></div>
  </div>
  <div class="hud-right">
    <div class="hud-label" id="hud-az"></div>
    <div class="hud-label" id="hud-fov"></div>
  </div>
</div>

<div id="tooltip">
  <div class="tip-name" id="tip-name"></div>
  <div class="tip-detail" id="tip-detail"></div>
</div>

<div id="controls">
  <button class="ctrl-btn active" id="btn-lines" on:click={toggleLines}>Lines</button>
  <button class="ctrl-btn active" id="btn-names" on:click={toggleNames}>Names</button>
  <button class="ctrl-btn" id="btn-connames" on:click={toggleConNames}>Constellations</button>
  <button class="ctrl-btn active" id="btn-planets" on:click={togglePlanets}>Planets</button>
  <button class="ctrl-btn active" id="btn-aurora" on:click={toggleAurora}>Aurora</button>
  <button class="ctrl-btn active" id="btn-sats" on:click={toggleSats}>Satellites</button>
  <button class="ctrl-btn active" id="btn-aircraft" on:click={toggleAircraftBtn}>Aircraft</button>
  <div class="mag-slider-wrap">
    <label class="mag-label" for="mag-slider">Mag ≤ <span id="mag-value">6.0</span></label>
    <input type="range" id="mag-slider" min="-1.5" max="6.0" step="0.1" value="6.0" on:input={(e) => onMagSlider(e.currentTarget.value)}>
  </div>
</div>

<div id="loading">Initializing...</div>

<div id="location-prompt">
  <div class="prompt-title">Set Your Location</div>
  <div>
    <input type="text" id="inp-lat" placeholder="Lat" value="42.96">
    <input type="text" id="inp-lon" placeholder="Lon" value="-85.66">
  </div>
  <div class="prompt-or">— or —</div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="prompt-geo" on:click={useGeolocation} on:keypress={useGeolocation}>Use device GPS</div>
  <button on:click={applyManualLocation}>View Sky</button>
</div>

<style>
  :global(*) { margin: 0; padding: 0; box-sizing: border-box; }
  :global(body) {
    background: #000;
    color: #c8d0d8;
    font-family: 'Outfit', sans-serif;
    overflow: hidden;
    height: 100vh;
    width: 100vw;
    cursor: crosshair;
  }

  canvas { display: block; position: absolute; top: 0; left: 0; }

  #hud {
    position: absolute; top: 0; left: 0; right: 0;
    padding: 16px 20px; display: flex; justify-content: space-between; align-items: flex-start;
    pointer-events: none; z-index: 10;
  }
  #hud > :global(*) { pointer-events: auto; }
  .hud-left, .hud-right { display: flex; flex-direction: column; gap: 4px; }
  .hud-right { align-items: flex-end; }
  .hud-title { font-size: 13px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #6a9bd1; font-family: 'JetBrains Mono', monospace; }
  .hud-label { font-size: 11px; font-weight: 300; letter-spacing: 1px; color: #556270; font-family: 'JetBrains Mono', monospace; }
  :global(.hud-value) { color: #8a9bae; }
  :global(.hud-editable) { cursor: pointer; border-bottom: 1px dashed rgba(138, 155, 174, 0.45); padding-bottom: 1px; }
  :global(.hud-editable:hover) { color: #b7c7d8; border-bottom-color: rgba(183, 199, 216, 0.7); }
  :global(.hud-inline-input) {
    background: rgba(20, 28, 40, 0.9); border: 1px solid rgba(100, 140, 200, 0.4);
    color: #c8d0d8; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    padding: 1px 4px; border-radius: 4px; outline: none;
  }
  :global(.hud-inline-input:focus) { border-color: rgba(100, 160, 220, 0.7); }

  #tooltip {
    position: absolute; display: none;
    background: rgba(8, 12, 20, 0.92); border: 1px solid rgba(100, 140, 200, 0.25);
    border-radius: 6px; padding: 8px 12px;
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    pointer-events: none; z-index: 20; backdrop-filter: blur(8px); max-width: 220px;
  }
  .tip-name { color: #9dc0eb; font-weight: 500; font-size: 13px; margin-bottom: 2px; }
  .tip-detail { color: #5a6a7a; font-size: 10px; line-height: 1.5; }
  :global(.tip-update-row) {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(100, 140, 200, 0.12);
  }
  :global(.tip-ago) { color: #4a5a6a; font-size: 9px; letter-spacing: 0.5px; }
  :global(.tip-refresh-btn) {
    background: rgba(40, 70, 110, 0.5); border: 1px solid rgba(100, 160, 220, 0.25);
    color: #7a9bc0; font-family: 'JetBrains Mono', monospace; font-size: 9px;
    padding: 2px 7px; border-radius: 3px; cursor: pointer; letter-spacing: 0.5px;
    transition: all 0.15s; white-space: nowrap;
  }
  :global(.tip-refresh-btn:hover) {
    background: rgba(50, 90, 140, 0.6); border-color: rgba(100, 160, 220, 0.5);
    color: #9dc0eb;
  }

  :global(.hud-loc-editor) {
    display: flex; align-items: center; gap: 4px;
  }
  :global(.hud-loc-btn) {
    background: rgba(20, 28, 40, 0.9); border: 1px solid rgba(100, 140, 200, 0.3);
    color: #7a8a9a; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    width: 22px; height: 22px; padding: 0; border-radius: 3px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  :global(.hud-loc-accept:hover) { border-color: rgba(80, 180, 120, 0.6); color: #6cc090; }
  :global(.hud-loc-cancel:hover) { border-color: rgba(200, 90, 90, 0.5); color: #c07070; }

  #controls {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
    z-index: 10; width: max-content; max-width: calc(100vw - 24px);
  }
  .ctrl-btn {
    background: rgba(20, 28, 40, 0.85); border: 1px solid rgba(100, 140, 200, 0.2);
    color: #7a8a9a; font-family: 'JetBrains Mono', monospace; font-size: 10px;
    letter-spacing: 1px; padding: 8px 14px; border-radius: 4px; cursor: pointer;
    transition: all 0.2s; text-transform: uppercase; backdrop-filter: blur(8px); white-space: nowrap;
  }
  .ctrl-btn:hover { border-color: rgba(100, 160, 220, 0.5); color: #a0b8d0; }
  :global(.ctrl-btn.active) { border-color: rgba(100, 160, 220, 0.6); color: #9dc0eb; background: rgba(30, 50, 80, 0.6); }

  .mag-slider-wrap {
    display: flex; align-items: center; gap: 8px;
    background: rgba(20, 28, 40, 0.85); border: 1px solid rgba(100, 140, 200, 0.2);
    border-radius: 4px; padding: 6px 12px; backdrop-filter: blur(8px);
  }
  .mag-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 1px; color: #7a8a9a; white-space: nowrap; text-transform: uppercase; }
  .mag-label :global(span) { color: #9dc0eb; }
  #mag-slider {
    -webkit-appearance: none; appearance: none; width: 100px; height: 3px;
    background: rgba(60, 100, 160, 0.3); border-radius: 2px; outline: none;
  }
  #mag-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 14px; height: 14px;
    border-radius: 50%; background: #6a9bd1; cursor: pointer; border: 1px solid rgba(100, 160, 220, 0.5);
  }
  #mag-slider::-moz-range-thumb {
    width: 14px; height: 14px; border-radius: 50%; background: #6a9bd1;
    cursor: pointer; border: 1px solid rgba(100, 160, 220, 0.5);
  }

  @media (max-width: 540px) {
    #controls { bottom: 10px; gap: 6px; }
    .ctrl-btn { font-size: 9px; padding: 7px 10px; letter-spacing: 0.5px; }
    .mag-slider-wrap { padding: 5px 10px; }
    .mag-label { font-size: 9px; letter-spacing: 0.5px; }
    #mag-slider { width: 80px; }
  }

  #loading {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #4a5a6a;
    letter-spacing: 3px; text-transform: uppercase; z-index: 100;
  }

  #location-prompt {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    text-align: center; z-index: 100; display: none;
  }
  #location-prompt .prompt-title {
    font-size: 14px; font-weight: 300; letter-spacing: 3px;
    color: #6a9bd1; margin-bottom: 20px; text-transform: uppercase;
  }
  #location-prompt input {
    background: rgba(20, 28, 40, 0.9); border: 1px solid rgba(100, 140, 200, 0.3);
    color: #a0b8d0; font-family: 'JetBrains Mono', monospace; font-size: 13px;
    padding: 10px 14px; border-radius: 4px; width: 120px; text-align: center;
    margin: 0 4px; outline: none;
  }
  #location-prompt input:focus { border-color: rgba(100, 160, 220, 0.6); }
  #location-prompt button {
    display: block; margin: 16px auto 0;
    background: rgba(40, 70, 110, 0.7); border: 1px solid rgba(100, 160, 220, 0.4);
    color: #9dc0eb; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    letter-spacing: 2px; text-transform: uppercase; padding: 10px 24px; border-radius: 4px; cursor: pointer;
  }
  .prompt-or { color: #3a4a5a; font-size: 11px; margin: 12px 0; letter-spacing: 2px; }
  .prompt-geo { color: #5a7a9a; font-size: 11px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
  .prompt-geo:hover { color: #8ab0d8; }
</style>