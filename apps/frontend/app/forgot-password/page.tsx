'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Lock, KeyRound, CheckCircle2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { EmailInput, LoadingButton, PasswordInput, TextInput } from '@/components/form-components';
import { FadeIn, SlideIn } from '@/components/animations';
import { AnimatedBackground } from '@/components/animated-background';
import { ThemeToggle } from '@/components/theme-toggle';
import { authApi } from '@/lib/api';
import { PasswordStrength } from '@/components/password-strength';
import { getErrorMessage } from '@/lib/utils';

// Step 1: Email Entry Schema
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// Step 2: Code Verification Schema
const codeSchema = z.object({
  code: z
    .string()
    .length(5, 'Reset code must be exactly 5 digits')
    .regex(/^\d+$/, 'Reset code must contain only numbers'),
});

// Step 3: New Password Schema
const passwordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

type EmailFormData = z.infer<typeof emailSchema>;
type CodeFormData = z.infer<typeof codeSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const codeForm = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      new_password: '',
      confirm_password: '',
    },
  });

  const watchedPassword = passwordForm.watch('new_password');

  // Step 1: Submit Email
  const onSubmitEmail = async (data: EmailFormData) => {
    setIsLoading(true);
    try {
      const response = await authApi.requestPasswordReset(data.email);

      if (!response.user_exists) {
        toast.error(response.message);
        return;
      }

      setEmail(data.email);
      setCurrentStep(2);
      toast.success('Reset code sent! Please check your email.');
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to send reset code');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Code
  const onSubmitCode = async (data: CodeFormData) => {
    setIsLoading(true);
    try {
      const response = await authApi.verifyResetCode(email, data.code);

      if (response.valid) {
        setResetCode(data.code);
        setCurrentStep(3);
        toast.success('Code verified! Please enter your new password.');
      } else {
        toast.error(response.message || 'Invalid reset code');
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to verify code');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset Password
  const onSubmitPassword = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      await authApi.resetPassword(email, resetCode, data.new_password);
      toast.success('Your password has been successfully reset!');

      // Redirect to login after 1.5 seconds
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to reset password');
      toast.error(message);
      setIsLoading(false);
    }
  };

  // Resend Code
  const handleResendCode = async () => {
    setIsResending(true);
    try {
      await authApi.resendResetCode(email);
      toast.success('New reset code sent! Please check your email.');
      codeForm.reset();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to resend code');
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      codeForm.reset();
    } else if (currentStep === 3) {
      setCurrentStep(2);
      passwordForm.reset();
    }
  };

  return (
    <AnimatedBackground>
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <FadeIn>
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-6 w-6 text-primary" />
                <CardTitle>Reset Password</CardTitle>
              </div>
              {currentStep > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={isLoading}
                  aria-label="Go back to previous step"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={3}>
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                      currentStep >= step
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted bg-background text-muted-foreground'
                    }`}
                    aria-label={`Step ${step}${currentStep === step ? ' (current)' : currentStep > step ? ' (completed)' : ''}`}
                  >
                    {currentStep > step ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      step
                    )}
                  </div>
                  {step < 3 && (
                    <div
                      className={`h-0.5 w-12 transition-colors ${
                        currentStep > step ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {/* Step 1: Email Entry */}
            {currentStep === 1 && (
              <SlideIn key="step-1">
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-6">
                    <div className="space-y-2 text-center mb-6">
                      <Mail className="h-12 w-12 text-muted-foreground mx-auto" />
                      <h3 className="text-lg font-semibold">Enter Your Email</h3>
                      <p className="text-sm text-muted-foreground">
                        We&apos;ll send a 5-digit verification code to your email address
                      </p>
                    </div>

                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <EmailInput
                              placeholder="Enter your email"
                              {...field}
                              disabled={isLoading}
                              autoFocus
                              aria-describedby="email-description"
                            />
                          </FormControl>
                          <FormDescription id="email-description">
                            Enter the email address associated with your account
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <LoadingButton
                      type="submit"
                      className="w-full"
                      loading={isLoading}
                      loadingText="Sending code..."
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Send Reset Code
                    </LoadingButton>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => router.push('/login')}
                    >
                      Back to Login
                    </Button>
                  </form>
                </Form>
              </SlideIn>
            )}

            {/* Step 2: Code Verification */}
            {currentStep === 2 && (
              <SlideIn key="step-2">
                <Form {...codeForm}>
                  <form onSubmit={codeForm.handleSubmit(onSubmitCode)} className="space-y-6">
                    <div className="space-y-2 text-center mb-6">
                      <KeyRound className="h-12 w-12 text-muted-foreground mx-auto" />
                      <h3 className="text-lg font-semibold">Enter Verification Code</h3>
                      <p className="text-sm text-muted-foreground">
                        We sent a 5-digit code to <strong>{email}</strong>
                      </p>
                    </div>

                    <FormField
                      control={codeForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verification Code</FormLabel>
                          <FormControl>
                            <TextInput
                              placeholder="12345"
                              {...field}
                              disabled={isLoading}
                              autoFocus
                              maxLength={5}
                              className="text-center text-2xl tracking-widest font-mono"
                              aria-describedby="code-description"
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                          </FormControl>
                          <FormDescription id="code-description">
                            Enter the 5-digit code from your email (expires in 10 minutes)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <LoadingButton
                      type="submit"
                      className="w-full"
                      loading={isLoading}
                      loadingText="Verifying..."
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Verify Code
                    </LoadingButton>

                    <div className="text-center">
                      <Button
                        type="button"
                        variant="link"
                        onClick={handleResendCode}
                        disabled={isResending || isLoading}
                        className="text-sm"
                      >
                        {isResending ? 'Sending...' : "Didn't receive a code? Resend"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </SlideIn>
            )}

            {/* Step 3: New Password */}
            {currentStep === 3 && (
              <SlideIn key="step-3">
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} className="space-y-6">
                    <div className="space-y-2 text-center mb-6">
                      <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
                      <h3 className="text-lg font-semibold">Create New Password</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose a strong password for your account
                      </p>
                    </div>

                    <FormField
                      control={passwordForm.control}
                      name="new_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <PasswordInput
                              placeholder="Enter new password"
                              {...field}
                              disabled={isLoading}
                              autoFocus
                              aria-describedby="password-description"
                            />
                          </FormControl>
                          <FormDescription id="password-description">
                            Must be at least 8 characters with uppercase, lowercase, and numbers
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchedPassword && (
                      <PasswordStrength password={watchedPassword} />
                    )}

                    <FormField
                      control={passwordForm.control}
                      name="confirm_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <PasswordInput
                              placeholder="Confirm new password"
                              {...field}
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <LoadingButton
                      type="submit"
                      className="w-full"
                      loading={isLoading}
                      loadingText="Resetting password..."
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Reset Password
                    </LoadingButton>
                  </form>
                </Form>
              </SlideIn>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </AnimatedBackground>
  );
}
