import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BookOpen } from 'lucide-react';

export function LoginPage() {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!studentId.trim()) { setError('Please enter your Student ID / NetID.'); return; }
    dispatch({ type: 'LOGIN', payload: { studentId: studentId.trim(), name: name.trim() } });
    navigate('/app/deal-brief');
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
            <p className="text-xs text-slate-500">Cornell — REAL 6595</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-6">
          Heron Capital Opportunity Fund V — Non-Performing Loan Portfolio Analysis.
          Enter your details to begin or resume your work.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Student ID / NetID</label>
            <input
              type="text"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              placeholder="e.g. js1234 or 12345678"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            Start / Resume Assignment
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-6 text-center">
          Your progress is saved automatically in your browser.
        </p>

        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <a href="/admin" className="text-xs text-slate-400 hover:text-slate-600">Professor Dashboard →</a>
        </div>
      </div>
    </div>
  );
}
