import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { 
  ShieldCheck, 
  GraduationCap, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  AlertCircle,
  HelpCircle,
  X,
  Sparkles,
  CheckCircle2,
  KeyRound
} from 'lucide-react';

export const UnifiedLoginPage: React.FC = () => {
  const { login } = useAttendance();

  // Role selector tab: 'FACULTY' or 'ADMIN'
  const [selectedRole, setSelectedRole] = useState<'FACULTY' | 'ADMIN'>('FACULTY');

  // Credentials
  const [username, setUsername] = useState('faculty001');
  const [password, setPassword] = useState('Faculty@123456');
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Switch role tabs and pre-fill credentials for quick evaluation
  const handleRoleTabChange = (role: 'FACULTY' | 'ADMIN') => {
    setSelectedRole(role);
    setErrorMessage('');
    if (role === 'ADMIN') {
      setUsername('admin');
      setPassword('Admin@123456');
    } else {
      setUsername('faculty001');
      setPassword('Faculty@123456');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await login(username.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication service error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 font-sans relative overflow-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden relative z-10">
        {/* Header Banner */}
        <div className="p-6 pb-5 text-center border-b border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-800/60">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-3.5 shadow-inner">
            {selectedRole === 'ADMIN' ? (
              <ShieldCheck className="w-8 h-8 text-amber-400" />
            ) : (
              <GraduationCap className="w-8 h-8 text-blue-400" />
            )}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            CollegeVision Biometrics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            AI-Based Face Recognition Attendance Management System
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="p-4 pb-0">
          <div className="grid grid-cols-2 p-1 bg-slate-900/80 rounded-xl border border-slate-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleRoleTabChange('FACULTY')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                selectedRole === 'FACULTY'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Faculty Portal</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabChange('ADMIN')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                selectedRole === 'ADMIN'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Administrator</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
          {/* Role Status Tag */}
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span className="font-medium">
              {selectedRole === 'ADMIN' ? 'Institutional Governance & Setup' : 'Instructor Attendance Console'}
            </span>
            <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
              selectedRole === 'ADMIN'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {selectedRole}
            </span>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {selectedRole === 'ADMIN' ? 'Admin Username' : 'Faculty Username or Email'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={selectedRole === 'ADMIN' ? 'admin' : 'faculty001'}
                className="w-full pl-9 pr-3 py-2.5 text-xs font-mono bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-10 py-2.5 text-xs font-mono bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 px-4 text-xs font-bold text-white rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 ${
              selectedRole === 'ADMIN'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-amber-950/40'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-blue-950/40'
            } ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
          >
            <LogIn className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Verifying JWT Credentials...'
                : selectedRole === 'ADMIN'
                ? 'Access Administrator Console'
                : 'Enter Faculty Attendance Portal'}
            </span>
          </button>

          {/* Quick Credential Pre-fill Helpers */}
          <div className="pt-2 border-t border-slate-700/60">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Verified Project Credentials:
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('ADMIN');
                  setUsername('admin');
                  setPassword('Admin@123456');
                  setErrorMessage('');
                }}
                className="p-1.5 text-left rounded-lg bg-slate-900/60 border border-slate-700/60 hover:border-amber-500/50 hover:bg-slate-900 transition-colors"
              >
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Admin
                </div>
                <div className="text-slate-400 font-mono text-[10px]">admin / Admin@123456</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRole('FACULTY');
                  setUsername('faculty001');
                  setPassword('Faculty@123456');
                  setErrorMessage('');
                }}
                className="p-1.5 text-left rounded-lg bg-slate-900/60 border border-slate-700/60 hover:border-blue-500/50 hover:bg-slate-900 transition-colors"
              >
                <div className="font-bold text-blue-400 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> Faculty
                </div>
                <div className="text-slate-400 font-mono text-[10px]">Dr. Priya Sharma</div>
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-3.5 bg-slate-900/80 border-t border-slate-700/60 text-center">
          <p className="text-[11px] text-slate-500">
            Protected by Argon2id Hashing & Cryptographic JWT Bearer Tokens
          </p>
        </div>
      </div>
    </div>
  );
};
