import { solveDragCaptcha } from "../captchaDragSolver";
import { PlaywrightBrowserSingleton } from "../PlaywrightBrowserSingleton";

export interface UrlScreenshotOptions {
  fullPage?: boolean;
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  waitMs?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface UrlScreenshotResult {
  shopName: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
}

export async function tiktokShopCheckShop(
  url: string,
  options: UrlScreenshotOptions = {}
): Promise<UrlScreenshotResult> {
  const {
    waitUntil = 'domcontentloaded',
    waitMs = 30000,
    viewportWidth = 1280,
    viewportHeight = 1080,
  } = options;

  console.log(`🚀 [CHECK SHOP] Starting screenshot for: ${url}`);

  const browser = await PlaywrightBrowserSingleton.getInstance();
  if (!browser) {
    throw new Error('Browser instance is not available');
  }

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
  });
  const page = await context.newPage();

  try {
    console.log(`🌐 [CHECK SHOP] Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil, timeout: 60000 });
    } catch (gotoError: any) {
      console.log(`⚠️ [CHECK SHOP] Navigation issue: ${gotoError.message}, retrying with 'load'...`);
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    }

    if (waitMs > 0) {
      console.log(`⏱️ [CHECK SHOP] Waiting ${waitMs}ms after load...`);
      await page.waitForTimeout(waitMs);
    }

    const finalUrl = page.url();
    const title = await page.title();
    console.log(`📊 [CHECK SHOP] Page title: "${title}", final URL: ${finalUrl}`);

    // Thử giải puzzle captcha kéo-thả (tối đa 3 lần)
    const MAX_CAPTCHA_RETRIES = 10;
    for (let attempt = 1; attempt <= MAX_CAPTCHA_RETRIES; attempt++) {
      const result = await solveDragCaptcha(page);
      if (!result.attempted) break; // Không có captcha
      if (result.success) {
        console.log(`✅ [CHECK SHOP] Captcha solved on attempt ${attempt}`);
        break;
      }
      if (attempt < MAX_CAPTCHA_RETRIES) {
        console.log(`🔄 [CHECK SHOP] Captcha attempt ${attempt} failed, retrying...`);
        await page.waitForTimeout(1000);
      } else {
        console.log(`⚠️ [CHECK SHOP] Captcha not confirmed solved after ${MAX_CAPTCHA_RETRIES} attempts, proceeding anyway`);
      }
    }

    await page.waitForTimeout(10000);
    
    return { shopName: title, status: 'AVAILABLE' };
  } finally {
    await page.close();
    await context.close();
  }
}
