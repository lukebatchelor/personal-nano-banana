import DatabaseService from './database';

// Create a single shared database instance
const dbPath = process.env.DATABASE_PATH || 'database.sqlite';
const db = new DatabaseService(dbPath);

export default db;