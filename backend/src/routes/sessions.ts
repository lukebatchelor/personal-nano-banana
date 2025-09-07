import { Hono } from 'hono';
import db from '../services/db';
import { CreateSessionSchema, SessionIdParam } from '../validation/schemas';

const sessions = new Hono();

// POST /api/sessions - Create new session
sessions.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = CreateSessionSchema.parse(body);

    const session = db.createSession(validatedData.name);
    return c.json({ sessionId: session.id, session });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: error.errors[0].message }, 400);
    }
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
    const params = SessionIdParam.parse({ sessionId: c.req.param('sessionId') });
    const sessionWithBatches = db.getSessionWithBatches(params.sessionId);
    
    if (!sessionWithBatches) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json(sessionWithBatches);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: error.errors[0].message }, 400);
    }
    console.error('Error fetching session:', error);
    return c.json({ error: 'Failed to fetch session' }, 500);
  }
});

export default sessions;