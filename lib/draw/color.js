// OKLab color math: every ink c mixes is chosen by lightness, chroma and hue rather than raw RGB
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function toLab(hex) {
  const r = toLinear(parseInt(hex.slice(1, 3), 16) / 255);
  const g = toLinear(parseInt(hex.slice(3, 5), 16) / 255);
  const b = toLinear(parseInt(hex.slice(5, 7), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function labToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
const hex2 = (v) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, "0");

export function toLch(hex) {
  const [L, a, b] = toLab(hex);
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

// lightness 0..1, chroma about 0..0.3, hue in degrees; chroma is reduced until the color fits sRGB
export function fromLch(L, C, h) {
  L = Math.min(1, Math.max(0, L));
  const rad = (h * Math.PI) / 180;
  const ca = Math.cos(rad);
  const sa = Math.sin(rad);
  let rgb = labToRgb(L, C * ca, C * sa);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(labToRgb(L, mid * ca, mid * sa))) lo = mid;
      else hi = mid;
    }
    rgb = labToRgb(L, lo * ca, lo * sa);
  }
  return `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;
}

export function fromLab(L, a, b) {
  return fromLch(L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360);
}

export function mix(a, b, t) {
  const x = toLab(a);
  const y = toLab(b);
  return fromLab(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

export const light = (hex) => toLab(hex)[0];

export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function hueToward(from, to, t) {
  const d = ((to - from + 540) % 360) - 180;
  return (from + d * t + 360) % 360;
}

export function ramp(stops, t) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}
