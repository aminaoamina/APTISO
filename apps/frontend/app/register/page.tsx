'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  UserPlus,
  Loader2,
  Mail,
  CheckCircle,
  Shield,
  Lock,
  User,
  AlertCircle,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/theme-toggle';
import { AnimatedBackground } from '@/components/animated-background';
import { useAuthStore } from '@/store/auth-store';
import { getErrorMessage } from '@/lib/utils';

function RegisterContent() {
  const router = useRouter();
  const { register } = useAuthStore();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [passwordStrength, setPasswordStrength] = useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecial: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');

    if (name === 'password') {
      setPasswordStrength({
        minLength: value.length >= 8,
        hasUpperCase: /[A-Z]/.test(value),
        hasLowerCase: /[a-z]/.test(value),
        hasNumber: /[0-9]/.test(value),
        hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(value),
      });
    }
  };

  const isPasswordValid = () => {
    return Object.values(passwordStrength).every((v) => v === true);
  };

  const getPasswordStrengthScore = () => {
    const met = Object.values(passwordStrength).filter(Boolean).length;
    return (met / 5) * 100;
  };

  const getPasswordStrengthColor = () => {
    const score = getPasswordStrengthScore();
    if (score < 40) return 'bg-red-500';
    if (score < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    const score = getPasswordStrengthScore();
    if (score < 40) return 'Weak';
    if (score < 80) return 'Medium';
    return 'Strong';
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      setError('First name is required');
      return false;
    }

    if (!formData.last_name.trim()) {
      setError('Last name is required');
      return false;
    }

    if (!formData.email.trim()) {
      setError('Email address is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!formData.password) {
      setError('Password is required');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }

    if (!isPasswordValid()) {
      setError('Password must include uppercase, lowercase, a number, and a special character');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      };

      await register(payload);
      router.push('/login?registered=true');
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Registration failed. Please try again.');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatedBackground>
      <div className="absolute top-4 right-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500 z-10">
        <ThemeToggle />
      </div>

      <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left Side - Brand & Features */}
          <div className="hidden lg:flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-left-4 duration-700 delay-200">
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="relative w-80 h-80 mx-auto animate-in zoom-in duration-500 delay-400">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-100 via-blue-200 to-indigo-200 dark:from-blue-900/30 dark:via-blue-800/30 dark:to-indigo-900/30 flex items-center justify-center shadow-2xl">
                    <Logo variant="vertical" className="h-44 w-auto" />
                  </div>
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-xl animate-in bounce-in duration-500 delay-600">
                    <Shield className="w-8 h-8 text-white animate-pulse" />
                  </div>
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-full flex items-center justify-center shadow-xl animate-in bounce-in duration-500 delay-800">
                    <Lock className="w-8 h-8 text-white animate-pulse" />
                  </div>
                  <div className="absolute top-1/2 -right-6 w-14 h-14 bg-gradient-to-br from-sky-500 to-blue-700 rounded-full flex items-center justify-center shadow-xl animate-in bounce-in duration-500 delay-1000">
                    <CheckCircle className="w-7 h-7 text-white animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-1000">
                <h2 className="text-4xl font-bold text-transparent bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 bg-clip-text dark:from-blue-400 dark:via-sky-400 dark:to-indigo-300">
                  Simplify ISO 27001 Compliance
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 max-w-lg mx-auto leading-relaxed">
                  Plan, assess, and certify your information security management system with AI-powered guidance.
                </p>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-1200">
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                    <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Gap Analysis</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">Identify control gaps against Annex A with AI-assisted assessment.</p>
                </div>

                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100 dark:border-gray-700 hover:border-sky-200 dark:hover:border-sky-700">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/30 dark:to-sky-800/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                    <CheckCircle className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Risk Management</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">Track risks, treatments, and evidence across your entire ISMS.</p>
                </div>

                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                    <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Audit Ready</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">Documentation and evidence organized for certification audits.</p>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center justify-center space-x-8 mt-10 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-1400">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium">ISO 27001:2022</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium">AI-Powered</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Audit Evidence</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Registration Form */}
          <div className="w-full max-w-lg mx-auto lg:mx-0">
            <Card className="shadow-2xl border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
              <CardHeader className="space-y-1 pb-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg">
                    <UserPlus className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white animate-in fade-in slide-in-from-top-2 duration-500 delay-400">
                      Create Account
                    </CardTitle>
                    <CardDescription className="text-lg text-gray-600 dark:text-gray-300 mt-2 animate-in fade-in slide-in-from-top-2 duration-500 delay-500">
                      Start your ISO 27001 compliance journey
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6 px-8">
                  {error && (
                    <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <AlertDescription className="font-medium">{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Personal Information Section */}
                  <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-500 delay-600">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Personal Information</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name</Label>
                        <Input
                          id="first_name"
                          name="first_name"
                          type="text"
                          placeholder="Jane"
                          value={formData.first_name}
                          onChange={handleChange}
                          required
                          disabled={isLoading}
                          autoComplete="given-name"
                          className="h-12 transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="last_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</Label>
                        <Input
                          id="last_name"
                          name="last_name"
                          type="text"
                          placeholder="Doe"
                          value={formData.last_name}
                          onChange={handleChange}
                          required
                          disabled={isLoading}
                          autoComplete="family-name"
                          className="h-12 transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="you@company.com"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          disabled={isLoading}
                          autoComplete="email"
                          className="pl-12 h-12 transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Security Section */}
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-500 delay-700">
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Security</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Create a strong password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            disabled={isLoading}
                            autoComplete="new-password"
                            className="pl-12 pr-12 h-12 transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>

                        {formData.password && (
                          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-400 delay-1100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password strength</span>
                              <span className={`text-sm font-semibold ${
                                getPasswordStrengthScore() < 40 ? 'text-red-600 dark:text-red-400' :
                                getPasswordStrengthScore() < 80 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-green-600 dark:text-green-400'
                              }`}>
                                {getPasswordStrengthText()}
                              </span>
                            </div>
                            <div
                              className="h-3 w-full overflow-hidden rounded-full bg-secondary"
                            >
                              <div
                                className={`h-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                                style={{ width: `${getPasswordStrengthScore()}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap gap-1.5 text-[11px]">
                              {[
                                { label: '8+ chars', met: passwordStrength.minLength },
                                { label: 'Uppercase', met: passwordStrength.hasUpperCase },
                                { label: 'Lowercase', met: passwordStrength.hasLowerCase },
                                { label: 'Number', met: passwordStrength.hasNumber },
                                { label: 'Special', met: passwordStrength.hasSpecial },
                              ].map((req) => (
                                <span
                                  key={req.label}
                                  className={`px-2 py-0.5 rounded-full border ${
                                    req.met
                                      ? 'border-green-500/40 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                      : 'border-gray-200 dark:border-gray-700 text-gray-400'
                                  }`}
                                >
                                  {req.met ? '✓' : '○'} {req.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Re-enter your password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                            disabled={isLoading}
                            autoComplete="new-password"
                            className="pl-12 pr-12 h-12 transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                          <p className="text-xs text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-1 duration-200 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Passwords do not match
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col space-y-6 px-8 pt-6 pb-8 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-900">
                  <Button
                    type="submit"
                    className="w-full h-14 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 hover:from-blue-500 hover:via-blue-600 hover:to-indigo-700 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl text-white font-semibold text-lg"
                    disabled={isLoading || !isPasswordValid() || formData.password !== formData.confirmPassword}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-3 h-5 w-5" />
                        Create Account
                      </>
                    )}
                  </Button>

                  <div className="text-center text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-1000">
                    Already have an account?{' '}
                    <Link href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline transition-colors duration-200 hover:scale-105">
                      Sign in
                    </Link>
                  </div>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </AnimatedBackground>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
