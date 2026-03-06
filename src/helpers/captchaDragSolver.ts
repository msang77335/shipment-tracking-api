/**
 * Captcha Drag Solver
 * Giải puzzle captcha kiểu kéo-thả bằng cách:
 * 1. Chụp ảnh puzzle background và puzzle piece
 * 2. Gửi lên SadCaptcha API để lấy slideXProportion
 * 3. Tính pixel offset từ tỉ lệ và chiều rộng puzzle
 * 4. Giả lập chuột kéo thả giống người thật
 */

import axios from 'axios';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Page } from 'playwright';
import fs from 'node:fs';

const SADCAPTCHA_BASE_URL = 'https://www.sadcaptcha.com/api/v1';

// ─── Selectors ────────────────────────────────────────────────────────────────

const SELECTORS = {
  /** Toàn bộ widget captcha */
  widget: '[id*="captcha"], [class*="captcha"]',
  /** Vùng ảnh puzzle (background có lỗ hổng) */
  puzzleImg: '#captcha-verify-image',
  /** Mảnh puzzle di chuyển */
  slideImg: '.captcha_verify_img_slide',
  /** Thanh kéo (drag bar) */
  dragWrapper: '#secsdk-captcha-drag-wrapper, [id*="drag-wrapper"], [class*="drag-wrapper"]',
  /** Nút/icon kéo */
  dragIcon: '.secsdk-captcha-drag-icon, [class*="drag-icon"], [class*="drag-sliding"]',
};

// ─── Human-like drag simulation ───────────────────────────────────────────────

/**
 * Tạo đường đi giống người: bezier + jitter nhỏ
 */
function buildHumanPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  steps = 40
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  // Control point lệch nhẹ theo trục Y để tạo cong tự nhiên
  const cpX = fromX + (toX - fromX) * 0.5 + (Math.random() * 20 - 10);
  const cpY = fromY - (10 + Math.random() * 15);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Quadratic Bezier
    const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * cpX + t * t * toX;
    const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * cpY + t * t * toY;
    // Jitter nhỏ (±1px)
    points.push({
      x: Math.round(x + (Math.random() - 0.5)),
      y: Math.round(y + (Math.random() - 0.5)),
    });
  }
  return points;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDrag(
  page: Page,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Promise<void> {
  const path = buildHumanPath(fromX, fromY, toX, toY, randomBetween(35, 55));

  console.log(`🖱️ [CAPTCHA DRAG] Dragging from (${fromX},${fromY}) → (${toX},${toY}) in ${path.length} steps`);

  await page.mouse.move(fromX, fromY);
  await page.waitForTimeout(randomBetween(80, 180));
  await page.mouse.down();
  await page.waitForTimeout(randomBetween(60, 120));

  for (const point of path) {
    await page.mouse.move(point.x, point.y, { steps: 1 });
    // Biến thiên tốc độ: đoạn đầu nhanh, cuối chậm lại
    const progress = path.indexOf(point) / path.length;
    const delay = progress < 0.7
      ? randomBetween(8, 18)
      : randomBetween(20, 45);
    await page.waitForTimeout(delay);
  }

  // Dừng nhẹ trước khi thả
  await page.waitForTimeout(randomBetween(80, 160));
  await page.mouse.up();
  console.log(`✅ [CAPTCHA DRAG] Mouse released`);
}

// ─── SadCaptcha API ───────────────────────────────────────────────────────────

/**
 * Gửi puzzle image và piece image lên SadCaptcha API.
 * Trả về slideXProportion (0..1) hoặc null nếu lỗi.
 */
async function callSadCaptchaApi(
  puzzleBase64: string,
  pieceBase64: string,
  licenseKey: string
): Promise<number | null> {
  const url = `${SADCAPTCHA_BASE_URL}/puzzle?licenseKey=${licenseKey}`;
  console.log(`🌐 [CAPTCHA DRAG] Calling SadCaptcha API...`);

  try {
    const response = await axios.post<{ slideXProportion: string | number }>(
      url,
      { puzzleImageB64: puzzleBase64, pieceImageB64: pieceBase64 },
      { timeout: 15000 }
    );
    console.log(`📊 [CAPTCHA DRAG] SadCaptcha API response received`, response);
    const proportion = Number.parseFloat(String(response.data.slideXProportion));
    console.log(`📊 [CAPTCHA DRAG] SadCaptcha slideXProportion: ${proportion}`);
    return Number.isNaN(proportion) ? null : proportion;
  } catch (err: any) {
    console.error(`❌ [CAPTCHA DRAG] SadCaptcha API error:`, err.message);
    return null;
  }
}

// ─── Captcha Session Logger ──────────────────────────────────────────────────

const CAPTCHA_LOGS_DIR = path.join(__dirname, 'captcha-logs');
const ATTEMPTS_DIR = path.join(CAPTCHA_LOGS_DIR, 'attempts');
const SUCCESS_DIR = path.join(CAPTCHA_LOGS_DIR, 'success');
const FAILED_DIR = path.join(CAPTCHA_LOGS_DIR, 'failed');

// ─── Known-failed cache ───────────────────────────────────────────────────────

/**
 * Set chứa key "puzzleSrc::pieceSrc" của những captcha đã thất bại.
 * Load từ disk khi khởi động, cập nhật realtime khi có lần thất bại mới.
 */
const knownFailedKeys = new Set<string>();

(function loadKnownFailedKeys() {
  try {
    if (!fs.existsSync(FAILED_DIR)) return;
    for (const file of fs.readdirSync(FAILED_DIR)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = fs.readFileSync(path.join(FAILED_DIR, file), 'utf-8');
        const { puzzleSrc, pieceSrc } = JSON.parse(raw);
        if (puzzleSrc && pieceSrc) knownFailedKeys.add(`${puzzleSrc}::${pieceSrc}`);
      } catch { /* bỏ qua file lỗi */ }
    }
    console.log(`📂 [CAPTCHA DRAG] Loaded ${knownFailedKeys.size} known-failed captcha pair(s) from disk`);
  } catch (err: any) {
    console.error(`⚠️ [CAPTCHA DRAG] Could not load known-failed keys:`, err.message);
  }
})();

function isKnownFailedCaptcha(puzzleSrc: string, pieceSrc: string): boolean {
  return knownFailedKeys.has(`${puzzleSrc}::${pieceSrc}`);
}

/**
 * Lưu URL puzzle/piece vào file JSON riêng theo UUID trong thư mục attempts/.
 * Trả về sessionId (UUID) để liên kết với kết quả thành công.
 */
function saveCaptchaSession(
  puzzleBuffer: Buffer,
  pieceBuffer: Buffer,
  puzzleSrc: string,
  pieceSrc: string,
  pageUrl: string
): string {
  const sessionId = randomUUID();

  try {
    fs.mkdirSync(ATTEMPTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ATTEMPTS_DIR, `${sessionId}-puzzle.png`), puzzleBuffer);
    fs.writeFileSync(path.join(ATTEMPTS_DIR, `${sessionId}-piece.png`), pieceBuffer);
    fs.writeFileSync(
      path.join(ATTEMPTS_DIR, `${sessionId}.json`),
      JSON.stringify({ sessionId, timestamp: new Date().toISOString(), pageUrl, puzzleSrc, pieceSrc }, null, 2)
    );
    console.log(`💾 [CAPTCHA DRAG] Attempt logged → attempts/${sessionId}`);
  } catch (err: any) {
    console.error(`❌ [CAPTCHA DRAG] Failed to save attempt:`, err.message);
  }

  return sessionId;
}

/**
 * Lưu toạ độ thành công vào file JSON riêng theo UUID trong thư mục success/.
 */
function saveSuccessfulCoordinates(data: {
  sessionId: string;
  pageUrl: string;
  puzzleSrc: string;
  pieceSrc: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  offset: number;
  slideXProportion: number;
  puzzleWidth: number;
  timestamp: string;
}): void {
  try {
    fs.mkdirSync(SUCCESS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(SUCCESS_DIR, `${data.sessionId}.json`),
      JSON.stringify(data, null, 2)
    );
    console.log(`📌 [CAPTCHA DRAG] Success coordinates saved → success/${data.sessionId}.json`);
  } catch (err: any) {
    console.error(`❌ [CAPTCHA DRAG] Failed to save coordinates:`, err.message);
  }
}

/**
 * Lưu toạ độ thất bại vào file JSON riêng theo UUID trong thư mục failed/.
 */
function saveFailedCoordinates(data: {
  sessionId: string;
  pageUrl: string;
  puzzleSrc: string;
  pieceSrc: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  offset: number;
  slideXProportion: number;
  puzzleWidth: number;
  timestamp: string;
}): void {
  try {
    fs.mkdirSync(FAILED_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(FAILED_DIR, `${data.sessionId}.json`),
      JSON.stringify(data, null, 2)
    );
    console.log(`📁 [CAPTCHA DRAG] Failed coordinates saved → failed/${data.sessionId}.json`);
    // Cập nhật cache ngay để lần sau không giải lại
    knownFailedKeys.add(`${data.puzzleSrc}::${data.pieceSrc}`);
  } catch (err: any) {
    console.error(`❌ [CAPTCHA DRAG] Failed to save failed coordinates:`, err.message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DragSolveResult {
  attempted: boolean;
  offset: number;
  success: boolean;
}

/**
 * Cố gắng giải puzzle captcha kéo-thả trên `page`.
 * Trả về kết quả giải (attempted / offset / success).
 */
export async function solveDragCaptcha(page: Page): Promise<DragSolveResult> {
  console.log(`🔍 [CAPTCHA DRAG] Looking for drag captcha...`);

  // 1. Tìm drag handle
  const dragHandle = await page.$(
    '#secsdk-captcha-drag-wrapper .secsdk-captcha-drag-icon, ' +
    '[class*="drag-icon"], ' +
    '[class*="captcha_verify_bar"] [class*="drag"]'
  );

  if (!dragHandle) {
    console.log(`⚠️ [CAPTCHA DRAG] Drag handle not found, skipping`);
    return { attempted: false, offset: 0, success: false };
  }

  const handleBox = await dragHandle.boundingBox();
  if (!handleBox) {
    console.log(`⚠️ [CAPTCHA DRAG] Drag handle has no bounding box, skipping`);
    return { attempted: false, offset: 0, success: false };
  }

  const fromX = Math.round(handleBox.x + handleBox.width / 2);
  const fromY = Math.round(handleBox.y + handleBox.height / 2);
  console.log(`📍 [CAPTCHA DRAG] Handle center: (${fromX}, ${fromY})`);

  // 2. Chụp puzzle background (ảnh có lỗ hổng cần điền)
  console.log(`📸 [CAPTCHA DRAG] Capturing puzzle images for SadCaptcha...`);
  const puzzleEl = await page.$(SELECTORS.puzzleImg);
  const pieceEl = await page.$(SELECTORS.slideImg);

  if (!puzzleEl || !pieceEl) {
    console.log(`⚠️ [CAPTCHA DRAG] Puzzle/piece elements not found, skipping`);
    return { attempted: false, offset: 0, success: false };
  }

  const [puzzleSrc, pieceSrc, puzzleBox] = await Promise.all([
    puzzleEl.getAttribute('src'),
    pieceEl.getAttribute('src'),
    puzzleEl.boundingBox(),
  ]);

  if (!puzzleSrc || !pieceSrc) {
    console.log(`⚠️ [CAPTCHA DRAG] Puzzle/piece src not found, skipping`);
    return { attempted: false, offset: 0, success: false };
  }

  // 2b. Nếu captcha này đã từng thất bại → reload để lấy captcha mới
  if (isKnownFailedCaptcha(puzzleSrc, pieceSrc)) {
    console.log(`♻️ [CAPTCHA DRAG] Known-failed captcha detected (puzzleSrc already in failed log)`);
    console.log(`🔄 [CAPTCHA DRAG] Reloading page to get a fresh captcha...`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(randomBetween(1500, 2500));
    return { attempted: false, offset: 0, success: false };
  }

  console.log(`⬇️ [CAPTCHA DRAG] Downloading puzzle: ${puzzleSrc}`);
  console.log(`⬇️ [CAPTCHA DRAG] Downloading piece: ${pieceSrc}`);
  const [puzzleResponse, pieceResponse] = await Promise.all([
    axios.get<ArrayBuffer>(puzzleSrc, { responseType: 'arraybuffer', timeout: 15000 }),
    axios.get<ArrayBuffer>(pieceSrc, { responseType: 'arraybuffer', timeout: 15000 }),
  ]);

  const puzzleBuffer = Buffer.from(puzzleResponse.data);
  const pieceBuffer = Buffer.from(pieceResponse.data);

  // Log URL info + save images for every captcha attempt
  const sessionId = saveCaptchaSession(puzzleBuffer, pieceBuffer, puzzleSrc, pieceSrc, page.url());

  const puzzleBase64 = puzzleBuffer.toString('base64');
  const pieceBase64 = pieceBuffer.toString('base64');

  // 3. Kiểm tra SadCaptcha license key
  const licenseKey = "892c635fe43c761b9d3d785cc4ec3a53"
  // const licenseKey = ""
  if (!licenseKey) {
    console.log(`❌ [CAPTCHA DRAG] SADCAPTCHA_LICENSE_KEY is not configured`);
    return { attempted: false, offset: 0, success: false };
  }

  // 4. Gọi SadCaptcha API lấy tỉ lệ trượt
  const slideXProportion = await callSadCaptchaApi(puzzleBase64, pieceBase64, licenseKey);
  if (slideXProportion === null) {
    console.log(`❌ [CAPTCHA DRAG] Failed to get slideXProportion from SadCaptcha`);
    return { attempted: false, offset: 0, success: false };
  }

  // 5. Tính pixel offset từ chiều rộng puzzle thực tế
  // Nếu không lấy được bounding box, fallback về công thức mobile (46px base)
  const puzzleWidth = puzzleBox?.width ?? 46;
  const offset = Math.round(puzzleWidth * slideXProportion);
  console.log(`📏 [CAPTCHA DRAG] Puzzle width: ${puzzleWidth}px, proportion: ${slideXProportion}, offset: ${offset}px`);

  // 6. Kéo thả
  const toX = fromX + offset;
  const toY = fromY + randomBetween(-2, 2);
  await humanDrag(page, fromX, fromY, toX, toY);

  // 7. Chờ phản hồi captcha
  await page.waitForTimeout(randomBetween(1500, 2500));

  // 8. Kiểm tra xem captcha đã giải xong chưa (element biến mất)
  const stillPresent = await page.$('#secsdk-captcha-drag-wrapper');
  const success = stillPresent === null;
  console.log(`${success ? '✅' : '⚠️'} [CAPTCHA DRAG] Result: ${success ? 'SOLVED' : 'Still present (may need retry)'}`);

  // 9. Lưu toạ độ theo kết quả
  const coordPayload = {
    sessionId,
    pageUrl: page.url(),
    puzzleSrc,
    pieceSrc,
    fromX,
    fromY,
    toX,
    toY,
    offset,
    slideXProportion,
    puzzleWidth,
    timestamp: new Date().toISOString(),
  };

  if (success) {
    saveSuccessfulCoordinates(coordPayload);
  } else {
    saveFailedCoordinates(coordPayload);
  }

  return { attempted: true, offset, success };
}
