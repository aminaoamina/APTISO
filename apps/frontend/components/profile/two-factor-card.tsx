'use client';

import { useEffect, useState } from 'react';
import { Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

type Status = { enabled: boolean; enabled_at: string | null; recovery_codes_left: number };
type Setup = { qr_code: string; secret: string };

/**
 * Optional two-step verification with an authenticator app (Microsoft or
 * Google Authenticator...): scan the QR code, confirm with a first code,
 * keep the recovery codes.
 */
export function TwoFactorCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi.twoFactorStatus().then(setStatus).catch(() => undefined);
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setCode('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const start = () => run(async () => setSetup(await authApi.twoFactorSetup()));

  const enable = () => run(async () => {
    const res = await authApi.twoFactorEnable(code.trim());
    setCodes(res.recovery_codes);
    setSetup(null);
    setStatus(await authApi.twoFactorStatus());
    toast.success('Two-step verification is on');
  });

  const disable = () => run(async () => {
    await authApi.twoFactorDisable(password, code.trim());
    setPassword('');
    setDisabling(false);
    setCodes(null);
    setStatus(await authApi.twoFactorStatus());
    toast.success('Two-step verification is off');
  });

  const regenerate = () => run(async () => {
    const res = await authApi.twoFactorRecoveryCodes(code.trim());
    setCodes(res.recovery_codes);
    setStatus(await authApi.twoFactorStatus());
    toast.success('New recovery codes: the old ones no longer work');
  });

  const copyCodes = () => {
    navigator.clipboard.writeText(codes!.join('\n'));
    toast.success('Recovery codes copied');
  };

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([`APTISO recovery codes (each works once)\n\n${codes!.join('\n')}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aptiso-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const codeInput = (
    <div className="field">
      <label>Code from the app{status?.enabled ? ' (or a recovery code)' : ''}</label>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" />
    </div>
  );

  return (
    <div id="two-factor">
      <div className="section-title">Two-step verification</div>
      <div className="section-subtitle">
        Optional. After your password, sign-in also asks for a code from an authenticator app (Microsoft Authenticator, Google Authenticator...).
      </div>

      {!status ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : codes ? (
        <div className="space-y-4">
          <p className="text-sm">
            Keep these recovery codes somewhere safe. Each one signs you in once if you lose your phone. They are shown only now.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {codes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={copyCodes}><Copy className="h-4 w-4" /> Copy</button>
            <button className="btn-ghost" onClick={downloadCodes}><Download className="h-4 w-4" /> Download</button>
            <button className="btn-accent" onClick={() => setCodes(null)}>I saved them</button>
          </div>
        </div>
      ) : status.enabled ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            On since {new Date(status.enabled_at!).toLocaleDateString()}, {status.recovery_codes_left} recovery code{status.recovery_codes_left === 1 ? '' : 's'} left.
          </p>
          {codeInput}
          {disabling && (
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-ghost" onClick={regenerate} disabled={busy || !code.trim()}>
              <KeyRound className="h-4 w-4" /> New recovery codes
            </button>
            {disabling ? (
              <button className="btn-accent" onClick={disable} disabled={busy || !code.trim() || !password}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />} Turn off
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => setDisabling(true)}>
                <ShieldOff className="h-4 w-4" /> Turn off
              </button>
            )}
          </div>
        </div>
      ) : setup ? (
        <div className="space-y-4">
          <p className="text-sm">1. In your authenticator app, add an account and scan this QR code.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr_code} alt="QR code for the authenticator app" width={180} height={180} className="rounded bg-white p-1" />
          <p className="text-xs text-muted-foreground">
            Can&apos;t scan? Enter this key by hand: <span className="font-mono break-all">{setup.secret}</span>
          </p>
          <p className="text-sm">2. Enter the 6-digit code the app shows.</p>
          {codeInput}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setSetup(null)} disabled={busy}>Cancel</button>
            <button className="btn-accent" onClick={enable} disabled={busy || !/^\d{6}$/.test(code.trim())}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Turn on
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button className="btn-accent" onClick={start} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Set up
          </button>
        </div>
      )}
    </div>
  );
}
