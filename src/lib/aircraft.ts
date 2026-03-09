export interface AircraftData {
  hex: string;
  flight?: string;
  lat: number;
  lon: number;
  alt_baro: number;
  gs?: number;
  track?: number;
  aircraft_icao?: string;
  dep_icao?: string;
  dep_iata?: string;
  arr_icao?: string;
  arr_iata?: string;
  airline_icao?: string;
  airline_iata?: string;
  reg_number?: string;
  status?: string;
  [key: string]: unknown;
}

export const ICAOTypeToSVG: Record<string, string> = {
  "A318": "jet_airliner", "A319": "jet_airliner", "A320": "jet_airliner", "A321": "jet_airliner",
  "A19N": "jet_airliner", "A20N": "jet_airliner", "A21N": "jet_airliner", "A220": "jet_airliner",
  "BCS1": "jet_airliner", "BCS3": "jet_airliner",
  "B731": "jet_airliner", "B732": "jet_airliner", "B733": "jet_airliner", "B734": "jet_airliner",
  "B735": "jet_airliner", "B736": "jet_airliner", "B737": "jet_airliner", "B738": "jet_airliner",
  "B739": "jet_airliner", "B37M": "jet_airliner", "B38M": "jet_airliner", "B39M": "jet_airliner",
  "B3XM": "jet_airliner", "B752": "jet_airliner", "B753": "jet_airliner",
  "CRJ1": "jet_regional", "CRJ2": "jet_regional", "CRJ7": "jet_regional",
  "CRJ9": "jet_regional", "CRJX": "jet_regional",
  "E170": "jet_regional", "E175": "jet_regional", "E190": "jet_regional", "E195": "jet_regional",
  "E290": "jet_regional", "E295": "jet_regional", "E75L": "jet_regional", "E75S": "jet_regional",
  "AT43": "turboprop_regional", "AT45": "turboprop_regional", "AT46": "turboprop_regional",
  "AT72": "turboprop_regional", "AT75": "turboprop_regional",
  "DH8A": "turboprop_regional", "DH8B": "turboprop_regional", "DH8C": "turboprop_regional",
  "DH8D": "turboprop_regional", "Q400": "turboprop_regional",
  "SF34": "turboprop_regional", "JS32": "turboprop_regional",
  "A300": "jet_heavy", "A306": "jet_heavy", "A310": "jet_heavy",
  "A330": "jet_heavy", "A332": "jet_heavy", "A333": "jet_heavy",
  "A338": "jet_heavy", "A339": "jet_heavy",
  "A350": "jet_heavy", "A359": "jet_heavy", "A35K": "jet_heavy",
  "A380": "jet_heavy", "A388": "jet_heavy",
  "B762": "jet_heavy", "B763": "jet_heavy", "B764": "jet_heavy", "B767": "jet_heavy",
  "B772": "jet_heavy", "B77L": "jet_heavy", "B77W": "jet_heavy",
  "B778": "jet_heavy", "B779": "jet_heavy",
  "B787": "jet_heavy", "B788": "jet_heavy", "B789": "jet_heavy", "B78X": "jet_heavy",
  "B744": "jet_heavy", "B748": "jet_heavy",
  "B77F": "jet_heavy", "B748F": "jet_heavy", "B744F": "jet_heavy",
  "A332F": "jet_heavy", "MD11": "jet_heavy", "MD11F": "jet_heavy", "DC10": "jet_heavy",
  "C25A": "jet_biz", "C25B": "jet_biz", "C25C": "jet_biz",
  "C510": "jet_biz", "C525": "jet_biz", "C560": "jet_biz",
  "C650": "jet_biz", "C680": "jet_biz", "C68A": "jet_biz", "C700": "jet_biz",
  "E35L": "jet_biz", "E545": "jet_biz", "E550": "jet_biz",
  "F2TH": "jet_biz", "F900": "jet_biz", "FA7X": "jet_biz",
  "GL5T": "jet_biz", "GL6T": "jet_biz",
  "LJ45": "jet_biz", "LJ60": "jet_biz", "PC24": "jet_biz",
  "C172": "general_aviation", "C182": "general_aviation",
  "PA28": "general_aviation", "SR20": "general_aviation", "SR22": "general_aviation",
  "BE36": "general_aviation", "DA40": "general_aviation",
  "BE20": "general_aviation", "BE58": "general_aviation",
  "C402": "general_aviation", "PAY3": "general_aviation", "E110": "general_aviation",
  "R44": "helicopter", "R66": "helicopter", "B06": "helicopter",
  "AS50": "helicopter", "EC35": "helicopter", "H125": "helicopter", "UH60": "helicopter"
};

interface SvgCatalogEntry {
  key: string;
  label: string;
  svg: string;
  category: string;
  defaultScale: number;
  strokeWidth: number;
  centerX: number;
  centerY: number;
  lights: { left: { x: number; y: number }; right: { x: number; y: number }; center: { x: number; y: number } };
}

export const aircraftSvgCatalog: Record<string, SvgCatalogEntry> = {
  default: {
    key: "default", label: "Aircraft",
    svg: '<path d="m 40.297085,147.4044 c -0.686365,-0.50506 3.379997,-10.6878 4.301265,-10.6715 0.921268,0.0163 4.938578,10.12988 4.129216,10.6715 -0.809361,0.54162 -7.744117,0.50507 -8.430481,0 z" id="path27" />',
    category: "aircraft", defaultScale: 1, strokeWidth: 1.5, centerX: 44.5, centerY: 142,
    lights: { left: { x: 41, y: 143 }, right: { x: 48, y: 143 }, center: { x: 44.5, y: 146 } }
  },
  jet_airliner: {
    key: "jet_airliner", label: "Commercial Jet",
    svg: '<path d="m 45.324026,16.829968 c -0.168711,0.17856 -1.304232,1.46252 -1.3665,3.73764 -0.06726,2.45757 -0.0947,6.6842 -0.0947,6.6842 0,0 -1.941261,1.74498 -2.16461,1.61878 -0.129688,-0.0733 0.129605,-2.21285 -0.04415,-2.2478 -0.35158,-0.0707 -1.265741,-0.15319 -1.801789,-0.061 -0.328596,0.0565 -0.233435,2.37522 -0.08623,2.41497 0.36052,0.0974 0.398656,0.78995 0.398656,0.78995 l -9.066695,6.06686 -0.129419,1.12126 9.142362,-3.06174 h 3.665648 l 0.04319,6.20987 c 0,0 -1.15e-4,0.51752 0.129259,1.12126 0.129374,0.60375 0.388097,1.725 0.388097,1.725 l -4.139971,3.23436 v 1.42313 l 4.651089,-1.70501 0.487441,1.30315 0.483761,-1.28251 4.651089,1.70485 v -1.42313 l -4.139971,-3.2342 c 0,0 0.258722,-1.12126 0.388097,-1.725 0.129372,-0.60375 0.129419,-1.12126 0.129419,-1.12126 l 0.04319,-6.21004 h 3.665489 l 9.142522,3.06191 -0.129422,-1.12126 -9.066854,-6.06702 c 0,0 0.0383,-0.69243 0.398818,-0.78979 0.147209,-0.0398 0.242368,-2.35843 -0.08623,-2.41497 -0.536047,-0.0922 -1.45021,-0.01 -1.80179,0.061 -0.173758,0.0349 0.08538,2.17452 -0.04431,2.24779 -0.223348,0.12621 -2.16461,-1.61877 -2.16461,-1.61877 0,0 -0.02729,-4.2268 -0.09454,-6.68436 -0.0662,-2.41883 -1.345465,-3.71723 -1.386336,-3.75812 z" id="path15" />',
    category: "airline", defaultScale: 1, strokeWidth: 1.5, centerX: 45, centerY: 40,
    lights: { left: { x: 32, y: 36 }, right: { x: 58, y: 36 }, center: { x: 46, y: 35 } }
  },
  jet_regional: {
    key: "jet_regional", label: "Regional Jet",
    svg: '<path d="m 89.001488,19.240548 c -0.303453,-1.7e-4 -0.848481,1.49835 -0.899375,3.07605 -0.05313,1.6483 -0.106383,7.75605 -0.106383,7.75605 l -8.135073,4.1473 -0.212744,1.11667 5.848778,-1.38246 2.392762,0.21265 0.05313,4.04101 h -0.265884 l -0.265781,-0.42539 h -0.903932 c 0,0 -0.490468,1.34375 0.106371,3.8815 0.07635,0.32465 0.584818,-0.10637 0.584818,-0.10637 l 1.116575,0.42539 0.265887,0.69119 -2.977579,1.38246 -0.159512,1.01021 3.402966,-0.31902 0.152366,0.3049 0.15486,-0.30955 3.40288,0.31902 -0.15952,-1.01029 -2.97757,-1.38238 0.26589,-0.69127 1.11657,-0.4254 c 0,0 0.50856,0.44333 0.58491,0.10638 0.57612,-2.54254 0.10627,-3.88141 0.10627,-3.88141 h -0.90384 l -0.26588,0.4253 h -0.26589 l 0.0532,-4.04092 2.39268,-0.21275 5.84877,1.38246 -0.21275,-1.11657 -8.13507,-4.1473 c 0,0 -0.0532,-6.10776 -0.10638,-7.75605 -0.0503,-1.55884 -0.60747,-3.07124 -0.89659,-3.07141 z" id="path6" />',
    category: "airline", defaultScale: 1, strokeWidth: 1.5, centerX: 89, centerY: 35,
    lights: { left: { x: 81, y: 34 }, right: { x: 97, y: 34 }, center: { x: 89, y: 35 } }
  },
  turboprop_regional: {
    key: "turboprop_regional", label: "Turboprop",
    svg: '<path d="m 134.88037,22.367888 c -0.30184,-0.001 -0.81729,0.9359 -0.88824,2.24837 -0.0783,1.44794 -0.0783,3.52204 -0.0783,3.52204 l -1.87842,0.0391 v -2.07409 l -0.14262,-0.78493 v 0 l 1.43273,-0.0842 -1.48152,-0.13249 v 0 c 0,0 -0.19057,-0.71733 -0.31732,-0.95499 -0.20721,-0.38852 -0.5021,0.95873 -0.5021,0.95873 v 0 l -1.39828,0.13177 1.35915,0.0938 v 0 l -0.0458,0.30279 v 2.26975 l -0.78268,0.50874 -6.60223,0.46961 c 0,0 -0.3522,-0.15654 -0.3522,0.2348 v 1.17401 l 7.50231,1.13489 h 2.73936 c 0,0 0.3522,-0.15653 0.39133,0.54787 0.0391,0.7044 0.12559,2.10313 0.20386,2.69013 0.0783,0.587 0.35986,4.7843 0.35986,4.7843 l -2.85218,1.29142 c 0,0 -0.31307,0.1174 -0.3522,0.31307 -0.0391,0.19566 -0.0391,1.01747 -0.0391,1.01747 l 3.63611,-0.33735 v 0 0 l 3.70317,0.34358 c 0,0 0,-0.82181 -0.0391,-1.01747 -0.0391,-0.19567 -0.3522,-0.31307 -0.3522,-0.31307 l -2.82123,-1.29142 c 0,0 0.33538,-4.10446 0.41364,-4.69146 0.0783,-0.587 0.19567,-2.07867 0.23481,-2.78308 0.0391,-0.7044 0.39133,-0.54787 0.39133,-0.54787 h 2.73936 l 6.88754,-1.13489 v -1.17401 c 0,-0.39133 -0.35221,-0.2348 -0.35221,-0.2348 l -5.98745,-0.4696 -0.78268,-0.50874 v -2.26976 l -0.0405,-0.27092 v 0 c 0,0 1.26395,-0.0763 1.25757,-0.11381 -0.006,-0.0349 -1.29431,-0.10179 -1.29431,-0.10179 v 0 c 0,0 -0.29746,-1.39855 -0.50978,-1.00045 -0.13261,0.24863 -0.32864,1.00356 -0.32864,1.00356 v 0 l -1.40256,0.0908 1.35284,0.13554 v 0 l -0.13038,0.72672 v 2.07409 l -1.87842,-0.0391 c 0,0 0,-2.07409 -0.0783,-3.52203 -0.0721,-1.33373 -0.66675,-2.2519 -0.89405,-2.2545 z" id="path11" />',
    category: "airline", defaultScale: 1, strokeWidth: 1.5, centerX: 134, centerY: 38,
    lights: { left: { x: 121, y: 32 }, right: { x: 147, y: 32 }, center: { x: 134, y: 42 } }
  },
  jet_biz: {
    key: "jet_biz", label: "Business Jet",
    svg: '<path d="m 82.577648,83.188219 c -0.21425,0.0275 -0.44748,0.76719 -0.65368,1.56905 -0.24751,0.96254 -0.165,4.8127 -0.165,4.8127 l -6.847887,4.18013 c 0,0 -0.08248,0.0275 -0.109974,0.22005 -0.0275,0.19251 -0.192479,1.34756 -0.192479,1.34756 l 5.94022,-1.59508 c 0,0 0.0686,1.54023 0.15112,2.14526 0.0773,0.56721 0.11203,0.58439 0.11604,0.58433 h 1e-4 1.1e-4 v -1e-4 h 1.12875 c 0,0 0.12075,1.42776 0.36396,2.39976 0.094,0.37564 -2.92875,2.041971 -2.92875,2.041971 0,0 -0.11697,0.11011 -0.11697,0.24762 0,0.1375 -0.0344,0.66652 -0.0344,0.66652 l 3.33202,-1.16485 v 0 0 l 3.374809,1.17977 c 0,0 -0.0344,-0.52902 -0.0344,-0.66652 0,-0.13752 -0.11696,-0.24763 -0.11696,-0.24763 0,0 -3.022749,-1.666331 -2.928759,-2.041961 0.24322,-0.972 0.363969,-2.39976 0.363969,-2.39976 h 1.12875 l 1e-4,1e-4 c 0.003,4e-4 0.0375,-0.008 0.11615,-0.58444 0.0825,-0.60502 0.15112,-2.14515 0.15112,-2.14515 l 5.94022,1.59508 c 0,0 -0.16498,-1.15505 -0.19248,-1.34756 -0.0275,-0.19251 -0.10998,-0.22005 -0.10998,-0.22005 l -6.84777,-4.18013 c 0,0 0.0825,-3.85026 -0.16501,-4.81281 -0.212489,-0.82638 -0.423469,-1.58268 -0.662929,-1.58386 z" id="path20" />',
    category: "airline", defaultScale: 1, strokeWidth: 1.5, centerX: 82, centerY: 95,
    lights: { left: { x: 75, y: 90 }, right: { x: 89, y: 90 }, center: { x: 82, y: 99 } }
  },
  helicopter: {
    key: "helicopter", label: "Helicopter",
    svg: '<path d="m 115.10435,85.494416 c -0.2715,-0.01 -0.61118,0.11324 -0.71986,0.38218 -0.13252,0.32792 -0.35172,1.11909 -0.36229,1.66789 l -0.0472,2.51719 c 0,0 -0.73577,-0.0539 -1.01633,0 -0.14113,0.0271 -0.20691,0.22628 -0.20327,0.50817 0.004,0.31399 0.0314,0.9678 0.0653,1.17106 0.0339,0.20327 0.68004,0.11629 0.68004,0.11629 l -3.38778,2.87961 0.47429,0.4743 3.48941,-3.04901 0.44041,2.50696 0.13552,1.28736 -1.72777,0.0339 v 0.64367 l 1.66001,-0.0339 0.13551,2.23593 c 0,0 -0.0409,0.2906 -0.32412,0.2135 -0.0201,-0.24656 -0.0147,-1.26371 -0.0147,-1.26371 h -0.3049 l 0.008,2.647864 0.31513,0.008 -0.008,-1.055604 0.26079,-0.008 c 0,0 -0.0339,0.23714 0.13551,0.33877 0.13859,0.0832 0.22466,0.419574 0.25139,0.539154 0.0238,-0.11727 0.10445,-0.461164 0.24433,-0.545094 0.16939,-0.10163 0.0886,-0.36811 0.0886,-0.36811 l -0.0208,-0.51271 0.13551,-2.23594 1.66002,0.0339 v -0.64368 l -1.72777,-0.0339 0.13551,-1.28737 0.6033,-2.80591 c 0.54871,-0.0711 1.0708,0.0556 1.22008,-0.0908 0.16492,-0.16177 0.14251,-1.40247 0.12114,-1.60542 -0.0212,-0.18761 -0.1574,-0.12645 -0.17255,-0.20766 l 2.60629,-3.317 -0.50942,-0.45009 c -1.01782,1.398 -2.52371,3.13711 -3.3268,3.87548 l -0.0472,-2.52313 c -0.0106,-0.5488 -0.23343,-1.33262 -0.36242,-1.66195 -0.0991,-0.25289 -0.30583,-0.37232 -0.58293,-0.38218 z" id="path22" />',
    category: "airline", defaultScale: 1, strokeWidth: 1.5, centerX: 115, centerY: 95,
    lights: { left: { x: 107, y: 93 }, right: { x: 123, y: 93 }, center: { x: 115, y: 100 } }
  },
  general_aviation: {
    key: "general_aviation", label: "General Aviation",
    svg: '<path d="m 40.297085,147.4044 c -0.686365,-0.50506 3.379997,-10.6878 4.301265,-10.6715 0.921268,0.0163 4.938578,10.12988 4.129216,10.6715 -0.809361,0.54162 -7.744117,0.50507 -8.430481,0 z" id="path27" />',
    category: "aircraft", defaultScale: 1, strokeWidth: 1.5, centerX: 44.5, centerY: 142,
    lights: { left: { x: 41, y: 143 }, right: { x: 48, y: 143 }, center: { x: 44.5, y: 146 } }
  },
  jet_heavy: {
    key: "jet_heavy", label: "Heavy Jet",
    svg: '<path d="m 45.324026,16.829968 c -0.168711,0.17856 -1.304232,1.46252 -1.3665,3.73764 -0.06726,2.45757 -0.0947,6.6842 -0.0947,6.6842 0,0 -1.941261,1.74498 -2.16461,1.61878 -0.129688,-0.0733 0.129605,-2.21285 -0.04415,-2.2478 -0.35158,-0.0707 -1.265741,-0.15319 -1.801789,-0.061 -0.328596,0.0565 -0.233435,2.37522 -0.08623,2.41497 0.36052,0.0974 0.398656,0.78995 0.398656,0.78995 l -9.066695,6.06686 -0.129419,1.12126 9.142362,-3.06174 h 3.665648 l 0.04319,6.20987 c 0,0 -1.15e-4,0.51752 0.129259,1.12126 0.129374,0.60375 0.388097,1.725 0.388097,1.725 l -4.139971,3.23436 v 1.42313 l 4.651089,-1.70501 0.487441,1.30315 0.483761,-1.28251 4.651089,1.70485 v -1.42313 l -4.139971,-3.2342 c 0,0 0.258722,-1.12126 0.388097,-1.725 0.129372,-0.60375 0.129419,-1.12126 0.129419,-1.12126 l 0.04319,-6.21004 h 3.665489 l 9.142522,3.06191 -0.129422,-1.12126 -9.066854,-6.06702 c 0,0 0.0383,-0.69243 0.398818,-0.78979 0.147209,-0.0398 0.242368,-2.35843 -0.08623,-2.41497 -0.536047,-0.0922 -1.45021,-0.01 -1.80179,0.061 -0.173758,0.0349 0.08538,2.17452 -0.04431,2.24779 -0.223348,0.12621 -2.16461,-1.61877 -2.16461,-1.61877 0,0 -0.02729,-4.2268 -0.09454,-6.68436 -0.0662,-2.41883 -1.345465,-3.71723 -1.386336,-3.75812 z" id="path15" />',
    category: "airline", defaultScale: 1, strokeWidth: 1.5, centerX: 45, centerY: 40,
    lights: { left: { x: 32, y: 36 }, right: { x: 58, y: 36 }, center: { x: 46, y: 35 } }
  }
};

export function getAircraftSvgKey(icaoType?: string): string {
  if (!icaoType) return 'default';
  const svgKey = ICAOTypeToSVG[icaoType];
  return svgKey && aircraftSvgCatalog[svgKey] ? svgKey : 'default';
}

export function drawAircraftVector(ctx: CanvasRenderingContext2D, scale = 1, svgKey = 'default') {
  const svgData = aircraftSvgCatalog[svgKey] || aircraftSvgCatalog['default'];

  ctx.strokeStyle = 'rgba(136, 180, 224, 0.9)';
  ctx.lineWidth = svgData.strokeWidth * scale;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  const pathMatch = svgData.svg.match(/d="([^"]+)"/);
  if (!pathMatch) return;

  const path = new Path2D(pathMatch[1]);

  ctx.save();
  const finalScale = scale * svgData.defaultScale;
  ctx.scale(finalScale, finalScale);
  ctx.translate(-svgData.centerX, -svgData.centerY);
  ctx.stroke(path);

  if (svgData.lights) {
    const lightRadius = 1.5;

    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.beginPath();
    ctx.arc(svgData.lights.left.x, svgData.lights.left.y, lightRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(svgData.lights.right.x, svgData.lights.right.y, lightRadius, 0, Math.PI * 2);
    ctx.fill();

    const flashOn = Math.floor(Date.now() / 500) % 2 === 0;
    if (flashOn) {
      ctx.fillStyle = 'rgba(255, 0, 0, 1.0)';
      ctx.beginPath();
      ctx.arc(svgData.lights.center.x, svgData.lights.center.y, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export async function fetchAircraft(lat: number, lon: number, dist = 800): Promise<AircraftData[]> {
  const url = `/api/aircraft?lat=${lat}&lon=${lon}&dist=${dist}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    if (data && data.ac && Array.isArray(data.ac)) {
      return data.ac.filter((ac: AircraftData) =>
        ac.lat !== undefined &&
        ac.lon !== undefined &&
        ac.alt_baro !== undefined
      );
    }
    return [];
  } catch (err) {
    console.error('Aircraft fetch error:', err);
    return [];
  }
}
