import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth?action=me', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const res = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return false;
      }
      setUser(data.user);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  const register = useCallback(async (email, password) => {
    setError(null);
    try {
      const res = await fetch('/api/auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return false;
      }
      setUser(data.user);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth?action=logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // logout best-effort
    }
    setUser(null);
  }, []);

  const authAction = useCallback(async (action, body, { updateUser = false } = {}) => {
    const res = await fetch(`/api/auth?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Failed' };
    if (updateUser && data.user) setUser(data.user);
    return { ok: true };
  }, []);

  const changeName = useCallback((name) => authAction('change-name', { name }, { updateUser: true }), [authAction]);
  const changeEmail = useCallback((newEmail, password) => authAction('change-email', { newEmail, password }, { updateUser: true }), [authAction]);
  const changePassword = useCallback((currentPassword, newPassword) => authAction('change-password', { currentPassword, newPassword }), [authAction]);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refresh: checkSession,
    changeName,
    changeEmail,
    changePassword,
  };
}
