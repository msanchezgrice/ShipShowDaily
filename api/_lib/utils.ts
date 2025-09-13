import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

// Helper to set CORS headers
export function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Helper to handle method validation
export function validateMethod(req: VercelRequest, res: VercelResponse, allowedMethods: string[]): boolean {
  // Set CORS headers for all responses
  setCorsHeaders(res);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false;
  }
  
  if (!allowedMethods.includes(req.method || '')) {
    res.status(405).json({ message: `Method ${req.method} not allowed` });
    return false;
  }
  return true;
}

// Helper to handle errors
export function handleError(res: VercelResponse, error: any, defaultMessage = "Internal server error") {
  console.error("API Error:", error);
  setCorsHeaders(res);
  
  if (error instanceof z.ZodError) {
    return res.status(400).json({ 
      message: "Invalid request data", 
      errors: error.errors 
    });
  }
  
  const status = error.status || error.statusCode || 500;
  const message = error.message || defaultMessage;
  
  return res.status(status).json({ message });
}

// Helper to send success response
export function sendSuccess(res: VercelResponse, data: any, status = 200) {
  setCorsHeaders(res);
  return res.status(status).json(data);
}

// Helper to extract query parameters
export function getQueryParam(req: VercelRequest, key: string, defaultValue?: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) {
    return value[0] || defaultValue;
  }
  return value || defaultValue;
}

// Helper to extract numeric query parameters
export function getQueryParamAsNumber(req: VercelRequest, key: string, defaultValue?: number): number | undefined {
  const value = getQueryParam(req, key);
  if (value === undefined) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}