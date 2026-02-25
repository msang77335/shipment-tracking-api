# Copilot Instructions for Shipment Tracking API

## Project Overview
This is a **Shipment Tracking API** built with **TypeScript**, **Express.js**, and **Playwright**. The API provides screenshot-based tracking for multiple shipping carriers by scraping their tracking pages.

## Technology Stack
- **Runtime**: Node.js (v16+)
- **Framework**: Express.js with TypeScript
- **Browser Automation**: Playwright (with singleton pattern)
- **Captcha Solving**: 2Captcha, Anticaptcha
- **AI Integration**: Google Generative AI
- **Security**: Helmet, CORS, Rate Limiting
- **Build**: TypeScript with strict mode

## Code Style & Conventions

### TypeScript
- **Strict mode enabled**: All code must satisfy strict TypeScript checks
- Use explicit types for function parameters and return values
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use `async/await` over Promises (no `.then()` chains)
- Target: ES2020, Module: CommonJS

### Path Aliases
Use configured TypeScript path aliases:
```typescript
import { helper } from '@/helpers/helper';
import { middleware } from '@/middleware/middleware';
import { routes } from '@/routes/routes';
```

### Logging
- Use console.log with emoji prefixes for visibility:
  - 🚀 - Starting operations
  - ✅ - Success
  - ❌ - Errors
  - ⚠️ - Warnings
  - 🔍 - Checking/Searching
  - 📊 - Data/Status
  - 🌐 - Navigation
  - 📸 - Screenshots
  - ⏱️ - Timing/Performance
- Always log start and completion with timestamps
- Include context in error logs

### Error Handling
- Use try-catch blocks for async operations
- Always return meaningful error messages in API responses
- Log errors with detailed context before returning
- Use proper HTTP status codes (400, 404, 500, etc.)
- Set `success: false` in error response bodies

### Express Routes
- Use Express Router for route organization
- Define interfaces for request query/body parameters
- Use `async (req, res): Promise<void>` for handlers
- Return early for validation errors
- Always use `res.status().json()` for API responses

## Architecture Patterns

### Singleton Pattern
The `PlaywrightBrowserSingleton` maintains a single browser instance:
- Always use `PlaywrightBrowserSingleton.getInstance()` 
- Never create new browser instances directly
- Browser is shared across all requests for efficiency

### Helper Functions Organization
- Shipping provider helpers in `/src/helpers/`
- Each provider has dedicated screenshoter function
- Use helper utility functions (isSPX, isViettelPost, etc.) for provider detection
- Export all helpers from `/src/helpers/index.ts`
- **Environment helper** (`env.ts`) - Centralized type-safe config
- **Token/Key rotators** - Round-robin for Gemini API and Browserless tokens

### Middleware
- Keep middleware in `/src/middleware/`
- Error handler should be the last middleware
- Not found handler before error handler
- Use Express error handling signature: `(err, req, res, next)`

## Playwright Best Practices

### Page Navigation
```typescript
await page.goto(url, {
  waitUntil: 'domcontentloaded',
  timeout: 60000
});
```
- Use 'domcontentloaded' first, fallback to 'load' on error
- Set reasonable timeouts (60 seconds for navigation)
- Handle navigation errors gracefully with retries

### Element Selection
- Use `page.evaluate()` for DOM queries
- Cast `globalThis as any` when accessing `document` in evaluate context
- Check element existence before accessing properties
- Use optional chaining for nested properties

### Screenshot Capture
- Return images as base64 strings
- Include metadata in response headers
- Set proper Content-Type headers
- Clean up resources after capture

## API Response Format

### Success Response
```typescript
res.status(200).json({
  success: true,
  data: result,
  metadata: {
    provider: 'provider-name',
    timestamp: new Date().toISOString(),
    processingTime: Date.now() - startTime
  }
});
```

### Error Response
```typescript
res.status(400).json({
  success: false,
  error: 'Descriptive error message'
});
```

## Environment Variables
- Load using `dotenv` at app entry point
- Use centralized `env` helper for type-safe access
- Access via `env.propertyName` instead of `process.env.VARIABLE_NAME`
- Provide defaults in env helper
- Document all required variables in `.env.example`

### Environment Helper Usage
```typescript
// ✅ Good - Use env helper
import { env } from '@/helpers';
const port = env.port;
const apiKey = env.geminiApiKey;

// ❌ Bad - Direct process.env access
const port = process.env.PORT || 8080;
```

### Multiple API Keys/Tokens (Round-Robin)
For services with quota/rate limits, use comma-separated keys for rotation:

**Gemini API Keys:**
```env
GEMINI_API_KEY=key1,key2,key3
```
```typescript
import { getNextGeminiApiKey } from '@/helpers';
const apiKey = getNextGeminiApiKey(); // Auto-rotates
```

**Browserless Tokens:**
```env
BROWSERLESS_API_TOKEN=token1,token2,token3
```
```typescript
import { getNextBrowserlessToken } from '@/helpers';
const token = getNextBrowserlessToken(); // Auto-rotates
```

Benefits:
- Multiply quota limits (3 keys = 3x quota)
- Distribute rate limits across accounts
- High availability if one key hits limits

## Security Considerations
- Rate limiting: 100 requests per 15 minutes per IP
- Helmet for security headers with CSP
- CORS enabled for cross-origin requests
- Request size limit: 10mb
- Request timeout: 5 minutes for long-running scraping
- Trust proxy settings for proper IP detection behind reverse proxies

## Testing
- Use Jest for testing (configured but implement tests)
- Mock Playwright browser instances in tests
- Test error scenarios and edge cases
- Test rate limiting and timeout behavior

## Docker
- Dockerfile includes Playwright dependencies
- See DOCKER.md for container-specific instructions
- Ensure all system dependencies are installed for headless browsers

## Performance
- Compression enabled for responses
- Browser instance reused via singleton pattern
- Timeouts configured to prevent hanging requests
- Consider caching for frequently accessed tracking numbers

## Shipping Provider Integrations

### Supported Providers
- **Aftership**: Generic tracking aggregator
- **Best Express**: Vietnamese logistics
- **Viettel Post**: Vietnamese postal service  
- **VN Post**: Vietnam Post
- **SPX (Shopee Express)**: Southeast Asian logistics
- **Giao Hang Nhanh (GHN)**: Vietnamese express delivery
- **YunExpress**: Chinese international logistics
- **JT Express**: Asian express delivery
- **USPS**: United States Postal Service

### Provider Detection
Use helper functions for provider identification:
```typescript
if (isSPX(provider)) {
  // SPX-specific logic
}
```

### Adding New Providers
1. Create helper function in `/src/helpers/[provider]Screenshoter.ts`
2. Add provider detection helper in `/src/helpers/index.ts`
3. Export from `/src/helpers/index.ts`
4. Add route handler logic in `/src/routes/trackingRoutes.ts`
5. Test with real tracking numbers

## Common Pitfalls to Avoid
- ❌ Don't create multiple browser instances
- ❌ Don't forget timeout configurations  
- ❌ Don't ignore error handling in async operations
- ❌ Don't use `.then()` instead of `async/await`
- ❌ Don't forget to log operations for debugging
- ❌ Don't return without setting proper HTTP status codes
- ❌ Don't leak resources (always clean up pages/contexts)
- ❌ Don't use `process.env` directly - use `env` helper instead
- ❌ Don't forget to check if API keys/tokens exist before using them

## Development Workflow
- Use `npm run dev` for development with hot reload
- Run `npm run build` before testing production builds
- Use `npm run lint:fix` to auto-fix linting issues
- Keep nodemon.json configuration for TypeScript watching

## Code Generation Guidelines
When generating new code:
1. Follow existing patterns in similar files
2. Include proper TypeScript types
3. Add logging with appropriate emojis
4. Handle errors gracefully with try-catch
5. Return consistent API response formats
6. Document complex logic with comments
7. Use existing helper utilities when applicable
8. Consider timeout and retry logic for network operations
