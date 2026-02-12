import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Mail, Lock, UserPlus, LogIn, Shield, Clock, Heart, Sparkles, User } from 'lucide-react';

export const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, signup, loginWithGoogle } = useAuth();

    // Email validation
    const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        // Validate email
        if (!isValidEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }

        // Validate password
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        // Validate name for signup
        if (!isLogin && name.trim().length < 2) {
            setError('Please enter your name (at least 2 characters)');
            return;
        }

        setLoading(true);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await signup(email, password, name.trim());
            }
        } catch (err: any) {
            let errorMessage = err.message;
            if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please sign in instead.';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Use at least 6 characters.';
            } else if (err.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email. Please sign up.';
            } else if (err.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password. Please try again.';
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleLogin() {
        setError('');
        setLoading(true);
        try {
            await loginWithGoogle();
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-4">
            <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-center">
                {/* Left Side - Info Section */}
                <div className="flex-1 text-center lg:text-left">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white mx-auto lg:mx-0 mb-6 shadow-xl">
                        <Calendar className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Welcome to AutoScheduler</h1>
                    <p className="text-xl text-slate-600 mb-8">Generate conflict-free timetables automatically.</p>
                    
                    {/* Warning Box */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <Shield className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-amber-800 mb-1">Sign in required</h3>
                                <p className="text-sm text-amber-700">Please sign in or create an account to use AutoScheduler features. Your data will be securely saved to your account.</p>
                            </div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-slate-600">
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <Clock className="w-4 h-4 text-indigo-600" />
                            </div>
                            <span>Your session data persists across reloads</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                            <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                                <Heart className="w-4 h-4 text-pink-600" />
                            </div>
                            <span>Save favorite timetables to your account</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                            </div>
                            <span>AI-powered schedule analysis</span>
                        </div>
                    </div>
                </div>

                {/* Right Side - Auth Form */}
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center">
                        <h2 className="text-xl font-bold text-white mb-1">{isLogin ? 'Welcome Back!' : 'Get Started'}</h2>
                        <p className="text-indigo-100 text-sm">{isLogin ? 'Sign in to continue' : 'Create your account'}</p>
                    </div>

                {/* Form Container */}
                <div className="p-8">
                    <div className="flex justify-center mb-8 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.form
                            key={isLogin ? 'login' : 'signup'}
                            initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                            transition={{ duration: 0.2 }}
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                                    {error}
                                </div>
                            )}

                            {/* Name field - only for signup */}
                            {!isLogin && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                    <div className="relative">
                                        <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            required={!isLogin}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <div className="relative">
                                    <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <div className="relative">
                                    <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                        {isLogin ? 'Sign In' : 'Create Account'}
                                    </>
                                )}
                            </button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-slate-500">Or continue with</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full bg-white border border-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.98]"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                                    />
                                </svg>
                                Google Account
                            </button>
                        </motion.form>
                    </AnimatePresence>
                </div>
                </div>
            </div>
        </div>
    );
};
