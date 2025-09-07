import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { corsMiddleware } from './src/middleware/cors';
import { errorMiddleware } from './src/middleware/error';
import db from './src/services/db';
import { ensureDirectoriesExist } from './src/config/paths';

// Import route modules
import sessions from './src/routes/sessions';
import batches from './src/routes/batches';
import images from './src/routes/images';
import upload from './src/routes/upload';

const app = new Hono();

// Ensure storage directories exist
ensureDirectoriesExist();

// Global middleware
app.use('*', errorMiddleware);
app.use('*', corsMiddleware);

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './public' }));
}

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Nano Banana Image Generation API',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', database: 'connected' });
});

// Mount API routes
app.route('/api/sessions', sessions);
app.route('/api', batches); // batches route includes /sessions/:sessionId/batches and /batches/:id/status
app.route('/api/images', images);
app.route('/api/upload', upload);

const port = process.env.PORT || 3000;

console.log(`Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

// Make database available for cleanup
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  db.close();
  process.exit(0);
});