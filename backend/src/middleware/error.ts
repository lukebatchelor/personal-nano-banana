import type { Context, Next } from 'hono';

export const errorMiddleware = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    
    if (error instanceof Error) {
      return c.json({
        error: error.message,
        status: 'error'
      }, 500);
    }
    
    return c.json({
      error: 'Internal server error',
      status: 'error'
    }, 500);
  }
};