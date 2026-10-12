"use strict";
// 生成 WorkBuddy 专家团 6 个头像（128x128、RGBA、8 位色深 PNG）。
// 纯 Node.js，无第三方依赖：手写 PNG 编码（node:zlib 压缩 + CRC32），图元用距离场/超采样做少量抗锯齿。

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const SIZE = 128;
const OUT_DIR = path.join(__dirname, "..", "experts", "avatars");
const WHITE = [255, 255, 255];

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

// 优先用 Node 18+ 的 zlib.crc32，不可用时用查表实现
function crc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length >>> 0, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // 8 位色深
  ihdr[9] = 6; // 颜色类型 RGBA
  ihdr[10] = 0; // 压缩方法 deflate
  ihdr[11] = 0; // 过滤方法
  ihdr[12] = 0; // 非隔行
  const stride = SIZE * 4;
  const raw = Buffer.alloc((stride + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (stride + 1)] = 0; // 每行前缀 filter 字节：0 = None
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- 绘制工具 ----------
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hexRGB(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function newCanvas(hex) {
  const [r, g, b] = hexRGB(hex);
  const buf = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    buf[4 * i] = r;
    buf[4 * i + 1] = g;
    buf[4 * i + 2] = b;
    buf[4 * i + 3] = 255;
  }
  return buf;
}

// 按覆盖率把颜色混合上屏（底色不透明，最终 alpha 保持 255）
function blend(buf, x, y, color, coverage, alpha) {
  const a = clamp01(coverage) * alpha;
  if (a <= 0) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = Math.round(buf[i] + (color[0] - buf[i]) * a);
  buf[i + 1] = Math.round(buf[i + 1] + (color[1] - buf[i + 1]) * a);
  buf[i + 2] = Math.round(buf[i + 2] + (color[2] - buf[i + 2]) * a);
}

// 实心圆，边缘用距离场平滑 1px
function fillCircle(buf, cx, cy, r, color, alpha = 1) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(SIZE - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(SIZE - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      blend(buf, x, y, color, clamp01(r + 0.5 - d), alpha);
    }
  }
}

// 圆环（描边），rm 为环中心线半径，hw 为半宽
function fillAnnulus(buf, cx, cy, rm, hw, color, alpha = 1) {
  const outer = rm + hw;
  const inner = rm - hw;
  const x0 = Math.max(0, Math.floor(cx - outer - 1));
  const x1 = Math.min(SIZE - 1, Math.ceil(cx + outer + 1));
  const y0 = Math.max(0, Math.floor(cy - outer - 1));
  const y1 = Math.min(SIZE - 1, Math.ceil(cy + outer + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const sd = Math.max(inner - d, d - outer); // 到环带的符号距离近似
      blend(buf, x, y, color, clamp01(0.5 - sd), alpha);
    }
  }
}

// 矩形（坐标可任意顺序），边缘 1px 平滑
function fillRect(buf, x0, y0, x1, y1, color, alpha = 1) {
  const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - 1));
  const bx1 = Math.min(SIZE - 1, Math.ceil(Math.max(x0, x1) + 1));
  const by0 = Math.max(0, Math.floor(Math.min(y0, y1) - 1));
  const by1 = Math.min(SIZE - 1, Math.ceil(Math.max(y0, y1) + 1));
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const sd = Math.max(Math.min(px - x0, x1 - px), Math.min(py - y0, y1 - py));
      blend(buf, x, y, color, clamp01(sd + 0.5), alpha);
    }
  }
}

// 圆头粗线段（用于放大镜手柄、对勾）
function strokeSegment(buf, x1, y1, x2, y2, width, color, alpha = 1) {
  const hw = width / 2;
  const bx0 = Math.max(0, Math.floor(Math.min(x1, x2) - hw - 1));
  const bx1 = Math.min(SIZE - 1, Math.ceil(Math.max(x1, x2) + hw + 1));
  const by0 = Math.max(0, Math.floor(Math.min(y1, y2) - hw - 1));
  const by1 = Math.min(SIZE - 1, Math.ceil(Math.max(y1, y2) + hw + 1));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = clamp01(((px - x1) * dx + (py - y1) * dy) / len2); // 夹取 t 得到圆头
      const d = Math.hypot(x1 + t * dx - px, y1 + t * dy - py);
      blend(buf, x, y, color, clamp01(hw + 0.5 - d), alpha);
    }
  }
}

// 多边形填充，4x4 超采样抗锯齿
function pointInPolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillPolygon(buf, pts, color, alpha = 1) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const bx0 = Math.max(0, Math.floor(minX) - 1);
  const bx1 = Math.min(SIZE - 1, Math.ceil(maxX) + 1);
  const by0 = Math.max(0, Math.floor(minY) - 1);
  const by1 = Math.min(SIZE - 1, Math.ceil(maxY) + 1);
  const SS = 4;
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (pointInPolygon(pts, x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hit++;
        }
      }
      if (hit) blend(buf, x, y, color, hit / (SS * SS), alpha);
    }
  }
}

// 上半椭圆（平底），cutY 为底部截平位置（整数行对齐）
function fillEllipseUpper(buf, cx, cutY, rx, ry, color, alpha = 1) {
  const x0 = Math.max(0, Math.floor(cx - rx - 1));
  const x1 = Math.min(SIZE - 1, Math.ceil(cx + rx + 1));
  const y0 = Math.max(0, Math.floor(cutY - ry - 1));
  const y1 = Math.min(SIZE - 1, Math.ceil(cutY));
  const rmin = Math.min(rx, ry);
  for (let y = y0; y <= y1; y++) {
    if (y + 0.5 >= cutY) break;
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cutY) / ry;
      const d = Math.hypot(dx, dy);
      blend(buf, x, y, color, clamp01((1 - d) * rmin + 0.5), alpha);
    }
  }
}

// 正 N 角星顶点，起始角朝上
function starPoints(cx, cy, rOuter, rInner, tips) {
  const pts = [];
  for (let i = 0; i < tips * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + (i * Math.PI) / tips;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// ---------- 6 个头像 ----------
const AVATARS = [
  {
    file: "team.png",
    bg: "#5B5BD6",
    draw(buf) {
      // 三个小人剪影：左右半透明白、中间纯白，品字形排布
      const person = (cx, headY, headR, rx, cutY, alpha) => {
        fillEllipseUpper(buf, cx, cutY, rx, rx, WHITE, alpha);
        fillCircle(buf, cx, headY, headR, WHITE, alpha);
      };
      person(30, 68, 8.5, 14, 88, 0.62);
      person(98, 68, 8.5, 14, 88, 0.62);
      person(64, 54, 10, 17, 76, 1);
    },
  },
  {
    file: "team-lead.png",
    bg: "#7C3AED",
    draw(buf) {
      // 三尖皇冠 + 底带 + 三颗顶端圆珠
      fillPolygon(buf, [[32, 82], [96, 82], [96, 52], [80, 64], [64, 38], [48, 64], [32, 52]], WHITE);
      fillRect(buf, 30, 80, 98, 95, WHITE);
      fillCircle(buf, 32, 52, 4.5, WHITE);
      fillCircle(buf, 64, 38, 4.5, WHITE);
      fillCircle(buf, 96, 52, 4.5, WHITE);
    },
  },
  {
    file: "team-explorer.png",
    bg: "#06B6D4",
    draw(buf) {
      // 放大镜：斜柄 + 粗圆环
      strokeSegment(buf, 75, 75, 97, 97, 13, WHITE);
      fillAnnulus(buf, 56, 56, 26, 5.5, WHITE);
    },
  },
  {
    file: "team-executor.png",
    bg: "#2563EB",
    draw(buf) {
      // 闪电
      fillPolygon(buf, [[76, 16], [40, 72], [62, 72], [52, 112], [88, 56], [66, 56]], WHITE);
    },
  },
  {
    file: "team-reviewer.png",
    bg: "#16A34A",
    draw(buf) {
      // 对勾：两段圆头粗线拼接
      strokeSegment(buf, 36, 68, 56, 88, 14, WHITE);
      strokeSegment(buf, 56, 88, 94, 44, 14, WHITE);
    },
  },
  {
    file: "team-expert-advisor.png",
    bg: "#D97706",
    draw(buf) {
      // 五角星
      fillPolygon(buf, starPoints(64, 66, 40, 17, 5), WHITE);
    },
  },
];

// ---------- 主流程 ----------
fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`输出目录: ${OUT_DIR}`);
for (const a of AVATARS) {
  const canvas = newCanvas(a.bg);
  a.draw(canvas);
  const png = encodePNG(canvas);
  // 最小自检：PNG 签名 + IHDR 尺寸
  const okSig = png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!okSig || png.readUInt32BE(16) !== SIZE || png.readUInt32BE(20) !== SIZE) {
    throw new Error(`${a.file}: PNG 自检失败`);
  }
  const out = path.join(OUT_DIR, a.file);
  fs.writeFileSync(out, png);
  console.log(`已生成 ${a.file}（${png.length} 字节，${SIZE}x${SIZE} RGBA）`);
}
console.log(`完成：共 ${AVATARS.length} 个头像。`);
