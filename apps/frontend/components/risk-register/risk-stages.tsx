'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, FilePlus, FileText,
  Info, Loader2, Printer, Trash2, X,
} from 'lucide-react';
import type { RiskItem, RiskRegisterState, RiskSeedData, RiskUpdate, TreatmentOption } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Shared help texts (Conformio wording) ──────────────────────

export const HELP = {
  impact:
    'Impact is your subjective assessment of how big the damage will be if this risk happens. Low: loss of confidentiality, availability or integrity does not affect your company\'s cash flow, legal or contractual obligations, or its reputation. Moderate: it incurs costs and has a low or moderate impact on legal or contractual obligations, or on your reputation. High: it has considerable and/or immediate impact on your cash flow, operations, legal or contractual obligations, or reputation.',
  likelihood:
    'Likelihood is your subjective assessment of how probable it is that this risk will happen. Low: existing security controls are strong and have so far provided an adequate level of protection; no new incidents are expected. Moderate: existing controls are moderate and have mostly provided adequate protection; new incidents are possible, but not very likely. High: existing controls are low or ineffective; such incidents have a high probability of occurring.',
  level:
    'Risk level is calculated automatically by adding impact and likelihood (0–4), as defined in your Risk Assessment and Treatment Methodology. Levels 3 and 4 are unacceptable and must be treated.',
  owner:
    'The person who will be in charge of dealing with the risk — choose someone who is both interested and has the authority to do something. For example, for the risk of a malware attack, the person in charge of IT.',
  department:
    'The department to which the asset belongs, or the department responsible for the asset. Not mandatory.',
  assetOwner:
    'The person responsible for the asset in normal daily use. If several people use the same type of asset (e.g. laptops), the owner can be "the user of a particular asset". Not mandatory.',
  existingControls:
    'Security controls that are already in place for this risk before any treatment (e.g. antivirus installed, access badges). Your methodology requires them to be recorded in the Risk Assessment Table.',
  comment:
    'Any comment that can help you or your colleagues — e.g. why you selected a particular vulnerability or threat, or why you rated the risk this way.',
  treatmentOption:
    'Keep "Decrease the risk using safeguards" unless you want to transfer, avoid or accept the risk. Transfer if a third party can cover the damage (e.g. insurance against fire). Avoid if you can stop the activity that causes the risk (e.g. prohibit personal devices). Accept only if treating the risk would cost more than the damage it can cause.',
  controls:
    'The more different controls are selected, the better the chances of decreasing the residual risk. Selected controls will also appear in the Statement of Applicability, where you specify how they are implemented.',
  residual:
    'Residual risk is the risk that remains after the treatment is applied. Re-assess impact and likelihood assuming the treatment is in place.',
};

export const TREATMENT_LABELS: Record<TreatmentOption, string> = {
  DECREASE: 'Decrease the risk using safeguards',
  TRANSFER: 'Transfer the risk to a third party',
  AVOID: 'Avoid the risk',
  ACCEPT: 'Accept the risk',
};

export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="More information" className="text-muted-foreground hover:text-foreground">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

export const levelColor = (level: number | null, maxAcceptable = 2) => {
  if (level == null) return 'bg-muted text-muted-foreground';
  if (level <= maxAcceptable) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  if (level === maxAcceptable + 1) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
};

const statusBorder: Record<RiskItem['status'], string> = {
  NEW: 'border-l-blue-400',
  EDITED: 'border-l-amber-400',
  APPROVED: 'border-l-green-500',
};

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-green-500" />Approved / acceptable</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-amber-400" />Edited</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-blue-400" />New</span>
      <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" />Has incidents / nonconformities</span>
    </div>
  );
}

function ScaleSelect({
  value,
  onChange,
  labels,
  disabled,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  labels: Record<number, string>;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <NativeSelect
      aria-label={ariaLabel}
      value={value?.toString() ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">—</option>
      {Object.entries(labels).map(([v, l]) => (
        <option key={v} value={v}>{l} ({v})</option>
      ))}
    </NativeSelect>
  );
}

/** Text field that saves on blur instead of on every keystroke. */
export function BlurField({
  value,
  onSave,
  multiline,
  disabled,
  placeholder,
  id,
}: {
  value: string | null;
  onSave: (v: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const commit = () => { if (draft !== (value ?? '')) onSave(draft); };
  return multiline ? (
    <Textarea id={id} rows={2} value={draft} disabled={disabled} placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
  ) : (
    <Input id={id} value={draft} disabled={disabled} placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
  );
}

function RiskTitle({ risk }: { risk: RiskItem }) {
  return (
    <div className="min-w-0 text-sm">
      <p className="font-medium flex items-center gap-1.5">
        {risk.has_incidents && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-label="Has incidents" />}
        <span className="truncate">{risk.asset.name}</span>
      </p>
      <p className="text-muted-foreground">{risk.vulnerability.name} → {risk.threat.name}</p>
    </div>
  );
}

type StageProps = {
  state: RiskRegisterState;
  seed: RiskSeedData;
  onUpdate: (riskId: string, data: RiskUpdate) => Promise<void>;
};

const activeRisks = (state: RiskRegisterState) => state.risks.filter(r => !r.discarding);

// ─── Stage 4: Evaluation ────────────────────────────────────────

export function EvaluationStage({
  state,
  seed,
  onUpdate,
  onRemove,
}: StageProps & { onRemove: (riskId: string) => Promise<void> }) {
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const canEdit = state.permissions.canEdit;
  const risks = activeRisks(state).filter(r => !onlyEmpty || !r.is_evaluated);
  const labels = seed.scale.labels;

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk evaluation</CardTitle>
        <CardDescription className="leading-relaxed max-w-3xl">
          What you see on the screen are risks that consist of assets, vulnerabilities and threats you have identified on the previous screens.
          Enter the <strong>impact</strong>, <strong>likelihood</strong> and <strong>risk owner</strong> (mandatory), and optionally the department, asset owner, existing controls and a comment.
          For a detailed explanation of each field, hover over the <Info className="inline h-3.5 w-3.5" /> icon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusLegend />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />
            Show only empty risks ({state.summary.total - state.summary.evaluated})
          </label>
        </div>

        {risks.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {onlyEmpty ? 'All risks are evaluated.' : 'No risks yet — select threats for your vulnerabilities first.'}
          </p>
        )}

        <div className="space-y-2">
          {risks.map((r) => {
            const open = expanded.has(r.id);
            return (
              <div key={r.id} className={`rounded-lg border border-border/60 border-l-4 ${statusBorder[r.status]}`}>
                <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto_minmax(0,1.3fr)_auto] lg:items-end">
                  <RiskTitle risk={r} />
                  <div>
                    <Label className="flex items-center gap-1 text-xs">Impact *<InfoTip text={HELP.impact} /></Label>
                    <ScaleSelect ariaLabel="Impact" value={r.impact} labels={labels} disabled={!canEdit}
                      onChange={(v) => v != null && onUpdate(r.id, { impact: v })} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-xs">Likelihood *<InfoTip text={HELP.likelihood} /></Label>
                    <ScaleSelect ariaLabel="Likelihood" value={r.likelihood} labels={labels} disabled={!canEdit}
                      onChange={(v) => v != null && onUpdate(r.id, { likelihood: v })} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-xs">Level<InfoTip text={HELP.level} /></Label>
                    <Badge className={`${levelColor(r.level, seed.scale.maxAcceptableLevel)} h-9 min-w-10 justify-center`}>{r.level ?? '—'}</Badge>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-xs">Risk owner *<InfoTip text={HELP.owner} /></Label>
                    <NativeSelect aria-label="Risk owner" value={r.risk_owner_id ?? ''} disabled={!canEdit}
                      onChange={(e) => onUpdate(r.id, { risk_owner_id: e.target.value || null })}>
                      <option value="">Not assigned</option>
                      {state.projectUsers.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                    </NativeSelect>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggle(r.id)} aria-expanded={open} className="justify-self-start">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="ml-1">Details</span>
                  </Button>
                </div>

                {open && (
                  <div className="border-t border-border/60 p-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="flex items-center gap-1 text-xs">Department<InfoTip text={HELP.department} /></Label>
                      <BlurField value={r.department} disabled={!canEdit} placeholder="e.g. IT"
                        onSave={(v) => onUpdate(r.id, { department: v })} />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1 text-xs">Asset owner<InfoTip text={HELP.assetOwner} /></Label>
                      <NativeSelect aria-label="Asset owner" value={r.asset_owner_id ?? ''} disabled={!canEdit}
                        onChange={(e) => onUpdate(r.id, { asset_owner_id: e.target.value || null })}>
                        <option value="">Not assigned</option>
                        {state.projectUsers.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                      </NativeSelect>
                    </div>
                    <div>
                      <Label className="flex items-center gap-1 text-xs">Existing controls<InfoTip text={HELP.existingControls} /></Label>
                      <BlurField multiline value={r.existing_controls} disabled={!canEdit}
                        placeholder="Controls already in place" onSave={(v) => onUpdate(r.id, { existing_controls: v })} />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1 text-xs">Comment<InfoTip text={HELP.comment} /></Label>
                      <BlurField multiline value={r.comment} disabled={!canEdit}
                        onSave={(v) => onUpdate(r.id, { comment: v })} />
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={r.has_incidents} disabled={!canEdit}
                          onChange={(e) => onUpdate(r.id, { has_incidents: e.target.checked })} />
                        Risk has incidents / nonconformities
                      </label>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="text-destructive"
                          onClick={() => {
                            if (window.confirm('Remove this risk permanently? This cannot be undone.')) onRemove(r.id);
                          }}>
                          <Trash2 className="h-4 w-4 mr-1" />Remove risk permanently
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stage 5: Review ────────────────────────────────────────────

export function ReviewStage({
  state,
  seed,
  onReview,
}: Omit<StageProps, 'onUpdate'> & { onReview: (ids: string[], reviewed: boolean) => Promise<void> }) {
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const canEdit = state.permissions.canEdit;
  const risks = activeRisks(state).filter(r => !onlyUnreviewed || !r.is_reviewed);
  const selectable = risks.filter(r => r.is_evaluated);
  const allSelected = selectable.length > 0 && selectable.every(r => selected.has(r.id));

  const run = async (reviewed: boolean) => {
    setBusy(true);
    try { await onReview([...selected], reviewed); setSelected(new Set()); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk review</CardTitle>
        <CardDescription className="leading-relaxed max-w-3xl">
          This is where you take a look at all the risks you have and decide if they make sense.
          Select the risks you think are assessed properly (all of them, or only some of them), then click <strong>Mark risks as reviewed</strong>.
          Only evaluated risks can be reviewed; changing a risk&apos;s impact or likelihood later clears its review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {canEdit && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allSelected} disabled={selectable.length === 0}
                  onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map(r => r.id)) : new Set())} />
                Select all
              </label>
              <Button size="sm" onClick={() => run(true)} disabled={busy || selected.size === 0}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Mark risks as reviewed ({selected.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(false)} disabled={busy || selected.size === 0}>
                Unmark
              </Button>
            </>
          )}
          <label className="flex items-center gap-2 text-sm ml-auto">
            <input type="checkbox" checked={onlyUnreviewed} onChange={(e) => setOnlyUnreviewed(e.target.checked)} />
            Show only unreviewed risks ({state.summary.total - state.summary.reviewed})
          </label>
        </div>
        <StatusLegend />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                {canEdit && <th className="py-2 px-2 w-8"><span className="sr-only">Select</span></th>}
                <th className="py-2 px-2 font-medium">Asset</th>
                <th className="py-2 px-2 font-medium">Vulnerability</th>
                <th className="py-2 px-2 font-medium">Threat</th>
                <th className="py-2 px-2 font-medium">Impact</th>
                <th className="py-2 px-2 font-medium">Likelihood</th>
                <th className="py-2 px-2 font-medium">Level</th>
                <th className="py-2 px-2 font-medium">Risk owner</th>
                <th className="py-2 px-2 font-medium">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {risks.map(r => (
                <tr key={r.id} className={`border-b border-border/40 border-l-4 ${statusBorder[r.status]}`}>
                  {canEdit && (
                    <td className="py-2 px-2">
                      <input type="checkbox" aria-label="Select risk" disabled={!r.is_evaluated}
                        title={r.is_evaluated ? undefined : 'Evaluate this risk first'}
                        checked={selected.has(r.id)}
                        onChange={() => setSelected(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
                    </td>
                  )}
                  <td className="py-2 px-2">{r.asset.name}</td>
                  <td className="py-2 px-2">{r.vulnerability.name}</td>
                  <td className="py-2 px-2">{r.threat.name}</td>
                  <td className="py-2 px-2">{r.impact != null ? seed.scale.labels[r.impact] : '—'}</td>
                  <td className="py-2 px-2">{r.likelihood != null ? seed.scale.labels[r.likelihood] : '—'}</td>
                  <td className="py-2 px-2"><Badge className={levelColor(r.level, seed.scale.maxAcceptableLevel)}>{r.level ?? '—'}</Badge></td>
                  <td className="py-2 px-2">{r.risk_owner ? `${r.risk_owner.first_name} ${r.risk_owner.last_name}` : <span className="text-destructive">Missing</span>}</td>
                  <td className="py-2 px-2">{r.is_reviewed ? <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Reviewed" /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stage 6: Treatment ─────────────────────────────────────────

export function TreatmentStage({
  state,
  seed,
  onUpdate,
  onConfirm,
}: StageProps & { onConfirm: (riskId: string) => Promise<void> }) {
  const all = activeRisks(state);
  const unacceptable = all.filter(r => r.acceptability === 'NOT_ACCEPTABLE');
  const acceptableCount = all.filter(r => r.acceptability === 'ACCEPTABLE').length;
  const notEvaluated = all.filter(r => r.level == null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk treatment</CardTitle>
        <CardDescription className="leading-relaxed max-w-3xl">
          Define how you intend to treat the risks that are not acceptable (levels {seed.scale.maxAcceptableLevel + 1} or 4).
          &quot;Decrease the risk using safeguards&quot; is selected by default (the most common option) — select the Annex A controls.
          For &quot;Transfer&quot; or &quot;Avoid&quot;, describe how and set the residual risk. For &quot;Accept&quot;, justify why treating it would cost more than the damage.
          Click <strong>Confirm treatment for this risk</strong> for each risk; once all are confirmed you can click Next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{unacceptable.length} unacceptable risk(s) to treat</Badge>
          <Badge variant="outline">{state.summary.treated} confirmed</Badge>
          <Badge variant="outline">{acceptableCount} acceptable — no treatment needed</Badge>
          {notEvaluated > 0 && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              {notEvaluated} not evaluated yet
            </Badge>
          )}
        </div>
        {unacceptable.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            There are no unacceptable risks, so no treatment is required.
          </p>
        )}
        {unacceptable.map(r => (
          <TreatmentCard key={r.id} risk={r} state={state} seed={seed} onUpdate={onUpdate} onConfirm={onConfirm} />
        ))}
      </CardContent>
    </Card>
  );
}

function TreatmentCard({
  risk,
  state,
  seed,
  onUpdate,
  onConfirm,
}: StageProps & { risk: RiskItem; onConfirm: (riskId: string) => Promise<void> }) {
  const [open, setOpen] = useState(!risk.treatment_confirmed);
  const [controlSearch, setControlSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const canEdit = state.permissions.canEdit;
  const option: TreatmentOption = risk.treatment_option ?? 'DECREASE';
  const selectedCodes = useMemo(() => new Set(risk.treatment_controls_link.map(l => l.control.code)), [risk]);

  // Controls suggested for this risk's vulnerability and threat: from the
  // catalogue, or chosen when a custom vulnerability/threat was created.
  const suggested = useMemo(() => {
    const vuln = state.vulnerabilities.find(x => x.id === risk.vulnerability_id);
    const threat = state.threats.find(x => x.id === risk.threat_id);
    return new Set([
      ...(vuln?.applicable_controls ?? []),
      ...(threat?.applicable_controls ?? []),
      ...(seed.suggestions.controlsByVulnerability[risk.vulnerability.name] ?? []),
      ...(seed.suggestions.controlsByThreat[risk.threat.name] ?? []),
    ]);
  }, [state, seed, risk]);

  const filteredControls = seed.controls.filter(c => {
    const q = controlSearch.trim().toLowerCase();
    return !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
  });
  const sortedControls = [...filteredControls].sort((a, b) => Number(suggested.has(b.code)) - Number(suggested.has(a.code)));

  const toggleControl = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) next.delete(code); else next.add(code);
    onUpdate(risk.id, { treatment_controls: [...next] });
  };

  const residualLevel =
    risk.residual_impact != null && risk.residual_likelihood != null ? risk.residual_impact + risk.residual_likelihood : null;

  return (
    <div className={`rounded-lg border border-border/60 border-l-4 ${statusBorder[risk.status]}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/30">
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <RiskTitle risk={risk} />
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <Badge className={levelColor(risk.level, seed.scale.maxAcceptableLevel)}>Level {risk.level}</Badge>
          {risk.treatment_confirmed
            ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><Check className="h-3 w-3 mr-1" />Confirmed</Badge>
            : <Badge variant="outline">To treat</Badge>}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/60 p-3 space-y-4">
          <fieldset>
            <legend className="flex items-center gap-1 text-xs font-medium mb-2">Treatment option<InfoTip text={HELP.treatmentOption} /></legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(TREATMENT_LABELS) as TreatmentOption[]).map(o => (
                <label key={o} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${option === o ? 'border-[var(--brand-orange)] bg-[var(--brand-orange)]/5' : 'border-border'}`}>
                  <input type="radio" name={`opt-${risk.id}`} checked={option === o} disabled={!canEdit}
                    onChange={() => onUpdate(risk.id, { treatment_option: o })} />
                  {TREATMENT_LABELS[o]}
                </label>
              ))}
            </div>
          </fieldset>

          {option === 'DECREASE' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs">
                Annex A controls (safeguards) — {selectedCodes.size} selected<InfoTip text={HELP.controls} />
              </Label>
              {selectedCodes.size > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {risk.treatment_controls_link.map(l => (
                    <Badge key={l.control.code} variant="outline" className="gap-1">
                      {l.control.code} {l.control.title}
                      {canEdit && (
                        <button type="button" aria-label={`Remove ${l.control.code}`} onClick={() => toggleControl(l.control.code)}>
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              )}
              {canEdit && (
                <>
                  <Input placeholder="Search controls by code or name (e.g. A.8.7 or malware)" value={controlSearch}
                    onChange={(e) => setControlSearch(e.target.value)} />
                  <div className="grid gap-1.5 sm:grid-cols-2 max-h-56 overflow-y-auto rounded-md border p-2">
                    {sortedControls.map(c => {
                      const active = selectedCodes.has(c.code);
                      return (
                        <button key={c.code} type="button" onClick={() => toggleControl(c.code)}
                          className={`flex items-start gap-2 rounded px-2 py-1.5 text-left text-xs ${active ? 'bg-[var(--brand-orange)]/10' : 'hover:bg-accent'}`}>
                          {active ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-orange)]" /> : <span className="h-3.5 w-3.5 shrink-0" />}
                          <span><span className="font-medium">{c.code}</span> {c.title}</span>
                          {suggested.has(c.code) && <Badge className="ml-auto shrink-0 text-[10px] bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]">Suggested</Badge>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {option !== 'DECREASE' && (
            <div>
              <Label className="text-xs">
                {option === 'ACCEPT'
                  ? 'Justification for accepting the risk *'
                  : option === 'TRANSFER' ? 'How is the risk transferred? *' : 'How is the risk avoided? *'}
              </Label>
              <BlurField multiline value={risk.treatment_description} disabled={!canEdit}
                placeholder={option === 'ACCEPT'
                  ? 'e.g. The cost of treatment exceeds the potential impact because…'
                  : option === 'TRANSFER' ? 'e.g. Insurance policy covering fire damage' : 'e.g. Personal devices are prohibited'}
                onSave={(v) => onUpdate(risk.id, { treatment_description: v })} />
            </div>
          )}
          {option === 'DECREASE' && (
            <div>
              <Label className="text-xs">Treatment notes (optional)</Label>
              <BlurField multiline value={risk.treatment_description} disabled={!canEdit}
                placeholder="How the controls will be applied to this risk"
                onSave={(v) => onUpdate(risk.id, { treatment_description: v })} />
            </div>
          )}

          {option !== 'ACCEPT' ? (
            <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
              <div>
                <Label className="flex items-center gap-1 text-xs">Residual impact *<InfoTip text={HELP.residual} /></Label>
                <ScaleSelect ariaLabel="Residual impact" value={risk.residual_impact} labels={seed.scale.labels} disabled={!canEdit}
                  onChange={(v) => onUpdate(risk.id, { residual_impact: v })} />
              </div>
              <div>
                <Label className="text-xs">Residual likelihood *</Label>
                <ScaleSelect ariaLabel="Residual likelihood" value={risk.residual_likelihood} labels={seed.scale.labels} disabled={!canEdit}
                  onChange={(v) => onUpdate(risk.id, { residual_likelihood: v })} />
              </div>
              <div>
                <Label className="text-xs">Residual level</Label>
                <div><Badge className={`${levelColor(residualLevel, seed.scale.maxAcceptableLevel)} h-9 min-w-10 justify-center`}>{residualLevel ?? '—'}</Badge></div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">The residual risk equals the current risk level ({risk.level}).</p>
          )}
          {residualLevel != null && residualLevel > seed.scale.maxAcceptableLevel && option !== 'ACCEPT' && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />The residual risk is still unacceptable. Consider more controls, or the risk owner will have to accept it.
            </p>
          )}

          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" disabled={confirming || risk.treatment_confirmed}
                onClick={async () => { setConfirming(true); try { await onConfirm(risk.id); } finally { setConfirming(false); } }}>
                {confirming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                {risk.treatment_confirmed ? 'Treatment confirmed' : 'Confirm treatment for this risk'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stage 7: Approval ──────────────────────────────────────────

export function ApprovalStage({
  state,
  seed,
  onDecide,
  documents,
  onCreateDocs,
  isCreatingDocs,
  documentHref,
}: Omit<StageProps, 'onUpdate'> & {
  onDecide: (riskId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) => Promise<void>;
  documents: { id: string; title: string }[];
  onCreateDocs: () => Promise<void>;
  isCreatingDocs: boolean;
  documentHref: (id: string) => string;
}) {
  const { permissions } = state;
  const [onlyMine, setOnlyMine] = useState(!permissions.canApproveAny);
  const risks = activeRisks(state).filter(r => !onlyMine || r.risk_owner_id === permissions.userId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk approval</CardTitle>
          <CardDescription className="leading-relaxed max-w-3xl">
            For the risks where you are the risk owner, decide whether the residual risk (the risk that remains after the treatment is applied) is acceptable.
            <strong> Approve residual risk</strong> means you agree with the treatment of that risk. <strong>Reject residual risk</strong> sends it back to the person in charge of risk management to improve the treatment.
            {permissions.canApproveAny && ' As project lead you can also decide on behalf of a risk owner; your name is recorded as the decision maker.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusLegend />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
              Show only risks where I am the risk owner
            </label>
          </div>
          {risks.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {onlyMine ? 'You are not the risk owner of any risk.' : 'No risks yet.'}
            </p>
          )}
          {risks.map(r => <ApprovalRow key={r.id} risk={r} state={state} seed={seed} onDecide={onDecide} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Risk Assessment and Treatment Report</CardTitle>
          <CardDescription>
            The report records the results of the risk assessment and treatment (clauses 8.2 and 8.3) and the risk owners&apos; acceptance of residual risks (clause 6.1.3 f).
            Generate it again after changes to refresh it; open items are listed in the report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {permissions.canEdit && (
            <Button onClick={onCreateDocs} disabled={isCreatingDocs}>
              {isCreatingDocs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FilePlus className="h-4 w-4 mr-2" />}
              {documents.length > 0 ? 'Refresh report' : 'Generate report'}
            </Button>
          )}
          {documents.map(d => (
            <a key={d.id} href={documentHref(d.id)} className="flex items-center gap-2 text-sm text-[var(--brand-orange)] hover:underline">
              <Printer className="h-4 w-4" />{d.title}
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalRow({
  risk,
  state,
  seed,
  onDecide,
}: Omit<StageProps, 'onUpdate'> & {
  risk: RiskItem;
  onDecide: (riskId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) => Promise<void>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { permissions } = state;
  const isOwner = risk.risk_owner_id === permissions.userId;
  const mayDecide = permissions.canEdit && (isOwner || permissions.canApproveAny);
  const needsTreatment = risk.acceptability === 'NOT_ACCEPTABLE';
  const blocker = !risk.is_evaluated
    ? 'Evaluate the risk and assign a risk owner first'
    : needsTreatment && !risk.treatment_confirmed
      ? 'Confirm the treatment first'
      : null;
  const residual = risk.residual_risk ?? risk.level;

  const decide = async (decision: 'APPROVED' | 'REJECTED', comment?: string) => {
    setBusy(true);
    try { await onDecide(risk.id, decision, comment); setRejecting(false); setReason(''); } finally { setBusy(false); }
  };

  const badge =
    risk.approval_decision === 'APPROVED'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : risk.approval_decision === 'REJECTED'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';

  return (
    <div className={`rounded-lg border border-border/60 border-l-4 ${statusBorder[risk.status]} p-3 space-y-2`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RiskTitle risk={risk} />
        <Badge className={badge}>
          {risk.approval_decision === 'APPROVED' ? 'Approved' : risk.approval_decision === 'REJECTED' ? 'Rejected' : 'Pending'}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>Risk owner: {risk.risk_owner ? `${risk.risk_owner.first_name} ${risk.risk_owner.last_name}` : '—'}</span>
        <span>Level: <Badge className={levelColor(risk.level, seed.scale.maxAcceptableLevel)}>{risk.level ?? '—'}</Badge></span>
        <span>Treatment: {needsTreatment ? (risk.treatment_option ? TREATMENT_LABELS[risk.treatment_option] : '—') : 'Not required (acceptable)'}</span>
        {needsTreatment && risk.treatment_controls_link.length > 0 && (
          <span>Controls: {risk.treatment_controls_link.map(l => l.control.code).join(', ')}</span>
        )}
        <span>Residual level: <Badge className={levelColor(residual, seed.scale.maxAcceptableLevel)}>{residual ?? '—'}</Badge></span>
      </div>
      {risk.approval_decision !== 'PENDING' && risk.approval_user && (
        <p className="text-xs text-muted-foreground">
          {risk.approval_decision === 'APPROVED' ? 'Approved' : 'Rejected'} by {risk.approval_user.first_name} {risk.approval_user.last_name}
          {risk.approval_at && ` on ${new Date(risk.approval_at).toLocaleDateString()}`}
          {risk.approval_comment && ` — “${risk.approval_comment}”`}
        </p>
      )}

      {mayDecide && (
        blocker ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">{blocker}.</p>
        ) : rejecting ? (
          <div className="space-y-2">
            <Label className="text-xs" htmlFor={`reason-${risk.id}`}>Why is the residual risk rejected? *</Label>
            <Textarea id={`reason-${risk.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="What should be improved in the treatment" />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => decide('REJECTED', reason)}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send back
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={busy || risk.approval_decision === 'APPROVED'} onClick={() => decide('APPROVED')}>
              <Check className="h-4 w-4 mr-1" />Approve residual risk{!isOwner && ' (on behalf of owner)'}
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => setRejecting(true)}>
              <X className="h-4 w-4 mr-1" />Reject residual risk
            </Button>
          </div>
        )
      )}
    </div>
  );
}
