import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_SECRET         = 'fsa-ford-2025-x7k9p';
const TOKEN_TTL          = 8 * 60 * 60 * 1000; // 8 hours
const RENEWAL_THRESHOLD  = 60 * 60 * 1000;      // renew when less than 1h remaining
const SESSION_KEY        = 'userSession';

// DJB2-based HMAC simulation — deterministic signature without native crypto dependency
const sign = (data, secret) => {
  const str = data + secret;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
};

export const createToken = (email, nome, role) => {
  const payload    = { email, nome, role, iat: Date.now(), exp: Date.now() + TOKEN_TTL };
  const payloadStr = JSON.stringify(payload);
  return payloadStr + '|' + sign(payloadStr, APP_SECRET);
};

// Returns parsed payload if token is valid and not expired, null otherwise
export const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  const lastPipe   = token.lastIndexOf('|');
  if (lastPipe === -1) return null;
  const payloadStr = token.slice(0, lastPipe);
  const sig        = token.slice(lastPipe + 1);
  if (sign(payloadStr, APP_SECRET) !== sig) return null; // tampered
  try {
    const payload = JSON.parse(payloadStr);
    if (Date.now() > payload.exp) return null; // expired
    return payload;
  } catch {
    return null;
  }
};

export const saveSession = async (email, nome, role) => {
  const token = createToken(email, nome, role);
  await AsyncStorage.setItem(SESSION_KEY, token);
};

export const loadSession = async () => {
  try {
    const token   = await AsyncStorage.getItem(SESSION_KEY);
    const payload = verifyToken(token);
    if (!payload) return null;
    // Auto-renew when less than 1h of lifetime remains
    if (payload.exp - Date.now() < RENEWAL_THRESHOLD) {
      await saveSession(payload.email, payload.nome, payload.role);
    }
    return payload;
  } catch {
    return null;
  }
};

export const clearSession = async () => {
  try { await AsyncStorage.removeItem(SESSION_KEY); } catch (_) {}
};
