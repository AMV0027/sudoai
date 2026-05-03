import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
const dataDir = path.join(process.cwd(), '.sudoai');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'memory.db');
const db = new Database(dbPath) as any;

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    role TEXT, -- 'user', 'assistant', 'system', 'tool'
    content TEXT,
    thought TEXT,
    tool_calls TEXT,
    tool_results TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS long_term_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE,
    value TEXT,
    embedding BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Ensure columns exist (for migrations)
try {
  db.exec('ALTER TABLE messages ADD COLUMN plan TEXT;');
} catch (e) {
  // Column already exists
}

export default db;
