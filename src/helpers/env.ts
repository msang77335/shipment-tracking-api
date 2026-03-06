/**
 * Environment Configuration Helper
 * Centralized environment variable management with type safety and defaults
 */

import dotenv from 'dotenv';
dotenv.config();

export interface EnvConfig {
  // Environment
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Server
  port: number;
  apiPrefix: string;
  trustProxy: string;
  xApiKey?: string;
  
  // Captcha Services
  captchaSolverApiKey?: string;
  captcha2CaptchaKey?: string;
  captchaAnticaptchaKey?: string;
  sadCaptchaLicenseKey?: string;
  
  // AI Services
  geminiApiKey?: string;
  googleAiApiKey?: string;
  
  // Browser Services
  browserlessApiToken?: string;

  // Shopee Credentials
  shopeeUsername?: string;
  shopeePassword?: string;
}

/**
 * Get environment configuration with defaults and type safety
 */
export function getEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  return {
    // Environment
    nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    
    // Server
    port: Number.parseInt(process.env.PORT || '8080', 10),
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    trustProxy: process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal',    
    // Captcha Services
    captchaSolverApiKey: process.env.CAPTCHA_SOLVER_API_KEY || undefined,
    sadCaptchaLicenseKey: process.env.SADCAPTCHA_LICENSE_KEY || undefined,

    // AI Services
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    
    // Browser Services
    browserlessApiToken: process.env.BROWSERLESS_API_TOKEN || undefined,

    // API Key for accessing the API
    xApiKey: process.env.X_API_KEY || undefined,

    // Shopee Credentials
    shopeeUsername: process.env.SHOPEE_USERNAME || undefined,
    shopeePassword: process.env.SHOPEE_PASSWORD || undefined,
  };
}

/**
 * Get a specific environment variable with optional default
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

/**
 * Check if environment variable exists
 */
export function hasEnvVar(key: string): boolean {
  return !!process.env[key];
}

/**
 * Require an environment variable (throws if not set)
 */
export function requireEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Required environment variable ${key} is not set`);
  }
  return value;
}

// Export singleton instance
export const env = getEnv();

console.log('✅ Environment configuration loaded:', {
  nodeEnv: env.nodeEnv,
  port: env.port,
  apiPrefix: env.apiPrefix,
  trustProxy: env.trustProxy,
  hasCaptchaSolverApiKey: !!env.captchaSolverApiKey,
  hasSadCaptchaLicenseKey: !!env.sadCaptchaLicenseKey,
  hasGeminiApiKey: !!env.geminiApiKey,
  hasBrowserlessApiToken: !!env.browserlessApiToken,
  hasXApiKey: !!env.xApiKey,
  hasShopeeCredentials: !!(env.shopeeUsername && env.shopeePassword),
}); 