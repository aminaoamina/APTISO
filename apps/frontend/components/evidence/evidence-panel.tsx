'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Link2, Loader2, Paperclip, Plus, StickyNote, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Evidence, evidenceApi, EvidenceTarget, NewEvidence } from '@/lib/api';
import { formatDay, fullName } from '@/lib/tasks';
import { getErrorMessage } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

export const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.eml,.zip';
export const MAX_MB = 25;
export const KIND_ICON = { FILE: Paperclip, LINK: Link2, NOTE: StickyNote } as const;
const today = () => new Date().toISOString().slice(0, 10);

export function validity(e: Evidence) {
  if (!e.valid_until) return null;
  const days = (new Date(e.valid_until).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return { label: `Expired ${formatDay(e.valid_until)}`, className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
  if (days < 30) return { label: `Expires ${formatDay(e.valid_until)}`, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
  return { label: `Valid until ${formatDay(e.valid_until)}`, className: 'bg-muted text-muted-foreground' };
}

/**
 * Evidence of one clause, control or task: files, links and notes that prove
 * it is done. The same evidence can be linked to several requirements.
 */
export function EvidencePanel({ projectId, target, canEdit, hint }: {
  projectId: string;
  target: EvidenceTarget;
  canEdit: boolean;
  /** What would be good evidence here, shown while there is none. */
  hint?: string;
}) {
  const [items, setItems] = useState<Evidence[] | null>(null);
  const [mode, setMode] = useState<'closed' | 'new' | 'existing'>('closed');

  const { type, id } = target;
  const load = useCallback(async () => {
    try {
      setItems(await evidenceApi.list(projectId, { type, id }));
    } catch {
      setItems([]);
    }
  }, [projectId, type, id]);

  useEffect(() => { void load(); }, [load]);

  const unlink = async (e: Evidence) => {
    const link = e.links.find((l) => l.target_type === target.type && l.target_id === target.id);
    if (!link || !window.confirm(`Remove "${e.title}" from here? The evidence itself is kept.`)) return;
    try {
      await evidenceApi.unlink(e.id, link.id);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove the evidence'));
    }
  };

  const download = async (e: Evidence) => {
    try {
      await evidenceApi.download(e.id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download the file'));
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium"><Paperclip className="h-3.5 w-3.5" />Evidence{items ? ` (${items.length})` : ''}</span>
        {canEdit && mode === 'closed' && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMode('new')}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMode('existing')}><Link2 className="h-3.5 w-3.5 mr-1" />Use existing</Button>
          </div>
        )}
      </div>

      {items === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : items.length === 0 ? (
        mode === 'closed' && <p className="text-xs text-muted-foreground">{hint ?? 'No evidence yet.'}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((e) => {
            const Icon = KIND_ICON[e.kind];
            const valid = validity(e);
            const file = e.files[0];
            return (
              <li key={e.id} className="flex items-start gap-2 text-sm">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {e.kind === 'LINK' && e.url ? (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{e.title}<ExternalLink className="ml-1 inline h-3 w-3" /></a>
                    ) : (
                      <span className="font-medium">{e.title}</span>
                    )}
                    {valid && <Badge className={`text-[10px] ${valid.className}`}>{valid.label}</Badge>}
                  </div>
                  {e.description && <p className="whitespace-pre-line text-xs text-muted-foreground">{e.description}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    Collected {formatDay(e.collected_on)} · added by {fullName(e.creator)}
                    {file && <span title={`SHA-256 ${file.sha256}`}> · {file.file_name} ({Math.max(1, Math.round(file.size_bytes / 1024))} KB)</span>}
                  </p>
                </div>
                {file && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => download(e)} aria-label="Download"><Download className="h-3.5 w-3.5" /></Button>}
                {canEdit && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => unlink(e)} aria-label="Remove from here"><Unlink className="h-3.5 w-3.5" /></Button>}
              </li>
            );
          })}
        </ul>
      )}

      {mode === 'new' && <NewEvidenceForm projectId={projectId} target={target} onDone={async (added) => { setMode('closed'); if (added) await load(); }} />}
      {mode === 'existing' && (
        <ExistingEvidence projectId={projectId} target={target} linked={new Set(items?.map((e) => e.id))}
          onDone={async (added) => { setMode('closed'); if (added) await load(); }} />
      )}
    </div>
  );
}

/** Without a target (library), the evidence can be linked later. */
export function NewEvidenceForm({ projectId, target, onDone }: { projectId: string; target?: EvidenceTarget; onDone: (added: boolean) => Promise<void> }) {
  const [kind, setKind] = useState<Evidence['kind']>('FILE');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [collected, setCollected] = useState(today());
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const missing = !title.trim() || (kind === 'FILE' && !file) || (kind === 'LINK' && !url.trim()) || (kind === 'NOTE' && !description.trim());

  const save = async () => {
    if (file && file.size > MAX_MB * 1024 * 1024) { toast.error(`The file is larger than ${MAX_MB} MB`); return; }
    setSaving(true);
    try {
      const data: NewEvidence = {
        title: title.trim(), kind, collected_on: collected, links: target ? [target] : [],
        ...(description.trim() && { description: description.trim() }),
        ...(validUntil && { valid_until: validUntil }),
        ...(kind === 'LINK' && { url: url.trim() }),
        ...(kind === 'FILE' && file && { file }),
      };
      await evidenceApi.create(projectId, data);
      toast.success('Evidence added');
      await onDone(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add the evidence'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <div className="flex gap-1">
        {(['FILE', 'LINK', 'NOTE'] as const).map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <Button key={k} size="sm" variant={kind === k ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setKind(k)}>
              <Icon className="h-3.5 w-3.5 mr-1" />{k === 'FILE' ? 'File' : k === 'LINK' ? 'Link' : 'Note'}
            </Button>
          );
        })}
      </div>
      <Input maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is it? e.g. Backup restore test, March 2027" />
      {kind === 'FILE' && (
        <div>
          <Input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-[11px] text-muted-foreground">PDF, images, Office files, CSV, text, e-mail or ZIP, up to {MAX_MB} MB.</p>
        </div>
      )}
      {kind === 'LINK' && <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (ticket, wiki page, system report)" />}
      <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder={kind === 'NOTE' ? 'The note: what was checked, by whom, and the result' : 'Description (optional)'} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-muted-foreground">Collected on<Input type="date" value={collected} max={today()} onChange={(e) => setCollected(e.target.value)} /></label>
        <label className="text-[11px] text-muted-foreground">Valid until (optional)<Input type="date" value={validUntil} min={collected} onChange={(e) => setValidUntil(e.target.value)} /></label>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onDone(false)}>Cancel</Button>
        <Button size="sm" disabled={missing || saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}Add evidence
        </Button>
      </div>
    </div>
  );
}

/** One proof often covers several requirements: link evidence already in the project. */
function ExistingEvidence({ projectId, target, linked, onDone }: {
  projectId: string;
  target: EvidenceTarget;
  linked: Set<string>;
  onDone: (added: boolean) => Promise<void>;
}) {
  const [all, setAll] = useState<Evidence[] | null>(null);
  const [chosen, setChosen] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { void evidenceApi.list(projectId).then(setAll).catch(() => setAll([])); }, [projectId]);
  const options = (all ?? []).filter((e) => !linked.has(e.id));

  const save = async () => {
    setSaving(true);
    try {
      await evidenceApi.link(chosen, target);
      await onDone(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to link the evidence'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-3 sm:flex-row sm:items-center">
      {all === null ? <Loader2 className="h-4 w-4 animate-spin" /> : options.length === 0 ? (
        <p className="flex-1 text-xs text-muted-foreground">No other evidence in this project yet.</p>
      ) : (
        <NativeSelect value={chosen} onChange={(e) => setChosen(e.target.value)}>
          <option value="">Choose evidence…</option>
          {options.map((e) => <option key={e.id} value={e.id}>{e.title} ({formatDay(e.collected_on)})</option>)}
        </NativeSelect>
      )}
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" onClick={() => onDone(false)}>Cancel</Button>
        {options.length > 0 && <Button size="sm" disabled={!chosen || saving} onClick={save}>Link</Button>}
      </div>
    </div>
  );
}
