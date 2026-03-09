import STARS from './stars-data.json';
import _CONSTELLATIONS from './constellations-data.json';

const CONSTELLATIONS: Record<string, number[][]> = _CONSTELLATIONS;

export { STARS, CONSTELLATIONS };

export interface Star {
  ra: number;
  dec: number;
  mag: number;
  ci: number;
  n: string;
  bf: string;
  con: string;
  hip: string;
}

export const CON_NAMES: Record<string, string> = {
  "And":"Andromeda","Ant":"Antlia","Aps":"Apus","Aqr":"Aquarius","Aql":"Aquila",
  "Ara":"Ara","Ari":"Aries","Aur":"Auriga","Boo":"Boötes","Cae":"Caelum",
  "Cam":"Camelopardalis","Cnc":"Cancer","CVn":"Canes Venatici","CMa":"Canis Major",
  "CMi":"Canis Minor","Cap":"Capricornus","Car":"Carina","Cas":"Cassiopeia",
  "Cen":"Centaurus","Cep":"Cepheus","Cet":"Cetus","Col":"Columba","Com":"Coma Berenices",
  "CrA":"Corona Australis","CrB":"Corona Borealis","Crv":"Corvus","Crt":"Crater",
  "Crx":"Crux","Cyg":"Cygnus","Del":"Delphinus","Dra":"Draco","Equ":"Equuleus",
  "Eri":"Eridanus","For":"Fornax","Gem":"Gemini","Gru":"Grus","Her":"Hercules",
  "Hor":"Horologium","Hya":"Hydra","Hyi":"Hydrus","Lac":"Lacerta","Leo":"Leo",
  "LMi":"Leo Minor","Lep":"Lepus","Lib":"Libra","Lup":"Lupus","Lyn":"Lynx",
  "Lyr":"Lyra","Men":"Mensa","Mic":"Microscopium","Mon":"Monoceros","Mus":"Musca",
  "Nor":"Norma","Oct":"Octans","Oph":"Ophiuchus","Ori":"Orion","Pav":"Pavo",
  "Peg":"Pegasus","Per":"Perseus","Phe":"Phoenix","Pic":"Pictor","Psc":"Pisces",
  "PsA":"Piscis Austrinus","Pup":"Puppis","Pyx":"Pyxis","Ret":"Reticulum",
  "Sge":"Sagitta","Sgr":"Sagittarius","Sco":"Scorpius","Scl":"Sculptor",
  "Sct":"Scutum","Ser":"Serpens","Sex":"Sextans","Tau":"Taurus","Tel":"Telescopium",
  "Tri":"Triangulum","TrA":"Triangulum Australe","Tuc":"Tucana","UMa":"Ursa Major",
  "UMi":"Ursa Minor","Vel":"Vela","Vir":"Virgo","Vol":"Volans","Vul":"Vulpecula"
};

export function bvToRGB(bv: number): string {
  let r: number, g: number, b: number;
  const t = Math.max(-0.4, Math.min(2.0, bv));

  if (t < 0) {
    r = 0.61 + 0.39 * (t + 0.4) / 0.4;
    g = 0.70 + 0.30 * (t + 0.4) / 0.4;
    b = 1.0;
  } else if (t < 0.15) {
    r = 0.83 + 0.17 * t / 0.15;
    g = 0.87 + 0.13 * t / 0.15;
    b = 1.0;
  } else if (t < 0.4) {
    r = 1.0;
    g = 1.0 - 0.08 * (t - 0.15) / 0.25;
    b = 1.0 - 0.15 * (t - 0.15) / 0.25;
  } else if (t < 0.8) {
    r = 1.0;
    g = 0.92 - 0.17 * (t - 0.4) / 0.4;
    b = 0.85 - 0.25 * (t - 0.4) / 0.4;
  } else {
    r = 1.0;
    g = 0.75 - 0.15 * Math.min(1, (t - 0.8) / 1.2);
    b = 0.60 - 0.20 * Math.min(1, (t - 0.8) / 1.2);
  }

  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}
