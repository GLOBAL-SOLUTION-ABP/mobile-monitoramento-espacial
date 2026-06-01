import { createContext, useContext, useState, useEffect } from 'react';
import { loadSession, saveSession, clearSession } from '../utils/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession().then(s => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  const login = async (email, nome, role) => {
    await saveSession(email, nome, role);
    const s = await loadSession();
    setSession(s);
  };

  const logout = async () => {
    await clearSession();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
