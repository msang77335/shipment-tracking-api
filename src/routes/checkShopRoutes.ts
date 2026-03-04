import { Request, Response, Router } from 'express';
import { isLazada, isShopee } from '../helpers';
import { lazadaCheckShop } from '../helpers/checkShop/lazadaScheckShop';
import { shopeeCheckShop } from '../helpers/checkShop/shopeeScheckShop';

const router = Router();

interface CheckShopRequestBody {
  url: string;
}

// POST /api/v1/checkshop - Screenshot an arbitrary URL
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  console.log(`🚀 [CHECK SHOP ROUTE] Starting request at ${new Date().toISOString()}`);

  try {
    const {
      url,
    }: CheckShopRequestBody = req.body;

    if (!url) {
      console.log(`❌ [CHECK SHOP ROUTE] Missing url parameter`);
      res.status(400).json({
        success: false,
        error: 'url parameter is required'
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      console.log(`❌ [CHECK SHOP ROUTE] Invalid URL: ${url}`);
      res.status(400).json({
        success: false,
        error: `Invalid URL: ${url}`
      });
      return;
    }

    console.log(`🌐 [CHECK SHOP ROUTE] Screenshotting URL: ${url}`);
    let result: { status: string; shopName?: string } = {
      status: 'UNKNOWN',
    };

    if (isLazada(url)) {
      console.log(`🔍 [CHECK SHOP ROUTE] Detected Lazada URL, using lazadaCheckShop...`);
      result = await lazadaCheckShop(url);
    } else if (isShopee(url)) {
      console.log(`🔍 [CHECK SHOP ROUTE] Detected Shopee URL, using shopeeCheckShop...`);
      result = await shopeeCheckShop(url);
    } else {
      console.log(`❌ [CHECK SHOP ROUTE] Unsupported URL: ${url}`);
      res.status(400).json({
        success: false,
        error: `Unsupported URL: ${url}`
      });
      return;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [CHECK SHOP ROUTE] Completed in ${duration}ms`);

    res.status(200).json({
      success: true,
      data: {
        status: result.status,
        shopName: result.shopName || null,
      },
      metadata: {
        url,
        processingTime: duration,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`💥 [CHECK SHOP ROUTE] Error after ${duration}ms:`, error);
    console.error(`💥 [CHECK SHOP ROUTE] Stack:`, error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

export default router;
