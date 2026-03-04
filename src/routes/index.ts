import { Request, Response, Router } from 'express';
import checkShopRoutes from './checkShopRoutes';
import trackingRoutes from './trackingRoutes';

const router = Router();

// Mount route handlers
router.use('/tracking', trackingRoutes);
router.use('/checkshop', checkShopRoutes);

// Default API route
router.get('/', (req: Request, res: Response): void => {
  res.json({
    success: true,
    message: 'Express API Server is running!',
    endpoints: {
      health: '/health',
      tracking: '/api/v1/tracking',
      checkshop: '/api/v1/checkshop'
    }
  });
});

export default router;