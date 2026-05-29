// ── DJB2 base ──────────────────────────────────────────────────────────────
const djb2 = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
};

// ── Password hashing ───────────────────────────────────────────────────────
const HASH_SECRET = 'fsa-hash-2025-m9n2z';
const ROUNDS      = 1000; // key-stretching iterations

const deriveSalt = (email) => djb2(email.toLowerCase() + HASH_SECRET);

// Produces a portable hash string: $djb2$<rounds>$<salt8>$<hash>
// Uses a deterministic email-derived salt — no separate storage needed
export const hashPassword = (password, email) => {
  const salt = deriveSalt(email);
  let h = djb2(password + salt);
  for (let i = 0; i < ROUNDS; i++) {
    h = djb2(h + salt + i.toString(36));
  }
  return `$djb2$${ROUNDS}$${salt.slice(0, 8)}$${h}`;
};

// ── Data-at-rest encryption (XOR cipher + hex encoding) ───────────────────
// Academic demonstration — production would use AES-256-GCM with server-managed keys
const CIPHER_KEY = 'fsa-enc-2025-r7v3k';

export const encryptData = (data) => {
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return Array.from(str)
      .map((c, i) => (c.charCodeAt(0) ^ CIPHER_KEY.charCodeAt(i % CIPHER_KEY.length))
        .toString(16).padStart(4, '0'))
      .join('');
  } catch { return null; }
};

export const decryptData = (hex) => {
  try {
    const chars = [];
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      chars.push(String.fromCharCode(code ^ CIPHER_KEY.charCodeAt((i / 4) % CIPHER_KEY.length)));
    }
    return chars.join('');
  } catch { return null; }
};
