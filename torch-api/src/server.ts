import Fastify from 'fastify';
import { getEnv } from './config/env.js';
import { safeReadJson, safeListFiles, safeJoin } from './lib/fs.js';
import { computeBettingRunSummary, computeResolverRunSummary } from './lib/summaries.js';
const LIST_CACHE = 'public, max-age=10';
const DETAIL_CACHE = 'public, max-age=30';

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function main() {
  const env = getEnv();
  const fastify = Fastify({ logger: true });

  fastify.addHook('preHandler', async (request, reply) => {
    const auth = request.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!constantTimeCompare(token, env.DASHBOARD_API_TOKEN)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.get('/api/health', async (_request, reply) => {
    reply.header('Cache-Control', LIST_CACHE);
    const nowUtc = new Date().toISOString();

    const bettingFiles = await safeListFiles(env.BETTING_RUNS_DIR);
    const bettingDates = bettingFiles
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.replace('.json', ''))
      .sort()
      .reverse();
    let lastBettingRun: ReturnType<typeof computeBettingRunSummary> = null;
    if (bettingDates.length > 0) {
      const date = bettingDates[0];
      const path = safeJoin(env.BETTING_RUNS_DIR, `${date}.json`);
      if (path) {
        const json = await safeReadJson(path);
        lastBettingRun = computeBettingRunSummary(date, json);
      }
    }

    const resolverFiles = await safeListFiles(env.RESOLVER_RUNS_DIR);
    const resolverNames = resolverFiles
      .filter((f) => f.startsWith('RESOLVE-') && f.endsWith('.json'))
      .sort()
      .reverse();
    let lastResolverRun: ReturnType<typeof computeResolverRunSummary> = null;
    if (resolverNames.length > 0) {
      const filename = resolverNames[0];
      const id = filename.replace('.json', '');
      const path = safeJoin(env.RESOLVER_RUNS_DIR, filename);
      if (path) {
        const json = await safeReadJson(path);
        lastResolverRun = computeResolverRunSummary(id, filename, json);
      }
    }

    return reply.send({
      nowUtc,
      lastBettingRun,
      lastResolverRun,
    });
  });

  fastify.get('/api/betting/runs', async (_request, reply) => {
    reply.header('Cache-Control', LIST_CACHE);
    const files = await safeListFiles(env.BETTING_RUNS_DIR);
    const dates = files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.replace('.json', ''))
      .sort()
      .reverse();

    const summaries = [];
    for (const date of dates) {
      const path = safeJoin(env.BETTING_RUNS_DIR, `${date}.json`);
      if (path) {
        const json = await safeReadJson(path);
        const summary = computeBettingRunSummary(date, json);
        if (summary) summaries.push(summary);
      }
    }
    return reply.send(summaries);
  });

  fastify.get<{ Params: { date: string } }>('/api/betting/runs/:date', async (request, reply) => {
    const { date } = request.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ error: 'Invalid date' });
    }
    const path = safeJoin(env.BETTING_RUNS_DIR, `${date}.json`);
    if (!path) {
      return reply.status(404).send({ error: 'Not found' });
    }
    const json = await safeReadJson(path);
    if (!json) {
      return reply.status(404).send({ error: 'Not found' });
    }
    reply.header('Cache-Control', DETAIL_CACHE);
    return reply.send(json);
  });

  fastify.get('/api/resolver/runs', async (_request, reply) => {
    reply.header('Cache-Control', LIST_CACHE);
    const files = await safeListFiles(env.RESOLVER_RUNS_DIR);
    const names = files
      .filter((f) => f.startsWith('RESOLVE-') && f.endsWith('.json'))
      .sort()
      .reverse();

    const runs = [];
    for (const filename of names) {
      const id = filename.replace('.json', '');
      const path = safeJoin(env.RESOLVER_RUNS_DIR, filename);
      if (path) {
        const json = await safeReadJson(path);
        const summary = computeResolverRunSummary(id, filename, json);
        if (summary) runs.push(summary);
      }
    }
    return reply.send({ runs });
  });

  fastify.get<{ Params: { id: string } }>('/api/resolver/runs/:id', async (request, reply) => {
    const { id } = request.params;
    if (!/^[A-Za-z0-9._:-]+$/.test(id)) {
      return reply.status(400).send({ error: 'Invalid id' });
    }
    const path = safeJoin(env.RESOLVER_RUNS_DIR, `${id}.json`);
    if (!path) {
      return reply.status(404).send({ error: 'Not found' });
    }
    const json = await safeReadJson(path);
    if (!json) {
      return reply.status(404).send({ error: 'Not found' });
    }
    reply.header('Cache-Control', DETAIL_CACHE);
    return reply.send(json);
  });

  const port = env.PORT;
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`Torch API listening on port ${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
