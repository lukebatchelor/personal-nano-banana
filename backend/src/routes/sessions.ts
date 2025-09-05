import { Hono } from 'hono';
import DatabaseService from '../services/database';

const sessions = new Hono();
const db = new DatabaseService();

// POST /api/sessions - Create new session
sessions.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'Session name is required' }, 400);
    }

    const session = db.createSession(name);
    return c.json({ sessionId: session.id, session });
  } catch (error) {
    console.error('Error creating session:', error);
    return c.json({ error: 'Failed to create session' }, 500);
  }
});

// GET /api/sessions - List all sessions
sessions.get('/', async (c) => {
  try {
    const sessions = db.getSessions();
    const sessionsWithBatchCount = sessions.map(session => {
      const batches = db.getBatchesBySession(session.id);
      return {
        ...session,
        batchCount: batches.length
      };
    });
    
    return c.json(sessionsWithBatchCount);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return c.json({ error: 'Failed to fetch sessions' }, 500);
  }
});

// GET /api/sessions/:sessionId - Get session details
sessions.get('/:sessionId', async (c) => {
  try {
    const sessionId = parseInt(c.req.param('sessionId'));
    
    if (isNaN(sessionId)) {
      return c.json({ error: 'Invalid session ID' }, 400);
    }

    const sessionWithBatches = db.getSessionWithBatches(sessionId);
    
    if (!sessionWithBatches) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json(sessionWithBatches);
  } catch (error) {
    console.error('Error fetching session:', error);
    return c.json({ error: 'Failed to fetch session' }, 500);
  }
});

export default sessions;