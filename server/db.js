import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Define the target directory and database path
const dbDir = path.join(__dirname, '../db');
const dbPath = path.join(dbDir, 'velos.sqlite');

// 3. Ensure the '../db' directory actually exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// 4. Initialize the database safely
const db = new Database(dbPath);
// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aspectRatio TEXT NOT NULL DEFAULT '16:9',
    frameRate INTEGER NOT NULL DEFAULT 30,
    state TEXT, -- JSON string of the timeline/editor state
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    projectId TEXT, -- Optional, if NULL it's a global asset
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'video', 'audio', 'image', 'font'
    path TEXT NOT NULL, -- Relative path to the file
    mimeType TEXT,
    size INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (projectId) REFERENCES projects (id) ON DELETE CASCADE
  );
`);

export default db;
