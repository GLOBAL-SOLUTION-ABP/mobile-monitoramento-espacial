export const ROLES = { ADMIN: 'admin', ANALYST: 'analyst', USER: 'user' };

export const ROLE_LABELS = {
  admin:   'ADMIN',
  analyst: 'ANALISTA',
  user:    'USUÁRIO',
};

export const ROLE_COLORS = {
  admin:   '#F43F5E',
  analyst: '#A855F7',
  user:    '#818CF8',
};

const PERMISSIONS = {
  admin:   ['view_dashboard', 'view_analytics', 'register_region', 'view_alerts'],
  analyst: ['view_dashboard', 'view_analytics', 'register_region', 'view_alerts'],
  user:    ['register_region', 'view_alerts'],
};

export const hasPermission = (role, action) =>
  (PERMISSIONS[role] || PERMISSIONS.user).includes(action);

// Role is derived from email at login time — no manual assignment needed
export const assignRole = (email) => {
  if (!email) return ROLES.USER;
  if (email === 'a') return ROLES.ADMIN;
  if (email.toLowerCase().endsWith('@satguard.com')) return ROLES.ANALYST;
  return ROLES.USER;
};
