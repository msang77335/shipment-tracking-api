import { PlaywrightBrowserSingleton } from "../PlaywrightBrowserSingleton";

const SHOP_API_URL = 'https://shopee.vn/api/v4/shop/get_shop_base_v2';
const SHOP_API_TIMEOUT = 60000;

export async function shopeeCheckShop(
  url: string): Promise<{ status: string; shopName?: string }> {

  console.log(`🚀 [SHOPEE CHECK SHOP] Starting screenshot for: ${url}`);

  const browser = await PlaywrightBrowserSingleton.getInstance();
  if (!browser) {
    throw new Error('Browser instance is not available');
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1080 },
  });
  const page = await context.newPage();

  try {
    // Listen for the shop data API — take screenshot as soon as it responds
    let shopName: string | undefined;
    let status = 'AVAILABLE';
    const shopApiPromise = page.waitForResponse(
      (res) => res.url() === SHOP_API_URL && res.request().method() === 'POST',
      { timeout: SHOP_API_TIMEOUT }
    );

    console.log(`🌐 [SHOPEE CHECK SHOP] Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch (gotoError: any) {
      console.log(`⚠️ [SHOPEE CHECK SHOP] Navigation issue: ${gotoError.message}, retrying with 'load'...`);
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    }

    console.log(`🔍 [SHOPEE CHECK SHOP] Waiting for ${SHOP_API_URL}...`);
    try {
      const res = await shopApiPromise;
      console.log(`✅ [SHOPEE CHECK SHOP] Shop API responded with status ${res.status()}`);
      try {
        const json = await res.json();
        const data = json?.data;

        if (!data || json?.error || json?.error_msg) {
          console.log(`❌ [SHOPEE CHECK SHOP] API returned error or empty data — shop UNAVAILABLE`);
          status = 'UNAVAILABLE';
        } else {
          shopName = data.name || undefined;

          if (data.is_censored === true) {
            console.log(`❌ [SHOPEE CHECK SHOP] is_censored=true — UNAVAILABLE`);
            status = 'UNAVAILABLE';
          } else if (data.vacation === true) {
            console.log(`❌ [SHOPEE CHECK SHOP] vacation=true — UNAVAILABLE`);
            status = 'UNAVAILABLE';
          } else if (data.account?.status !== undefined && data.account.status !== 1) {
            console.log(`❌ [SHOPEE CHECK SHOP] account.status=${data.account.status} (not 1) — UNAVAILABLE`);
            status = 'UNAVAILABLE';
          } else if (data.item_count === 0) {
            console.log(`⚠️ [SHOPEE CHECK SHOP] item_count=0 — UNAVAILABLE`);
            status = 'UNAVAILABLE';
          }
        }
        console.log(`📊 [SHOPEE CHECK SHOP] Shop name: ${shopName}, status: ${status}`);
      } catch {
        console.log(`⚠️ [SHOPEE CHECK SHOP] Could not parse shop API response body`);
      }
    } catch {
      console.log(`⚠️ [SHOPEE CHECK SHOP] Shop API did not respond in time, taking screenshot anyway`);
    }

    // Small buffer for render to settle
    await page.waitForTimeout(10000);

    console.log(`✅ [SHOPEE CHECK SHOP] Done — status: ${status}, shopName: ${shopName}`);
    return { status, shopName };
  } finally {
    await page.close();
    await context.close();
  }
}