import AsyncStorage from '@react-native-async-storage/async-storage';
import { anonymizeEmail } from './security';

const LOG_KEY     = '@audit_log';
const MAX_ENTRIES = 200;

const SENSITIVE = ['senha', 'senhaHash', 'password', 'token', 'signature', 'codigoAdmin'];

const sanitizeCtx = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const safe = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.includes(k))                  { safe[k] = '[REDACTED]'; continue; }
    if (k === 'email' && typeof v === 'string') { safe[k] = anonymizeEmail(v); continue; }
    safe[k] = v;
  }
  return safe;
};

const write = async (level, action, context = {}) => {
  const entry = { ts: new Date().toISOString(), level, action, ctx: sanitizeCtx(context) };
  console.log(`[${level}] ${action}`, JSON.stringify(entry.ctx));
  try {
    const raw  = await AsyncStorage.getItem(LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.push(entry);
    if (logs.length > MAX_ENTRIES) logs.splice(0, logs.length - MAX_ENTRIES);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (_) {}
};

export const logger = {
  info:  (action, ctx = {}) => write('INFO',  action, ctx),
  warn:  (action, ctx = {}) => write('WARN',  action, ctx),
  error: (action, ctx = {}) => write('ERROR', action, ctx),
  audit: (action, ctx = {}) => write('AUDIT', action, ctx),
  getLogs: async () => {
    try {
      const raw = await AsyncStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
};
