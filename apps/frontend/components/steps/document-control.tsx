'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { documentsApi, ProjectMember, ProjectStep } from '@/lib/api';
import { fullName } from '@/lib/tasks';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';

type StepDocument = NonNullable<ProjectStep['document_instance']>;

const CONFIDENTIALITY = ['Public', 'Internal', 'Restricted', 'Confidential'];

const INTERVALS = [
  { months: 6, label: 'Every 6 months' },
  { months: 12, label: 'Every year' },
  { months: 24, label: 'Every 2 years' },
];

/**
 * Document control (clause 7.5): who owns the document and reviews it at its
 * interval, and who approves it before it reaches the library.
 */
export function DocumentControl({ doc, members, canEdit, onSaved }: {
  doc: StepDocument;
  members: ProjectMember[];
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const [owner, setOwner] = useState(doc.owner?.id ?? '');
  const [approver, setApprover] = useState(doc.approver?.id ?? '');
  const [interval, setInterval] = useState(String(doc.update_interval ?? ''));
  const [code, setCode] = useState(doc.code ?? '');
  const [confidentiality, setConfidentiality] = useState(doc.confidentiality ?? 'Internal');
  const [saving, setSaving] = useState(false);
  const changed = owner !== (doc.owner?.id ?? '') || approver !== (doc.approver?.id ?? '') || interval !== String(doc.update_interval ?? '')
    || code !== (doc.code ?? '') || confidentiality !== (doc.confidentiality ?? 'Internal');

  const save = async () => {
    setSaving(true);
    try {
      await documentsApi.updateAssignments(doc.id, {
        ...(owner && { owner_id: owner }),
        approver_id: approver || null,
        ...(interval && { update_interval: Number(interval) }),
        code,
        confidentiality,
      });
      toast.success('Document control saved');
      await onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Code</dt><dd>{doc.code || '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Confidentiality</dt><dd>{doc.confidentiality ?? 'Internal'}</dd></div>
        <div />
        <div><dt className="text-xs text-muted-foreground">Owner</dt><dd>{fullName(doc.owner) || '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Approver</dt><dd>{fullName(doc.approver) || '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Review</dt><dd>{doc.update_interval ? `Every ${doc.update_interval} months` : '—'}</dd></div>
      </dl>
    );
  }

  const people = members.map((m) => <option key={m.user_id} value={m.user_id}>{fullName(m.user)}</option>);
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          Document code
          <Input className="mt-1" maxLength={50} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ISMS-POL-01" />
        </label>
        <label className="text-xs text-muted-foreground">
          Confidentiality level
          <NativeSelect className="mt-1" value={confidentiality} onChange={(e) => setConfidentiality(e.target.value)}>
            {[...new Set([...CONFIDENTIALITY, confidentiality])].map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </label>
        <div />
        <label className="text-xs text-muted-foreground">
          Owner (keeps it up to date)
          <NativeSelect className="mt-1" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Select…</option>
            {people}
          </NativeSelect>
        </label>
        <label className="text-xs text-muted-foreground">
          Approver (before the library)
          <NativeSelect className="mt-1" value={approver} onChange={(e) => setApprover(e.target.value)}>
            <option value="">Nobody: whoever submits approves</option>
            {people}
          </NativeSelect>
        </label>
        <label className="text-xs text-muted-foreground">
          Review interval
          <NativeSelect className="mt-1" value={interval} onChange={(e) => setInterval(e.target.value)}>
            <option value="">Select…</option>
            {INTERVALS.map((i) => <option key={i.months} value={i.months}>{i.label}</option>)}
          </NativeSelect>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Printed on the first page of every PDF and Word export, with the change history. The owner gets a review task at each interval in Phase 5.</p>
        <Button size="sm" variant="outline" disabled={!changed || saving} onClick={save}>
          {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save
        </Button>
      </div>
    </div>
  );
}
