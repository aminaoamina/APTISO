'use client';

import { useCallback, useEffect, useState } from 'react';
import { FilePlus, Loader2, Printer } from 'lucide-react';
import type { RiskRegisterCompletion } from '@/lib/api';
import type { Member } from '@/lib/audit-prep-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

export { BlurField, InfoTip } from '@/components/risk-register/risk-stages';

/**
 * Loads a register, keeps its state, and runs actions that return the new
 * state (every Phase 4 endpoint returns the full register).
 */
export function useRegister<T extends object>(
  load: () => Promise<T>,
  onCompletionChange?: (c: RiskRegisterCompletion) => void,
) {
  const [state, setState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setState(await load());
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const completion = (state as { completion?: RiskRegisterCompletion } | null)?.completion;
    if (completion) onCompletionChange?.(completion);
  }, [state, onCompletionChange]);

  const run = useCallback(async (fn: () => Promise<T>, success?: string) => {
    try {
      setState(await fn());
      if (success) toast.success(success);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
      return false;
    }
  }, []);

  return { state, loading, run, reload };
}

export const nameOf = (members: Member[], id: string | null | undefined) =>
  (id && members.find(m => m.id === id)?.label) || '—';

export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : '—');

/** yyyy-mm-dd for <input type="date"> */
export const dateValue = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');

export function PersonSelect({
  members,
  value,
  onChange,
  disabled,
  placeholder = 'Not assigned',
  id,
  onlyDeciders,
}: {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  onlyDeciders?: boolean;
}) {
  const list = onlyDeciders ? members.filter(m => m.is_top_management || m.privilege === 'PROJECT_LEAD') : members;
  return (
    <NativeSelect id={id} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {list.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
    </NativeSelect>
  );
}

export function PeoplePicker({
  members,
  value,
  onChange,
  disabled,
}: {
  members: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const set = new Set(value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map(m => {
        const active = set.has(m.id);
        return (
          <button key={m.id} type="button" aria-pressed={active} disabled={disabled}
            onClick={() => onChange(active ? value.filter(v => v !== m.id) : [...value, m.id])}
            className={`rounded-full border px-2.5 py-1 text-xs ${active ? 'border-[var(--brand-orange)] bg-[var(--brand-orange)]/10 font-medium' : 'border-border text-muted-foreground hover:bg-accent'}`}>
            {m.label}{m.is_top_management && ' · TM'}
          </button>
        );
      })}
    </div>
  );
}

export function Counters({ items }: { items: [string, string | number][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function DocumentCard({
  title,
  description,
  documents,
  canEdit,
  onGenerate,
  href,
}: {
  title: string;
  description: string;
  documents: { id: string; title: string }[];
  canEdit: boolean;
  onGenerate: () => Promise<unknown>;
  href: (id: string) => string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <Button disabled={busy} onClick={async () => { setBusy(true); try { await onGenerate(); } finally { setBusy(false); } }}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FilePlus className="h-4 w-4 mr-2" />}
            {documents.length > 0 ? 'Refresh document' : 'Generate document'}
          </Button>
        )}
        {documents.map(d => (
          <a key={d.id} href={href(d.id)} className="flex items-center gap-2 text-sm text-[var(--brand-orange)] hover:underline">
            <Printer className="h-4 w-4" />{d.title}
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

export function ReadOnlyNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      You have read-only access (auditor).
    </p>
  );
}

export type StepComponentProps = {
  stepId: string;
  orgId: string;
  projectId: string;
  onCompletionChange?: (c: RiskRegisterCompletion) => void;
};

export const docHref = (orgId: string, projectId: string) => (id: string) =>
  `/dashboard/organizations/${orgId}/projects/${projectId}/documents/${id}`;
