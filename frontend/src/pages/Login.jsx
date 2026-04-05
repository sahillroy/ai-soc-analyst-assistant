import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  // ── Remember Me: pre-fill on mount ────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('soc_remember');
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      if (email === 'sahilroy7007@gmail.com' && password === 'sahilroy') {
        localStorage.setItem('soc_auth_token', 'authenticated');
        localStorage.setItem('soc_user', JSON.stringify({
          name: 'Sahil Roy', email, provider: 'local', avatar: 'SR'
        }));
        if (rememberMe) localStorage.setItem('soc_remember', email);
        else localStorage.removeItem('soc_remember');
        navigate('/dashboard', { replace: true });
      } else {
        setLoading(false);
        setError('Invalid credentials. Use sahilroy7007@gmail.com / sahilroy');
      }
    }, 800);
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('soc_auth_token', 'google_demo');
      localStorage.setItem('soc_user', JSON.stringify({
        name: 'SOC Analyst', email: 'analyst@sentinel.local',
        provider: 'google', avatar: 'SA'
      }));
      navigate('/dashboard', { replace: true });
    }, 1200);
  };

  const handleGithubLogin = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('soc_auth_token', 'github_demo');
      localStorage.setItem('soc_user', JSON.stringify({
        name: 'SOC Analyst', email: 'analyst@sentinel.local',
        provider: 'github', avatar: 'SA'
      }));
      navigate('/dashboard', { replace: true });
    }, 1200);
  };

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .tactical-grid {
          background-image:
            linear-gradient(rgba(59, 130, 246, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
        }
        .glass-panel {
          background: rgba(11, 19, 38, 0.4);
          backdrop-filter: blur(24px);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
        }
        .stat-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.05);
        }
        .node-network {
          position: absolute;
          inset: 0;
          opacity: 0.15;
          background-image: radial-gradient(#3b82f6 1px, transparent 1px);
          background-size: 100px 100px;
        }
      `}</style>

      <div className="flex flex-col lg:flex-row min-h-screen w-full bg-background overflow-x-hidden">

        {/* ── LEFT PANEL: Brand & Visuals ──────────────────────────────────── */}
        <section className="relative hidden lg:flex flex-col w-full lg:w-[45%] xl:w-[40%] p-12 lg:p-16 xl:p-24 overflow-hidden border-r border-white/5">
          {/* Background Elements */}
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-surface-container-lowest via-background to-surface-dim"></div>
          <div className="absolute inset-0 z-0 tactical-grid opacity-30"></div>
          <div className="absolute inset-0 z-0 node-network"></div>
          <div className="absolute -top-[10%] -left-[10%] w-[80%] h-[80%] bg-primary/10 rounded-full blur-[160px]"></div>

          <div className="relative z-10">
            {/* Brand Logo */}
            <div className="flex items-center gap-3 mb-20">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-lg">
                <span className="material-symbols-outlined text-primary text-2xl" data-icon="shield">shield</span>
              </div>
              <span className="font-headline text-xl font-extrabold tracking-tighter text-on-surface uppercase">Sentinel <span className="text-primary">SOC</span></span>
            </div>

            {/* Main Marketing Copy */}
            <div className="max-w-md">
              <h1 className="font-headline text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] mb-6">
                Advanced Threat Intelligence at Your Fingertips
              </h1>
              <p className="text-lg text-outline leading-relaxed font-medium">
                Real-time AI-powered monitoring for modern SOC operations. Secure, scalable, and built for high-stakes environments.
              </p>
            </div>
          </div>
        </section>

        {/* ── RIGHT PANEL: Authentication Form ─────────────────────────────── */}
        <section className="flex flex-col items-center justify-center flex-1 p-6 lg:p-12 xl:p-24 relative z-10">
          {/* Mobile Logo Only */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container-high border border-white/5">
              <span className="material-symbols-outlined text-primary text-3xl" data-icon="shield">shield</span>
            </div>
            <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface uppercase">Sentinel SOC</h1>
          </div>

          <div className="w-full max-w-[440px]">
            <div className="mb-10 text-center lg:text-left">
              <h2 className="font-headline text-3xl font-bold text-on-surface mb-2">System Authentication</h2>
              <p className="text-outline text-sm">Enter analyst credentials to proceed to secure station.</p>
            </div>

            {/* ── Error Alert ──────────────────────────────────────────────── */}
            {error && (
              <div className="mb-8 flex items-center gap-4 rounded-xl bg-error/10 p-5 border border-error/20">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/20">
                  <span className="material-symbols-outlined text-error text-xl" data-icon="warning">warning</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white mb-0.5">Invalid credentials</p>
                  <p className="text-[11px] text-error/80 font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* ── Forgot Password Panel ────────────────────────────────────── */}
            {showForgot ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-5">🔑</div>
                <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">Reset your password</h3>
                <p className="text-outline text-sm mb-8">Enter your email and we'll send a reset link.</p>
                <div className="space-y-2 mb-6 text-left">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline-variant px-1" htmlFor="reset-email">Analyst Identifier</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                      <span className="material-symbols-outlined text-xl" data-icon="person">person</span>
                    </div>
                    <input
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl pl-12 pr-4 py-4 text-on-surface text-sm transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-outline/40"
                      id="reset-email"
                      placeholder="email@sentinel.hq"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  className="w-full rounded-xl bg-primary py-4 text-sm font-extrabold tracking-widest uppercase text-white shadow-xl shadow-primary/20 transition-all hover:translate-y-[-1px] hover:shadow-primary/30 active:scale-[0.98] mb-4"
                  type="button"
                  onClick={() => setShowForgot(false)}
                >
                  Send Reset Link
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="text-primary text-sm font-semibold cursor-pointer hover:text-primary/80 transition-colors"
                >
                  ← Back to login
                </button>
                <p className="text-[11px] text-outline/40 mt-4">(Demo mode — no email will be sent)</p>
              </div>
            ) : (
              /* ── Login Form ──────────────────────────────────────────────── */
              <form className="space-y-6" onSubmit={handleSubmit}>

                {/* Email Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline-variant px-1" htmlFor="email">Analyst Identifier</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                      <span className="material-symbols-outlined text-xl" data-icon="person">person</span>
                    </div>
                    <input
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl pl-12 pr-4 py-4 text-on-surface text-sm transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-outline/40"
                      id="email"
                      placeholder="email@sentinel.hq"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-outline-variant" htmlFor="password">Security Key</label>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-[11px] font-bold text-primary hover:text-primary-container transition-colors uppercase tracking-tight"
                    >
                      Lost Key?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                      <span className="material-symbols-outlined text-xl" data-icon="lock">lock</span>
                    </div>
                    <input
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl pl-12 pr-12 py-4 text-on-surface text-sm transition-all focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-outline/40"
                      id="password"
                      placeholder="••••••••••••"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {/* Eye Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-white transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      {showPassword ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Session Checkbox */}
                <div className="flex items-center pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        className="peer h-5 w-5 rounded-md border-outline-variant/30 bg-surface-container-lowest text-primary focus:ring-primary focus:ring-offset-background transition-all"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ accentColor: '#3B82F6' }}
                      />
                    </div>
                    <span className="text-sm font-medium text-outline group-hover:text-on-surface transition-colors">Remember Session</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  className="relative w-full overflow-hidden rounded-xl bg-primary py-4 text-sm font-extrabold tracking-widest uppercase text-white shadow-xl shadow-primary/20 transition-all hover:translate-y-[-1px] hover:shadow-primary/30 active:scale-[0.98] mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={loading}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined text-lg" style={{ animation: 'spin 1s linear infinite' }}>autorenew</span>
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Establish Connection
                        <span className="material-symbols-outlined text-lg" data-icon="arrow_forward">arrow_forward</span>
                      </>
                    )}
                  </span>
                </button>
              </form>
            )}

            {/* ── Unified Auth Protocols (OAuth) ────────────────────────────── */}
            {!showForgot && (
              <div className="mt-10">
                <div className="relative flex items-center justify-center mb-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5"></div>
                  </div>
                  <span className="relative bg-background px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-outline-variant/60">Unified Auth Protocols</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="flex items-center justify-center gap-3 h-12 rounded-xl bg-surface-container-high border border-white/5 hover:bg-white/5 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="opacity-80 group-hover:opacity-100 transition-opacity">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="text-xs font-bold text-outline-variant group-hover:text-on-surface transition-colors uppercase">Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGithubLogin}
                    disabled={loading}
                    className="flex items-center justify-center gap-3 h-12 rounded-xl bg-surface-container-high border border-white/5 hover:bg-white/5 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-80 group-hover:opacity-100 transition-opacity invert">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.43 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.04c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.72.08-.72 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.58C20.57 21.8 24 17.31 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    <span className="text-xs font-bold text-outline-variant group-hover:text-on-surface transition-colors uppercase">GitHub</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── Footer ──────────────────────────────────────────────────────── */}
            <div className="mt-12 text-center">
              <p className="text-[10px] text-outline/40 leading-relaxed max-w-[320px] mx-auto mb-6">
                Protected by Sentinel Neural Encryption. Unauthorized attempts logged and reported.
              </p>
              <div className="flex justify-center gap-6">
                <a className="text-[10px] font-bold text-outline-variant/60 hover:text-primary transition-colors uppercase tracking-[0.15em]" href="#">Privacy</a>
                <a className="text-[10px] font-bold text-outline-variant/60 hover:text-primary transition-colors uppercase tracking-[0.15em]" href="#">Compliance</a>
                <a className="text-[10px] font-bold text-outline-variant/60 hover:text-primary transition-colors uppercase tracking-[0.15em]" href="#">Status</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
