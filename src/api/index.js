import express from 'express';
import { Target, Event } from '../db/index.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const API_TOKEN = config.API_TOKEN;

function auth(req, res, next) {
  if (!API_TOKEN) return next();
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query?.token;
  if (token !== API_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function createApi() {
  const app = express();
  app.use(express.json());
  app.use(auth);

  app.get('/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.get('/targets', async (req, res) => {
    try {
      const list = await Target.find({}).lean().sort({ createdAt: 1 });
      res.json({ targets: list });
    } catch (err) {
      logger.warn({ err }, 'API GET /targets');
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/targets', async (req, res) => {
    try {
      const { type, address, name, checkMethod, tcpPort, intervalSeconds, enabled } = req.body || {};
      if (!type || !address) {
        res.status(400).json({ error: 'type and address required' });
        return;
      }
      const t = await Target.create({
        type,
        address,
        name: name || '',
        checkMethod: checkMethod || (type === 'url' ? 'http' : 'tcp'),
        tcpPort: tcpPort ?? (type === 'ip' ? 80 : undefined),
        intervalSeconds: intervalSeconds ?? undefined,
        enabled: enabled !== false,
      });
      res.status(201).json(t);
    } catch (err) {
      if (err.code === 11000) res.status(409).json({ error: 'Duplicate address' });
      else res.status(500).json({ error: err.message });
    }
  });

  app.patch('/targets/:id', async (req, res) => {
    try {
      const allowed = ['name', 'address', 'checkMethod', 'tcpPort', 'intervalSeconds', 'enabled'];
      const update = {};
      for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
      const t = await Target.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!t) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(t);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/targets/:id', async (req, res) => {
    try {
      const t = await Target.findByIdAndDelete(req.params.id);
      if (!t) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/events', async (req, res) => {
    try {
      const targetId = req.query.targetId;
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const q = targetId ? { targetId } : {};
      const list = await Event.find(q).lean().sort({ at: -1 }).limit(limit);
      res.json({ events: list });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

export function startApi(app) {
  return new Promise((resolve) => {
    const server = app.listen(config.API_PORT, () => {
      logger.info({ port: config.API_PORT }, 'API server listening');
      resolve(server);
    });
    return server;
  });
}
