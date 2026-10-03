'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronRight, Download, FileText, Pencil, Plus, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AuditMap, CoverageStatus, Evidence, evidenceApi } from '@/lib/api';
import { formatDay, fullName } from '@/lib/tasks';
import { getErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useProjectStore } from '@/store/project-store';
import { EvidencePanel, ACCEPT, KIND_ICON, MAX_MB, NewEvidenceForm, validity } from '@/components/evidence/evidence-panel';
import { STATUS_LABELS } from '@/components/soa/soa-stages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const STATUS: Record<CoverageStatus, { label: string; className: string }> = {
  COVERED: { label: 'Covered', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  EXPIRED: { label: 'Evidence expired', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  MISSING_EVIDENCE: { label: 'Missing evidence', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  MISSING_DOCUMENT: { label: 'Document not approved', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  NOT_IMPLEMENTED: { label: 'Not implemented yet', className: 'bg-muted text-muted-foreground' },
};
const isGap = (s: CoverageStatus) => s !== 'COVERED';

/**
 * Audit & Evidence: what a certification auditor checks. The map shows, for
 * every clause and applicable control, the approved documents, the records
 * and the evidence, and what is missing; the library holds all evidence.
 */
export default function AuditEvidencePage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { currentProject, selectProject } = useProjectStore();
  useEffect(() => { if (currentProject?.id !== projectId) void selectProject(projectId); }, [currentProject?.id, projectId, selectProject]);
  const role = currentProject?.members?.find((m) => m.user_id === userId)?.privilege;
  const canEdit = role === 'PROJECT_LEAD' || role === 'PROJECT_MEMBER';

  const [tab, setTab] = useState<'map' | 'library'>('map');
  const [map, setMap] = useState<AuditMap | null>(null);
  const loadMap = useCallback(async () => {
    try { setMap(await evidenceApi.map(projectId)); } catch (err) { toast.error(getErrorMessage(err, 'Failed to load the evidence map')); }
  }, [projectId]);
  useEffect(() => { void loadMap(); }, [loadMap]);

  if (!map || !role) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;

  const clausesCovered = map.clauses.filter((c) => c.status === 'COVERED').length;
  const implemented = map.controls.filter((c) => c.status !== 'NOT_IMPLEMENTED');
  const controlsCovered = implemented.filter((c) => c.status === 'COVERED').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5"><ShieldCheck className="h-6 w-6 text-primary" />Audit &amp; Evidence</h1>
        <p className="text-muted-foreground text-sm mt-1">
          What the certification auditor will check: for each requirement, the approved documents, the records of your registers and the evidence that it works.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="ISO 27001 clauses covered" value={`${clausesCovered} / ${map.clauses.length}`} />
        <Summary label="Implemented controls with evidence" value={`${controlsCovered} / ${implemented.length}`} />
        <Summary label="Controls not implemented yet" value={String(map.controls.length - implemented.length)} />
      </div>

      <div className="flex gap-1 border-b">
        {(['map', 'library'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); if (t === 'map') void loadMap(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'map' ? 'Evidence map' : 'Evidence library'}
          </button>
        ))}
      </div>

      {tab === 'map'
        ? <EvidenceMap map={map} orgId={orgId} projectId={projectId} canEdit={canEdit} />
        : <EvidenceLibrary projectId={projectId} canEdit={canEdit} isLead={role === 'PROJECT_LEAD'} />}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="py-4"><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>
  );
}

// ─── Evidence map ────────────────────────────────────────────────

function EvidenceMap({ map, orgId, projectId, canEdit }: { map: AuditMap; orgId: string; projectId: string; canEdit: boolean }) {
  const [gapsOnly, setGapsOnly] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const stepHref = (stepId: string) => `/dashboard/organizations/${orgId}/projects/${projectId}/steps/${stepId}`;
  const clauses = map.clauses.filter((c) => !gapsOnly || isGap(c.status));
  const controls = map.controls.filter((c) => !gapsOnly || isGap(c.status));
  const toggle = (key: string) => setOpen(open === key ? null : key);

  const documents = (docs: AuditMap['clauses'][number]['documents']) => docs.map((d) => (
    <Link key={d.step_id} href={stepHref(d.step_id)} className="inline-flex items-center gap-1 text-xs hover:underline">
      {d.in_library ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <FileText className="h-3 w-3 text-red-500" />}
      {d.title}{d.version ? ` v${d.version}` : ' (not approved)'}
    </Link>
  ));

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} />
        Show only what is missing
      </label>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">ISO 27001 clauses 4 to 10</h2>
        {clauses.length === 0 && <p className="text-sm text-muted-foreground">Every clause is covered.</p>}
        {clauses.map((c) => (
          <div key={c.ref} className="rounded-lg border">
            <button className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-accent/30" onClick={() => toggle(`c:${c.ref}`)} aria-expanded={open === `c:${c.ref}`}>
              {open === `c:${c.ref}` ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="w-12 font-mono text-xs">{c.ref}</span>
              <span className="flex-1 min-w-40">{c.title}</span>
              {c.evidence.valid > 0 && <span className="text-xs text-muted-foreground">{c.evidence.valid} evidence</span>}
              <Badge className={STATUS[c.status].className}>{STATUS[c.status].label}</Badge>
            </button>
            {open === `c:${c.ref}` && (
              <div className="space-y-3 border-t p-3">
                <p className="text-xs italic text-muted-foreground">Auditor question: {c.question}</p>
                {c.documents.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-1"><span className="text-xs font-medium">Documents:</span>{documents(c.documents)}</div>}
                {c.records.length > 0 && (
                  <p className="text-xs"><span className="font-medium">Records: </span>{c.records.map((r) => `${r.count} ${r.label}`).join(' · ')}</p>
                )}
                <EvidencePanel projectId={projectId} target={{ type: 'CLAUSE', id: c.ref }} canEdit={canEdit}
                  hint={c.documents.length + c.records.length === 0 ? 'This clause is proven by evidence only, e.g. a communication plan, meeting minutes or a change record.' : undefined} />
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Applicable Annex A controls</h2>
          {map.soa_step_id && <Link href={stepHref(map.soa_step_id)} className="text-xs text-primary hover:underline">Open the Statement of Applicability</Link>}
        </div>
        {map.controls.length === 0 && <p className="text-sm text-muted-foreground">No applicable control yet: set up the Statement of Applicability first.</p>}
        {map.controls.length > 0 && controls.length === 0 && <p className="text-sm text-muted-foreground">Every implemented control has evidence.</p>}
        {controls.map((c) => (
          <div key={c.id} className="rounded-lg border">
            <button className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-accent/30" onClick={() => toggle(`k:${c.id}`)} aria-expanded={open === `k:${c.id}`}>
              {open === `k:${c.id}` ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="w-12 font-mono text-xs">{c.code}</span>
              <span className="flex-1 min-w-40">{c.title}</span>
              {c.implementation && c.status !== 'NOT_IMPLEMENTED' && <span className="text-xs text-muted-foreground">{STATUS_LABELS[c.implementation]}</span>}
              <Badge className={STATUS[c.status].className}>{c.status === 'NOT_IMPLEMENTED' && c.implementation ? STATUS_LABELS[c.implementation] : STATUS[c.status].label}</Badge>
            </button>
            {open === `k:${c.id}` && (
              <div className="space-y-3 border-t p-3">
                {c.documents.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-1"><span className="text-xs font-medium">Policies:</span>{documents(c.documents)}</div>}
                <EvidencePanel projectId={projectId} target={{ type: 'SOA_CONTROL', id: c.id }} canEdit={canEdit}
                  hint="Add what an auditor can check: a screenshot of the setting, a report, a log or a signed record." />
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

// ─── Evidence library ────────────────────────────────────────────

type LibraryFilter = 'all' | 'expiring' | 'expired' | 'unlinked';

function EvidenceLibrary({ projectId, canEdit, isLead }: { projectId: string; canEdit: boolean; isLead: boolean }) {
  const [items, setItems] = useState<Evidence[] | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await evidenceApi.list(projectId)); } catch { setItems([]); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter((e) => {
      const v = validity(e);
      if (filter === 'expired' && !v?.label.startsWith('Expired')) return false;
      if (filter === 'expiring' && !v?.label.startsWith('Expires')) return false;
      if (filter === 'unlinked' && e.links.length > 0) return false;
      return !q || [e.title, e.description, ...e.links.map((l) => l.label)].some((t) => t?.toLowerCase().includes(q));
    });
  }, [items, search, filter]);

  if (!items) return <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, description or what it proves" />
        </div>
        {(['all', 'expiring', 'expired', 'unlinked'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {{ all: 'All', expiring: 'Expiring in 30 days', expired: 'Expired', unlinked: 'Not linked' }[f]}
          </Button>
        ))}
        {canEdit && !adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Add evidence</Button>}
      </div>

      {adding && <NewEvidenceForm projectId={projectId} onDone={async (added) => { setAdding(false); if (added) await load(); }} />}

      {shown.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {items.length ? 'Nothing matches.' : 'No evidence yet. Add it here or directly on a clause, a control or a task.'}
        </CardContent></Card>
      ) : shown.map((e) => <LibraryItem key={e.id} evidence={e} canEdit={canEdit} isLead={isLead} onChanged={load} />)}
    </div>
  );
}

function LibraryItem({ evidence: e, canEdit, isLead, onChanged }: { evidence: Evidence; canEdit: boolean; isLead: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(e.title);
  const [validUntil, setValidUntil] = useState(e.valid_until?.slice(0, 10) ?? '');
  const [busy, setBusy] = useState(false);
  const Icon = KIND_ICON[e.kind];
  const v = validity(e);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try { await action(); toast.success(success); setEditing(false); await onChanged(); }
    catch (err) { toast.error(getErrorMessage(err, 'The change could not be saved')); }
    finally { setBusy(false); }
  };

  const replace = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`The file is larger than ${MAX_MB} MB`); return; }
    void run(() => evidenceApi.replaceFile(e.id, file), 'New version uploaded; the earlier one is kept');
  };

  const withdraw = () => {
    const reason = window.prompt(`Withdraw "${e.title}"? It leaves the library but its record is kept. Reason:`);
    if (reason?.trim()) void run(() => evidenceApi.withdraw(e.id, reason.trim()), 'Evidence withdrawn');
  };

  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <div className="flex flex-wrap items-start gap-3">
          <Icon className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {e.kind === 'LINK' && e.url
                ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{e.title}</a>
                : <span className="font-medium">{e.title}</span>}
              {v && <Badge className={`text-[10px] ${v.className}`}>{v.label}</Badge>}
            </div>
            {e.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{e.description}</p>}
            <p className="text-xs text-muted-foreground">Collected {formatDay(e.collected_on)} · added by {fullName(e.creator)}</p>
            <div className="flex flex-wrap gap-1">
              {e.links.length === 0
                ? <Badge variant="outline" className="text-[10px]">Not linked to a requirement yet</Badge>
                : e.links.map((l) => <Badge key={l.id} variant="outline" className="text-[10px] font-normal">{l.label}</Badge>)}
            </div>
            {e.files.length > 0 && (
              <ul className="space-y-0.5 pt-1">
                {e.files.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-16">{i === 0 ? 'Current' : `Earlier`}</span>
                    <span className="truncate" title={`SHA-256 ${f.sha256}`}>{f.file_name} · {formatDay(f.uploaded_at)} by {fullName(f.uploader)}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-1.5" aria-label="Download" onClick={() => void evidenceApi.download(e.id, f.id).catch((err) => toast.error(getErrorMessage(err, 'Download failed')))}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {canEdit && (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" className="h-8 px-2" aria-label="Edit" onClick={() => setEditing(!editing)}><Pencil className="h-4 w-4" /></Button>
              {e.kind === 'FILE' && (
                <label className="inline-flex h-8 cursor-pointer items-center rounded-md px-2 hover:bg-accent" aria-label="Upload a new version" title="Upload a new version">
                  <Upload className="h-4 w-4" />
                  <input type="file" accept={ACCEPT} className="sr-only" disabled={busy} onChange={(ev) => replace(ev.target.files?.[0])} />
                </label>
              )}
              {isLead && <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" aria-label="Withdraw" onClick={withdraw}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          )}
        </div>
        {editing && (
          <div className="grid gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <label className="text-[11px] text-muted-foreground">Title<Input value={title} maxLength={200} onChange={(ev) => setTitle(ev.target.value)} /></label>
            <label className="text-[11px] text-muted-foreground">Valid until<Input type="date" value={validUntil} onChange={(ev) => setValidUntil(ev.target.value)} /></label>
            <Button size="sm" disabled={busy || !title.trim()} onClick={() => run(() => evidenceApi.update(e.id, { title: title.trim(), valid_until: validUntil || null }), 'Saved')}>Save</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
