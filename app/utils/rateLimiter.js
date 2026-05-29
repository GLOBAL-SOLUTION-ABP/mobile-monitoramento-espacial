// Client-side rate limiter — tracks requests per named endpoint within a sliding window
const log = {};
const WINDOW_MS = 60 * 1000; // 1-minute sliding window

const LIMITS = {
  api_read:  60, // GET /carros
  api_write: 15, // POST /carros
  fipe:      20, // FIPE API calls
};

// Returns true if the request is allowed, false if the limit is exceeded
export const checkRateLimit = (key = 'api_read') => {
  const limit = LIMITS[key] ?? LIMITS.api_read;
  const now = Date.now();
  if (!log[key]) log[key] = [];
  log[key] = log[key].filter(t => now - t < WINDOW_MS);
  if (log[key].length >= limit) return false;
  log[key].push(now);
  return true;
};
