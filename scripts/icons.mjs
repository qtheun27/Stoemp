// Génère les icônes PWA et les écrans de démarrage iOS à partir d'un SVG (npm run icons).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const plate = (s = 1) => `
  <g transform="translate(256 262) scale(${s}) translate(-256 -262)">
    <ellipse cx="256" cy="300" rx="168" ry="40" fill="#000" opacity=".12"/>
    <circle cx="256" cy="262" r="164" fill="#fbfaf5"/>
    <circle cx="256" cy="262" r="128" fill="none" stroke="#e7e2d3" stroke-width="6"/>
    <path d="M150 292c0-56 46-96 106-96s106 40 106 96c0 10-8 16-18 16H168c-10 0-18-6-18-16z" fill="#f2c14e"/>
    <path d="M176 270c18-26 50-42 80-42" stroke="#f7d77f" stroke-width="12" stroke-linecap="round" fill="none"/>
    <circle cx="214" cy="262" r="11" fill="#e8742a"/><circle cx="292" cy="250" r="10" fill="#e8742a"/><circle cx="258" cy="284" r="9" fill="#e8742a"/><circle cx="318" cy="282" r="8" fill="#e8742a"/>
    <path d="M262 196c-6-40 18-76 64-86-2 44-26 76-64 86z" fill="#5e9a35"/>
    <path d="M264 194c12-28 30-48 56-70" stroke="#3d6f22" stroke-width="5" stroke-linecap="round" fill="none"/>
  </g>`;
const bg = (r) => `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#68a83c"/><stop offset="1" stop-color="#3a6b20"/></linearGradient></defs><rect width="512" height="512" rx="${r}" fill="url(#g)"/>`;
const svg = (r, s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg(r)}${plate(s)}</svg>`;

const icon = svg(112, 1), full = svg(0, 1), maskable = svg(0, 0.78);
writeFileSync("public/icons/favicon.svg", icon);
const out = async (src, size, file) => sharp(Buffer.from(src)).resize(size, size).png().toFile(file);
await out(icon, 192, "public/icons/icon-192.png");
await out(icon, 512, "public/icons/icon-512.png");
await out(maskable, 512, "public/icons/icon-maskable-512.png");
await out(full, 180, "public/icons/apple-touch-icon.png");

for (const [w, h] of [[1290, 2796], [1179, 2556], [1170, 2532], [750, 1334], [2048, 2732]]) {
  const s = Math.round(Math.min(w, h) * 0.32);
  const logo = await sharp(Buffer.from(icon)).resize(s, s).png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: "#f3f5ef" } })
    .composite([{ input: logo, left: Math.round((w - s) / 2), top: Math.round((h - s) / 2) }]).png({ compressionLevel: 9 }).toFile(`public/splash/splash-${w}x${h}.png`);
}
console.log("Icônes générées");
