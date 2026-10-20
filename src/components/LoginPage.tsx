import { useState, type FormEvent } from 'react';
import { DEMO_PASSWORD, DEMO_USERNAME } from '../data/constants';

interface LoginPageProps {
  /** Called on successful sign-in or Continue as Demo — App records the session. */
  onLogin: () => void;
}

/**
 * M12 secret-sauce — the demo login screen. This is a demonstration gate,
 * not real authentication: the credentials are constants (displayed right on
 * the page for assessors) and nothing here protects the stored project data.
 * The password is never written to localStorage/sessionStorage — App only
 * records the `vibetracker.demoSession` sessionStorage flag.
 *
 * DESIGN.md §4/§6: centred white card, subtle border, brand-primary wordmark
 * and primary action, visible keyboard focus everywhere.
 */
function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (username.trim() === DEMO_USERNAME && password === DEMO_PASSWORD) {
      onLogin();
    } else {
      // One generic message — never reveal which field was wrong.
      setError('Invalid username or password.');
    }
  };

  const inputClass =
    'w-full rounded border border-slate-300 bg-surface-card px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary';

  return (
    <div
      data-login-page
      className="flex min-h-screen items-center justify-center bg-surface-page p-6 text-text-primary"
    >
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-surface-card p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold text-brand-primary">
          Vibecoding Project Tracker
        </h1>

        <h2 className="mt-6 text-lg font-semibold text-text-primary">Welcome back</h2>
        <p className="mt-1 text-sm text-text-muted">
          Sign in to open your demo project board — your tasks and deliverable
          links are waiting.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-username" className="mb-1 block text-xs font-medium text-text-primary">
              Username
            </label>
            <input
              id="login-username"
              data-login-username
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              placeholder="Username"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-xs font-medium text-text-primary">
              Password
            </label>
            <input
              id="login-password"
              data-login-password
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Password"
              className={inputClass}
            />
          </div>
          {error && (
            <p data-login-error role="alert" className="text-xs text-type-bug">
              {error}
            </p>
          )}
          <button
            type="submit"
            data-action="sign-in"
            className="w-full rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4 text-center">
          {/* Assessor access: the credentials are shown openly so the prototype
              can always be opened without any sign-up. */}
          <p data-demo-credentials className="text-xs text-text-muted">
            Demo access:{' '}
            <span data-demo-username className="font-mono font-semibold text-text-primary">
              {DEMO_USERNAME}
            </span>{' '}
            /{' '}
            <span data-demo-password className="font-mono font-semibold text-text-primary">
              {DEMO_PASSWORD}
            </span>
          </p>
          <button
            type="button"
            data-action="continue-demo"
            onClick={onLogin}
            className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm text-text-primary hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Continue as Demo
          </button>
          <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
            This is a demonstration login for the hackathon demo — it does not
            protect or secure the stored project data.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
