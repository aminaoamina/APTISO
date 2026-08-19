'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    // This page is no longer used - redirect to forgot-password
    toast.info('Please use the forgot password page to reset your password');
    router.push('/forgot-password');
  }, [router]);

  return null;
}
