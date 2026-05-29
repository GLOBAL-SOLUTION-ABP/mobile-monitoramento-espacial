// Strips HTML tags, injection patterns and SQL meta-characters from user input
export const sanitizeText = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')       // XSS: strip HTML tags
    .replace(/javascript\s*:/gi, '') // XSS: strip javascript: protocol
    .replace(/on\w+\s*=/gi, '')    // XSS: strip event handlers
    .replace(/;/g, '')             // SQL: statement separator
    .replace(/--/g, '')            // SQL: line comment
    .replace(/\/\*/g, '')          // SQL: block comment start
    .trim();
};

// Allows only alphanumeric + hyphen — safe for use in URL path segments (FIPE API params)
export const sanitizeApiParam = (param) => {
  if (typeof param !== 'string') return '';
  return param.replace(/[^a-zA-Z0-9\-]/g, '');
};

export const validateEmail = (email) =>
  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);

export const validatePositiveNumber = (val) => {
  const n = parseFloat(String(val).replace(',', '.'));
  return !isNaN(n) && n > 0 && isFinite(n);
};

const SAFE_ERRORS = {
  network: 'Erro de conexão. Tente novamente mais tarde.',
  auth:    'Credenciais inválidas.',
  save:    'Não foi possível salvar. Tente novamente.',
  load:    'Não foi possível carregar os dados.',
  generic: 'Ocorreu um erro inesperado. Tente novamente.',
};

// Returns a user-facing message that never exposes stack traces or internal details
export const safeError = (context = 'generic') =>
  SAFE_ERRORS[context] || SAFE_ERRORS.generic;

// ── Anonymisation helpers ─────────────────────────────────────────────────
// Masks an email address for safe display in logs/UI: 'user@ford.com' → 'us**@ford.com'
export const anonymizeEmail = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, 2);
  const masked  = '*'.repeat(Math.max(local.length - 2, 2));
  return `${visible}${masked}@${domain}`;
};

// Reduces a full name to first name + last initial: 'João Silva Santos' → 'João S.'
export const anonymizeName = (name) => {
  if (typeof name !== 'string' || !name.trim()) return '***';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

// ── Payload signing ────────────────────────────────────────────────────────
// DJB2-based HMAC simulation — must stay in sync with server.js verification
const PAYLOAD_SECRET = 'fsa-payload-2025-k3m7x';

const djb2 = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
};

// Signs a payload object; returns { signature, timestamp } to include as request headers.
// The caller must send JSON.stringify(payload) as the request body — the server verifies
// against the raw body bytes, so the signed string and the wire body must be identical.
export const signPayload = (data) => {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const timestamp = Date.now().toString();
  const signature = djb2(body + timestamp + PAYLOAD_SECRET);
  return { signature, timestamp };
};
