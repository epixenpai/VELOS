import express from 'express';
import { getProjects, getProject, createProject, updateProjectState } from '../controllers/projectController.js';

const router = express.Router();

router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', createProject);
router.put('/:id/state', updateProjectState);

export default router;