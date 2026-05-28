import express from 'express';
import router from './routes.js';

const app = express();
app.use(express.json());

// 간단한 API 키 인증 미들웨어
app.use('/api', (req, res, next) => {
  // /api/health 는 인증 없이 통과 (Fly.io 헬스체크)
  if (req.path === '/health') return next();

  const key = req.headers['x-api-key'];
  if (!process.env.API_KEY || key === process.env.API_KEY) return next();

  res.status(401).json({ error: 'Unauthorized' });
});

app.use('/api', router);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

export function startApiServer(port = 3000) {
  app.listen(port, () => {
    console.log(`🌐 API 서버 실행 중: http://localhost:${port}/api`);
    console.log(`   GET /api/health`);
    console.log(`   GET /api/schedules/:guildId`);
    console.log(`   GET /api/schedule/:id`);
    console.log(`   GET /api/stats/:guildId`);
  });
}

export default app;
