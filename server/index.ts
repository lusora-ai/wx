import 'dotenv/config';
import express from 'express';
import { sourcesRouter } from './routes/sources';
import { topicsRouter } from './routes/topics';
import { articlesRouter } from './routes/articles';
import { reviewsRouter } from './routes/reviews';
import { publishRouter } from './routes/publish';
import { settingsRouter } from './routes/settings';
import { dashboardRouter } from './routes/dashboard';
import { imageSlotsRouter } from './routes/imageSlots';
import { sourceItemsRouter } from './routes/sourceItems';
import { aiHealthRouter } from './routes/aiHealth';
import { fetchTasksRouter } from './routes/fetchTasks';
import { dailyRouter } from './routes/daily';
import { sourcePresetsRouter } from './routes/sourcePresets';
import { tasksRouter } from './routes/tasks';
import { wechatRouter } from './routes/wechat';
import { automationRouter } from './routes/automation';

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.use(express.json({ limit: '2mb' }));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'http://localhost:3100');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));

app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/dashboard', dashboardRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/source-items', sourceItemsRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/articles', articlesRouter);
app.use('/api', imageSlotsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/publish', publishRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/ai', aiHealthRouter);
app.use('/api/fetch-tasks', fetchTasksRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/source-presets', sourcePresetsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/wechat', wechatRouter);
app.use('/api/automation', automationRouter);

app.listen(port, () => {
  console.log(`Xiaoshun API listening on http://localhost:${port}`);
});
