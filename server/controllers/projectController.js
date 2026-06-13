import db from '../db.js';
import crypto from 'crypto';

export const getProjects = (req, res) => {
  try {
    const projects = db.prepare('SELECT id, name, aspectRatio, frameRate, updatedAt FROM projects ORDER BY updatedAt DESC').all();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProject = (req, res) => {
  const { id } = req.params;
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    // Parse the JSON state string if it exists
    if (project.state) {
      project.state = JSON.parse(project.state);
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProject = (req, res) => {
  const { name, aspectRatio = '16:9', frameRate = 30 } = req.body;
  const id = crypto.randomUUID();
  const initialState = JSON.stringify({ tracks: [], settings: { width: 1920, height: 1080 } }); // Basic default state

  try {
    const stmt = db.prepare('INSERT INTO projects (id, name, aspectRatio, frameRate, state) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, name, aspectRatio, frameRate, initialState);
    res.status(201).json({ id, name, aspectRatio, frameRate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProjectState = (req, res) => {
  const { id } = req.params;
  const { state } = req.body;
  try {
    const stmt = db.prepare("UPDATE projects SET state = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?");
    stmt.run(JSON.stringify(state), id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
