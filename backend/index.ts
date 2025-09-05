import { Hono } from 'hono';
import { corsMiddleware } from './src/middleware/cors';
import { errorMiddleware } from './src/middleware/error';
import DatabaseService from './src/services/database';

// Import route modules
import sessions from './src/routes/sessions';
import batches from './src/routes/batches';
import images from './src/routes/images';
import upload from './src/routes/upload';

const app = new Hono();

// Initialize database
const db = new DatabaseService();

// Global middleware
app.use('*', errorMiddleware);
app.use('*', corsMiddleware);

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