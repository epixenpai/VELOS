import db from '../db.js';
import crypto from 'crypto';
import path from 'path';

export const getAssets = (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM assets ORDER BY createdAt DESC').all();
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const uploadAsset = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.file;
  const id = crypto.randomUUID();
  // Using path posix to ensure consistent URL separators regardless of OS
  const relativePath = path.posix.join('assets', 'videos', file.filename);

  try {
    const stmt = db.prepare(`
      INSERT INTO assets (id, name, type, path, mimeType, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Defaulting to video for Phase 1 MVP
    stmt.run(id, file.originalname, 'video', relativePath, file.mimetype, file.size);

    res.status(201).json({
      id,
      name: file.originalname,
      type: 'video',
      path: relativePath,
      mimeType: file.mimetype,
      size: file.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};