import { Router } from 'express';
import { getTodayContentTasks } from '../services/contentTaskService';
import { asyncRoute, ok } from '../types/api';

export const tasksRouter = Router();

tasksRouter.get('/today', asyncRoute(async (_req, res) => {
  const result = await getTodayContentTasks();
  return ok(res, result);
}));
