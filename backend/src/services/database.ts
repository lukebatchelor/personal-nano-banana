import { Database } from 'bun:sqlite';
import { Session, Batch, BatchReferenceImage, GeneratedImage, BatchWithImages, SessionWithBatches } from '../types';

class DatabaseService {
  private db: Database;

  constructor(dbPath: string = 'database.sqlite') {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    // Create sessions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create batches table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES sessions(id),
        prompt TEXT NOT NULL,
        batch_size INTEGER NOT NULL,
        status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error_message TEXT
      )
    `);

    // Create batch_reference_images table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS batch_reference_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER REFERENCES batches(id),
        filename TEXT NOT NULL,
        original_name TEXT
      )
    `);

    // Create generated_images table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS generated_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER REFERENCES batches(id),
        filename TEXT NOT NULL,
        preview_filename TEXT,
        width INTEGER,
        height INTEGER,
        file_size INTEGER,
        replicate_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_batches_session_id ON batches(session_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_batch_reference_images_batch_id ON batch_reference_images(batch_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_generated_images_batch_id ON generated_images(batch_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at DESC)`);
  }

  // Session operations
  createSession(name: string): Session {
    const stmt = this.db.prepare('INSERT INTO sessions (name) VALUES (?) RETURNING *');
    return stmt.get(name) as Session;
  }

  getSessions(): Session[] {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
    return stmt.all() as Session[];
  }

  getSession(id: number): Session | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id) as Session | null;
  }

  getSessionWithBatches(id: number): SessionWithBatches | null {
    const session = this.getSession(id);
    if (!session) return null;

    const batches = this.getBatchesBySession(id);
    return { ...session, batches };
  }

  // Batch operations
  createBatch(sessionId: number, prompt: string, batchSize: number): Batch {
    const stmt = this.db.prepare('INSERT INTO batches (session_id, prompt, batch_size) VALUES (?, ?, ?) RETURNING *');
    return stmt.get(sessionId, prompt, batchSize) as Batch;
  }

  getBatch(id: number): Batch | null {
    const stmt = this.db.prepare('SELECT * FROM batches WHERE id = ?');
    return stmt.get(id) as Batch | null;
  }

  getBatchesBySession(sessionId: number): BatchWithImages[] {
    const stmt = this.db.prepare('SELECT * FROM batches WHERE session_id = ? ORDER BY created_at DESC');
    const batches = stmt.all(sessionId) as Batch[];
    
    return batches.map(batch => ({
      ...batch,
      images: this.getGeneratedImagesByBatch(batch.id)
    }));
  }

  updateBatchStatus(id: number, status: Batch['status'], errorMessage?: string) {
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    const stmt = this.db.prepare(
      'UPDATE batches SET status = ?, completed_at = ?, error_message = ? WHERE id = ?'
    );
    stmt.run(status, completedAt, errorMessage || null, id);
  }

  // Reference image operations
  addReferenceImage(batchId: number, filename: string, originalName?: string): BatchReferenceImage {
    const stmt = this.db.prepare(
      'INSERT INTO batch_reference_images (batch_id, filename, original_name) VALUES (?, ?, ?) RETURNING *'
    );
    return stmt.get(batchId, filename, originalName || null) as BatchReferenceImage;
  }

  getReferenceImagesByBatch(batchId: number): BatchReferenceImage[] {
    const stmt = this.db.prepare('SELECT * FROM batch_reference_images WHERE batch_id = ?');
    return stmt.all(batchId) as BatchReferenceImage[];
  }

  // Generated image operations
  addGeneratedImage(
    batchId: number,
    filename: string,
    previewFilename?: string,
    metadata?: { width?: number; height?: number; fileSize?: number; replicateId?: string }
  ): GeneratedImage {
    const stmt = this.db.prepare(`
      INSERT INTO generated_images 
      (batch_id, filename, preview_filename, width, height, file_size, replicate_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?) 
      RETURNING *
    `);
    return stmt.get(
      batchId,
      filename,
      previewFilename || null,
      metadata?.width || null,
      metadata?.height || null,
      metadata?.fileSize || null,
      metadata?.replicateId || null
    ) as GeneratedImage;
  }

  getGeneratedImagesByBatch(batchId: number): GeneratedImage[] {
    const stmt = this.db.prepare('SELECT * FROM generated_images WHERE batch_id = ? ORDER BY created_at ASC');
    return stmt.all(batchId) as GeneratedImage[];
  }

  getAllImages(offset: number = 0, limit: number = 20) {
    const stmt = this.db.prepare(`
      SELECT 
        gi.*,
        s.name as session_name,
        b.prompt,
        b.id as batch_id
      FROM generated_images gi
      JOIN batches b ON gi.batch_id = b.id
      JOIN sessions s ON b.session_id = s.id
      ORDER BY gi.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  getImageCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM generated_images');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  close() {
    this.db.close();
  }
}

export default DatabaseService;