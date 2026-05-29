import AsyncStorage from '@react-native-async-storage/async-storage';

const BF_KEY       = '@brute_force';
const MAX_FAILURES = 5;
const LOCKOUT_MS   = 15 * 60 * 1000; // 15 minutes

const load = async () => {
  try {
    const raw = await AsyncStorage.getItem(BF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const save = async (map) => {
  try { await AsyncStorage.setItem(BF_KEY, JSON.stringify(map)); } catch (_) {}
};

// Returns minutes remaining if account is locked, 0 if free to attempt
export const checkLockout = async (email) => {
  const map    = await load();
  const record = map[email];
  if (!record || record.count < MAX_FAILURES) return 0;
  const remaining = record.lockedAt + LOCKOUT_MS - Date.now();
  if (remaining <= 0) {
    delete map[email];
    await save(map);
    return 0;
  }
  return Math.ceil(remaining / 60000);
};

// Returns true if this failure triggered a lockout
export const recordFailure = async (email) => {
  const map    = await load();
  const record = map[email] || { count: 0 };
  record.count++;
  if (record.count >= MAX_FAILURES) record.lockedAt = Date.now();
  map[email] = record;
  await save(map);
  return record.count >= MAX_FAILURES;
};

export const clearFailures = async (email) => {
  const map = await load();
  if (email in map) {
    delete map[email];
    await save(map);
  }
};
