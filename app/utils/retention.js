import AsyncStorage from '@react-native-async-storage/async-storage';
import { decryptData, encryptData } from './crypto';
import { anonymizeEmail } from './security';

const USUARIOS_KEY  = '@usuarios';
const USER_MAX_AGE  = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years
const CACHE_MAX_AGE = 7  * 24  * 60 * 60 * 1000;      // 7 days

// Removes user accounts older than USER_MAX_AGE and stale car cache
export const runRetentionPolicy = async () => {
  try {
    // 1. Prune expired user accounts
    const raw = await AsyncStorage.getItem(USUARIOS_KEY);
    if (raw) {
      let users = [];
      try {
        const decrypted = decryptData(raw);
        users = JSON.parse(decrypted);
      } catch {
        try { users = JSON.parse(raw); } catch { users = []; }
      }

      const now    = Date.now();
      const pruned = users.filter(u => !u.criadoEm || (now - u.criadoEm) < USER_MAX_AGE);

      if (pruned.length !== users.length) {
        users
          .filter(u => u.criadoEm && (now - u.criadoEm) >= USER_MAX_AGE)
          .forEach(u => console.log(`[RETENTION] Conta expirada removida: ${anonymizeEmail(u.email)}`));
        await AsyncStorage.setItem(USUARIOS_KEY, encryptData(JSON.stringify(pruned)));
      }
    }

    // 2. Clear stale vehicle cache
    const cacheTs = await AsyncStorage.getItem('carsCacheTimestamp');
    if (cacheTs && Date.now() - parseInt(cacheTs, 10) > CACHE_MAX_AGE) {
      await AsyncStorage.multiRemove(['carsCache', 'carsCacheTimestamp']);
    }
  } catch (_) {}
};
