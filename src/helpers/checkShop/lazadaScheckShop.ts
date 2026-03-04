import { PlaywrightBrowserSingleton } from "../PlaywrightBrowserSingleton";

export async function lazadaCheckShop(
  url: string): Promise<{ status: string; shopName: string }> {

  console.log(`🚀 [LAZADA CHECK SHOP] Starting screenshot for: ${url}`);

  const browser = await PlaywrightBrowserSingleton.getInstance();
  if (!browser) {
    throw new Error('Browser instance is not available');
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1080 },
  });
  const page = await context.newPage();

  try {
    console.log(`🌐 [LAZADA CHECK SHOP] Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (gotoError: any) {
      console.log(`⚠️ [LAZADA CHECK SHOP] Navigation issue: ${gotoError.message}, retrying with 'load'...`);
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    }

    console.log(`⏱️ [LAZADA CHECK SHOP] Waiting 30000 ms after load...`);
    await page.waitForTimeout(30000);

    const finalUrl = page.url();
    const title = await page.title();
    console.log(`📊 [LAZADA CHECK SHOP] Page title: "${title}", final URL: ${finalUrl}`);

    // Check for error page indicators
    const isErrorPage = await page.evaluate(() => {
      const doc = (globalThis as any).document;
      // Case 1: error page title element
      if (doc.querySelector('.error-page-title')) return true;
      // Case 2: body has data-spm="store_error"
      if (doc.body?.dataset.spm === 'store_error') return true;
      // Case 3: common-error iframe (errCode in URL)
      if (doc.querySelector('iframe[src*="common-error"]')) return true;
      // Case 4: specific text content indicating shop not found
      if(doc.querySelector('.shop-enter-fail-page')) return true;
      return false;
    });

    let status = 'AVAILABLE';

    if (isErrorPage) {
      console.log(`❌ [LAZADA CHECK SHOP] Detected error page element (.error-page-title) — shop UNAVAILABLE`);
      status = 'UNAVAILABLE';
    }

    console.log(`✅ [LAZADA CHECK SHOP] Determined shop status: ${status}`);
    return { status, shopName: title };
  } finally {
    await page.close();
    await context.close();
  }
}
