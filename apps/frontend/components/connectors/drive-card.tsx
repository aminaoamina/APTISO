'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Cloud, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { connectorsApi, DriveStatus } from '@/lib/api';
import { fullName } from '@/lib/tasks';
import { getErrorMessage } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'never');

/**
 * Integrations (owner and admins): a copy of every approved library version
 * in the organization's Google Drive. APTISO stays the record; the drive is a mirror.
 */
export function DriveCard({ orgId }: { orgId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<DriveStatus | null>(null);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);

  const load = useCallback(async () => {
    try { setState(await connectorsApi.status(orgId)); } catch { setState(null); }
  }, [orgId]);
  useEffect(() => { void load(); }, [load]);

  // Coming back from the Google sign-in page.
  useEffect(() => {
    const result = params.get('drive');
    if (!result) return;
    if (result === 'connected') toast.success('Google Drive connected: the library is being copied');
    else if (result === 'cancelled') toast.info('Google Drive was not connected');
    else toast.error(params.get('reason') ?? 'Google Drive could not be connected');
    router.replace(`/dashboard/organizations/${orgId}`);
  }, [params, orgId, router]);

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setBusy(kind);
    try { await action(); } catch (err) { toast.error(getErrorMessage(err, 'The action failed')); } finally { setBusy(null); }
  };

  const connect = () => run('connect', async () => {
    const { url } = await connectorsApi.connectGoogle(orgId);
    window.location.assign(url);
  });
  const sync = () => run('sync', async () => {
    const r = await connectorsApi.sync(orgId);
    toast.success(r.failed ? `${r.copied} copied, ${r.failed} failed (see below)` : `${r.copied} file(s) copied`);
    await load();
  });
  const disconnect = () => {
    if (!window.confirm('Disconnect Google Drive? New versions will no longer be copied. Files already in the drive stay there.')) return;
    void run('disconnect', async () => {
      toast.success((await connectorsApi.disconnect(orgId)).message);
      await load();
    });
  };

  if (!state) return null;
  const c = state.connection;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Cloud className="h-4 w-4" />Integrations: Google Drive</CardTitle>
        <CardDescription>
          A copy of every approved version of the document library, in folders by project and phase. APTISO stays the record:
          nothing is ever replaced or deleted in the drive, and APTISO only has access to the files it creates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!c && !state.google_available && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground">
            Not set up on this server yet: the administrator must add the Google OAuth client and an encryption key
            (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CONNECTOR_SECRET_KEY) to the backend settings.
          </p>
        )}
        {!c && state.google_available && (
          <Button onClick={connect} disabled={!!busy}>
            {busy === 'connect' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}Connect Google Drive
          </Button>
        )}
        {c && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {c.status === 'ACTIVE'
                ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>
                : <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-3 w-3 mr-1" />Reconnect needed</Badge>}
              <span className="font-medium">{c.account_email}</span>
              <span className="text-xs text-muted-foreground">connected by {fullName(c.connector)} · last copy {when(c.last_sync_at)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.counts.synced} file(s) in the drive · {c.counts.pending} waiting · {c.counts.failed} failed
            </p>
            {c.status === 'NEEDS_RECONNECT' && (
              <p className="text-xs text-red-700 dark:text-red-400">
                Google refused the stored access{c.last_error ? ` (${c.last_error})` : ''}. Reconnect to resume copying; nothing is lost meanwhile.
              </p>
            )}
            {state.failures && state.failures.length > 0 && (
              <ul className="space-y-1 rounded-md bg-muted/40 p-2 text-xs">
                {state.failures.map((f) => (
                  <li key={f.id}><span className="font-medium">{f.title} v{f.version}</span> · {f.attempts} attempt(s) · {f.error}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {c.status === 'ACTIVE' ? (
                <Button size="sm" variant="outline" onClick={sync} disabled={!!busy}>
                  {busy === 'sync' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}Sync now
                </Button>
              ) : state.google_available && (
                <Button size="sm" onClick={connect} disabled={!!busy}><Cloud className="h-4 w-4 mr-1.5" />Reconnect</Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={disconnect} disabled={!!busy}>
                <Unplug className="h-4 w-4 mr-1.5" />Disconnect
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
