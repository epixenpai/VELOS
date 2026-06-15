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

  let type = 'video';
  let folder = 'videos';
  if (file.mimetype.startsWith('image/')) { type = 'image'; folder = 'images'; }
  if (file.mimetype.startsWith('audio/')) { type = 'audio'; folder = 'audio'; }

  const relativePath = path.posix.join('assets', folder, file.filename);

  try {
    const stmt = db.prepare(`
      INSERT INTO assets (id, name, type, path, mimeType, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, file.originalname, type, relativePath, file.mimetype, file.size);

    res.status(201).json({
      id,
      name: file.originalname,
      type,
      path: relativePath,
      mimeType: file.mimetype,
      size: file.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};