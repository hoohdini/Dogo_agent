import { deflateSync } from "node:zlib";

/**
 * 트레이(메뉴바)용 발바닥 아이콘을 PNG 바이너리로 직접 생성한다.
 * 외부 이미지 파일 없이 코드만으로 앱이 완결되도록 하기 위함.
 * macOS 템플릿 이미지 규칙: 검정 + 알파만 사용 (다크/라이트 모드 자동 대응).
 */

// 22x22 발바닥 픽셀맵 ('#' = 검정, '.' = 투명)
const PAW: string[] = [
  "......................",
  "......................",
  "....##........##......",
  "...####......####.....",
  "...####......####.....",
  "....##........##......",
  ".........##...........",
  "........####..........",
  "........####..........",
  ".........##...........",
  "......................",
  ".....########.........",
  "....##########........",
  "...############.......",
  "...############.......",
  "...############.......",
  "....##########........",
  ".....########.........",
  "......................",
  "......................",
  "......................",
  "......................",
];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function trayIconPng(): Buffer {
  const h = PAW.length;
  const w = PAW[0].length;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // compression(10)·filter(11)·interlace(12)는 0

  // 스캔라인: 각 행 앞에 필터 바이트 0
  const raw = Buffer.alloc(h * (1 + w * 4));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;
    for (let x = 0; x < w; x++) {
      const on = PAW[y][x] === "#";
      raw[p++] = 0; // R
      raw[p++] = 0; // G
      raw[p++] = 0; // B
      raw[p++] = on ? 255 : 0; // A
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
