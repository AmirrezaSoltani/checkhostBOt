import axios from 'axios';
import { createConnection } from 'net';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const HTTP_TIMEOUT = config.HTTP_TIMEOUT_MS;
const TCP_TIMEOUT = config.TCP_TIMEOUT_MS;
const RETRIES = config.CHECK_RETRIES;
const RETRY_DELAY = config.RETRY_DELAY_MS;

/**
 * Normalize URL: add https if no protocol
 */
function normalizeUrl(address) {
  const s = address.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

/**
 * HTTP/HTTPS check (HEAD then GET fallback)
 */
export async function checkHttp(address) {
  const url = normalizeUrl(address);
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const start = Date.now();
      const res = await axios({
        method: 'head',
        url,
        timeout: HTTP_TIMEOUT,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      return {
        status: res.status < 500 ? 'up' : 'down',
        latencyMs: Date.now() - start,
        httpStatus: res.status,
        error: null,
      };
    } catch (err) {
      if (i < RETRIES) { await sleep(RETRY_DELAY); continue; }
      const startGet = Date.now();
      try {
        const res = await axios({
          method: 'get',
          url,
          timeout: HTTP_TIMEOUT,
          maxRedirects: 5,
          validateStatus: () => true,
        });
        return {
          status: res.status < 500 ? 'up' : 'down',
          latencyMs: Date.now() - startGet,
          httpStatus: res.status,
          error: null,
        };
      } catch (getErr) {
        return {
          status: 'down',
          latencyMs: Date.now() - startGet,
          httpStatus: null,
          error: getErr.code || getErr.message || String(getErr),
        };
      }
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * TCP connect check (for IP or as ping alternative in Docker)
 */
export function checkTcp(host, port) {
  return new Promise((resolve) => {
    let resolved = false;
    const start = Date.now();

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const socket = createConnection({ host, port }, () => {
      done({ status: 'up', latencyMs: Date.now() - start, httpStatus: null, error: null });
    });

    socket.on('error', (err) => {
      done({
        status: 'down',
        latencyMs: Date.now() - start,
        httpStatus: null,
        error: err.code || err.message || String(err),
      });
    });

    const timer = setTimeout(() => {
      done({ status: 'down', latencyMs: TCP_TIMEOUT, httpStatus: null, error: 'Timeout' });
    }, TCP_TIMEOUT);
  });
}

/**
 * Resolve host from URL for TCP check
 */
function getHostFromUrl(address) {
  try {
    const url = new URL(normalizeUrl(address));
    return url.hostname;
  } catch {
    return address;
  }
}

/**
 * Run one check for a target. Returns { status, latencyMs, httpStatus, error }.
 */
export async function runCheck(target) {
  const { type, address, checkMethod, tcpPort } = target;
  const method = checkMethod || (type === 'url' ? 'http' : 'tcp');
  const port = tcpPort ?? (type === 'url' ? 443 : 80);

  if (method === 'http') {
    return checkHttp(address);
  }

  if (method === 'tcp' || method === 'ping') {
    const host = type === 'ip' ? address : getHostFromUrl(address);
    return checkTcp(host, port);
  }

  return {
    status: 'unknown',
    latencyMs: null,
    httpStatus: null,
    error: `Unknown checkMethod: ${method}`,
  };
}
