import { useEffect, useRef } from "react";

/**
 * 픽셀 강아지 마스코트 — 스프라이트 이미지 없이 캔버스에 격자 단위로 직접 그린다.
 * (XP 검색 도우미 강아지 오마주 — 오리지널 골든 강아지)
 *
 * 포즈:
 *  - idle : 정면 앉기 + 꼬리 흔들기 + 가끔 눈 깜빡임
 *  - run  : 옆모습 달리기 (왼쪽을 향해 달림)
 *  - think: 앉아서 시선 위로 (응답 대기)
 *  - talk : 앉아서 입 뻐끔뻐끔
 */
export type Pose = "idle" | "run" | "think" | "talk";

const GRID_W = 36;
const GRID_H = 32;
const SCALE = 5;

// ── 팔레트 ──────────────────────────────────────────────
const OUT = "#3b2a17"; // 외곽선 (진갈색)
const BODY = "#e6b23a"; // 몸통 골든
const LIGHT = "#f6d478"; // 밝은 털
const MUZZLE = "#f9e6b0"; // 주둥이
const EAR_IN = "#c98d2f"; // 귀 안쪽
const NOSE = "#26180e";
const WHITE = "#ffffff";
const PUPIL = "#1a1108";
const COLLAR = "#d43a2f"; // 빨간 목걸이
const TAG = "#f2c94c"; // 금색 이름표
const TONGUE = "#e77e88";

type Ctx = CanvasRenderingContext2D;

function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
}

/** 모서리가 둥근(코너 픽셀 생략) 외곽선 있는 덩어리 */
function blob(g: Ctx, x: number, y: number, w: number, h: number, fill: string): void {
  rect(g, x + 1, y + 1, w - 2, h - 2, fill);
  rect(g, x + 1, y, w - 2, 1, OUT);
  rect(g, x + 1, y + h - 1, w - 2, 1, OUT);
  rect(g, x, y + 1, 1, h - 2, OUT);
  rect(g, x + w - 1, y + 1, 1, h - 2, OUT);
}

/** 외곽선 없는 순수 사각형 채움 (겹침 보정용) */
const fill = rect;

// ── 정면 앉은 자세 (idle / think / talk 공용) ─────────────
function drawSitting(
  g: Ctx,
  frame: number,
  opts: { blink?: boolean; lookUp?: boolean; mouthOpen?: boolean }
): void {
  const wag = frame % 2 === 0;

  // 꼬리 (몸통 뒤) — 좌우로 살랑살랑
  if (wag) {
    blob(g, 27, 19, 6, 3, BODY);
    blob(g, 30, 17, 4, 3, BODY);
  } else {
    blob(g, 27, 22, 6, 3, BODY);
    blob(g, 30, 23, 4, 3, BODY);
  }

  // 몸통 (앉은 자세)
  blob(g, 9, 17, 18, 14, BODY);
  fill(g, 13, 21, 10, 8, LIGHT); // 배

  // 뒷다리(허벅지) 볼록
  blob(g, 6, 22, 5, 9, BODY);
  blob(g, 25, 22, 5, 9, BODY);

  // 앞다리
  fill(g, 12, 22, 3, 7, BODY);
  fill(g, 21, 22, 3, 7, BODY);
  rect(g, 11, 22, 1, 7, OUT);
  rect(g, 15, 22, 1, 7, OUT);
  rect(g, 20, 22, 1, 7, OUT);
  rect(g, 24, 22, 1, 7, OUT);

  // 발
  blob(g, 10, 28, 6, 3, LIGHT);
  blob(g, 20, 28, 6, 3, LIGHT);

  // 목걸이
  rect(g, 11, 15, 14, 2, COLLAR);
  rect(g, 17, 17, 2, 2, TAG);

  // 머리
  blob(g, 8, 1, 20, 15, BODY);
  fill(g, 10, 3, 16, 2, LIGHT); // 정수리 하이라이트

  // 귀 (늘어진 귀)
  blob(g, 4, 3, 6, 11, BODY);
  fill(g, 6, 5, 2, 7, EAR_IN);
  blob(g, 26, 3, 6, 11, BODY);
  fill(g, 28, 5, 2, 7, EAR_IN);

  // 눈
  if (opts.blink) {
    rect(g, 12, 8, 3, 1, OUT);
    rect(g, 21, 8, 3, 1, OUT);
  } else {
    rect(g, 12, 7, 3, 3, WHITE);
    rect(g, 21, 7, 3, 3, WHITE);
    const pupilY = opts.lookUp ? 7 : 8;
    rect(g, 13, pupilY, 2, 2, PUPIL);
    rect(g, 22, pupilY, 2, 2, PUPIL);
  }

  // 주둥이 + 코 + 입
  fill(g, 14, 10, 8, 5, MUZZLE);
  rect(g, 16, 10, 4, 2, NOSE);
  if (opts.mouthOpen) {
    rect(g, 15, 13, 6, 2, OUT);
    rect(g, 16, 14, 4, 1, TONGUE);
  } else {
    rect(g, 17, 13, 2, 1, OUT);
  }
}

// ── 옆모습 달리기 (왼쪽으로) ──────────────────────────────
function drawRunning(g: Ctx, frame: number): void {
  const stretch = frame % 2 === 0;
  const bob = stretch ? 1 : 0; // 프레임마다 살짝 위아래

  // 꼬리 (위로 신나게)
  blob(g, 28, 9 + bob, 6, 4, BODY);

  // 몸통 (수평)
  blob(g, 8, 12 + bob, 22, 10, BODY);
  fill(g, 12, 17 + bob, 14, 4, LIGHT);

  // 다리
  if (stretch) {
    // 쭉 뻗은 프레임: 앞다리 앞으로, 뒷다리 뒤로
    blob(g, 3, 19, 5, 9, BODY);
    blob(g, 28, 19, 5, 9, BODY);
    fill(g, 12, 21, 3, 5, BODY);
    fill(g, 22, 21, 3, 5, BODY);
  } else {
    // 모은 프레임: 다리 몸통 아래로
    blob(g, 10, 21, 4, 9, BODY);
    blob(g, 21, 21, 4, 9, BODY);
  }

  // 목걸이
  rect(g, 12, 11 + bob, 2, 5, COLLAR);

  // 머리 (왼쪽 방향)
  blob(g, 1, 4 + bob, 13, 12, BODY);

  // 귀 (달릴 때 펄럭)
  if (stretch) blob(g, 9, 1 + bob, 5, 7, BODY);
  else blob(g, 10, 3 + bob, 5, 7, BODY);

  // 눈
  rect(g, 4, 8 + bob, 2, 2, WHITE);
  rect(g, 4, 9 + bob, 1, 1, PUPIL);

  // 주둥이 + 코 (왼쪽 끝)
  fill(g, 1, 11 + bob, 4, 3, MUZZLE);
  rect(g, 0, 10 + bob, 2, 2, NOSE);
  // 혀 (달리면 신나서 낼름)
  rect(g, 1, 14 + bob, 2, 2, TONGUE);
}

function draw(g: Ctx, pose: Pose, frame: number, blink: boolean): void {
  g.clearRect(0, 0, GRID_W * SCALE, GRID_H * SCALE);
  switch (pose) {
    case "run":
      drawRunning(g, frame);
      break;
    case "think":
      drawSitting(g, 0, { lookUp: true }); // 꼬리 정지 + 시선 위
      break;
    case "talk":
      drawSitting(g, frame, { mouthOpen: frame % 2 === 0 });
      break;
    default:
      drawSitting(g, frame, { blink });
  }
}

const FRAME_MS: Record<Pose, number> = {
  idle: 380,
  run: 110,
  think: 420,
  talk: 170,
};

export function Mascot({ pose }: { pose: Pose }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const g = canvasRef.current?.getContext("2d");
    if (!g) return;
    let frame = 0;
    draw(g, pose, frame, false);
    const timer = setInterval(() => {
      frame += 1;
      // idle일 때 가끔(약 4초에 한 번) 깜빡임
      const blink = pose === "idle" && frame % 10 === 9;
      draw(g, pose, frame, blink);
    }, FRAME_MS[pose]);
    return () => clearInterval(timer);
  }, [pose]);

  return (
    <canvas
      ref={canvasRef}
      width={GRID_W * SCALE}
      height={GRID_H * SCALE}
      className="mascot-canvas"
      aria-label="MADI 강아지 마스코트"
    />
  );
}
