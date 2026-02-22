import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function LoginPage() {
  const { state, signIn, signUp, isSupabaseConfigured } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (state.session) navigate('/app/deal-brief');
  }, [state.session, navigate]);

  const handleSubmit = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    if (!password.trim()) {
      setError('Enter your password.');
      return;
    }

    setError('');
    setLoading(true);

    if (mode === 'signin') {
      const res = await signIn(email.trim().toLowerCase(), password);
      if (res.error) setError(res.error);
    } else {
      const res = await signUp(email.trim().toLowerCase(), password, fullName.trim());
      if (res.error) {
        setError(res.error);
      } else {
        setMode('signin');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-900 text-white p-2 rounded-xl">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">NPL Underwriting Model</h1>
            <p className="text-xs text-slate-500">Cornell - REAL 6595</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-6">
          Heron Capital Opportunity Fund V. Sign in with your class account.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border ${
              mode === 'signin'
                ? 'bg-blue-900 text-white border-blue-900'
                : 'bg-white text-slate-600 border-slate-300'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border ${
              mode === 'signup'
                ? 'bg-blue-900 text-white border-blue-900'
                : 'bg-white text-slate-600 border-slate-300'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name (optional)</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. netid@cornell.edu"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Working...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

      </div>
    </div>
  );
}
