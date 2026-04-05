import LoginPage from '../components/LoginPage';
import RegisterPage from '../components/RegisterPage';
import ResetPasswordPage from '../components/ResetPasswordPage';

const FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

export default function AuthPage({ authLoading, isAuthenticated, authView, setAuthView, authError, resetToken, login, register, t }) {
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#888', fontSize: 14, fontFamily: FONT }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'reset' && resetToken) {
      return (
        <ResetPasswordPage
          token={resetToken}
          onBack={() => { window.history.replaceState({}, '', '/'); setAuthView('login'); }}
        />
      );
    }
    if (authView === 'register') {
      return (
        <RegisterPage
          onRegister={register}
          onSwitchToLogin={() => setAuthView('login')}
          error={authError}
        />
      );
    }
    return (
      <LoginPage
        onLogin={login}
        onSwitchToRegister={() => setAuthView('register')}
        error={authError}
        theme={t}
      />
    );
  }

  return null;
}
