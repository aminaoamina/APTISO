'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, ExternalLink, Inbox, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { requestsApi, ResourceRequest } from '@/lib/api';
import { REQUEST_KIND_LABELS, REQUEST_STATUS } from '@/lib/requests';
import { formatDay, fullName } from '@/lib/tasks';
import { getErrorMessage } from '@/lib/utils';
import { useInboxStore } from '@/store/inbox-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

type Filter = 'waiting' | 'decided' | 'all';

/**
 * Requests for extra resources sent from the steps (clause 7.1). Top
 * management approves or rejects them; everyone else in the project can read them.
 */
export default function RequestsPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const [requests, setRequests] = useState<ResourceRequest[] | null>(null);
  const [canDecide, setCanDecide] = useState(false);
  const [filter, setFilter] = useState<Filter>('waiting');

  const load = useCallback(async () => {
    try {
      const { items, can_decide } = await requestsApi.list(projectId);
      setRequests(items);
      setCanDecide(can_decide);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the requests'));
      setRequests([]);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  if (!requests) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;

  const waiting = requests.filter((r) => r.status === 'PENDING');
  const decided = requests.filter((r) => r.status !== 'PENDING');
  const shown = filter === 'waiting' ? waiting : filter === 'decided' ? decided : requests;
  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'waiting', label: 'Waiting', count: waiting.length },
    { key: 'decided', label: 'Decided', count: decided.length },
    { key: 'all', label: 'All', count: requests.length },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <Inbox className="h-6 w-6 text-primary" />
          Requests
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Extra resources asked for the implementation steps: technology, people or budget (ISO 27001 clause 7.1).
          {canDecide
            ? ' As top management, approve or reject each request; the requester is notified of your decision.'
            : ' Top management decides on them; decisions are kept here as a record.'}
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${filter === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label} <span className="ml-1 text-xs text-muted-foreground">{t.count}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {filter === 'waiting' ? 'No request is waiting for a decision.' : 'No requests yet. They are sent from the "Additional requests" section of a step.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <RequestCard key={r.id} request={r} orgId={orgId} canDecide={canDecide} onDecided={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ request: r, orgId, canDecide, onDecided }: {
  request: ResourceRequest;
  orgId: string;
  canDecide: boolean;
  onDecided: () => Promise<void>;
}) {
  const refreshInbox = useInboxStore((s) => s.refresh);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    if (decision === 'REJECTED' && !comment.trim()) {
      toast.error('Give the reason for the rejection in the comment');
      return;
    }
    setBusy(decision);
    try {
      await requestsApi.decide(r.id, { decision, comment: comment.trim() || undefined });
      toast.success(decision === 'APPROVED' ? 'Request approved' : 'Request rejected');
      await Promise.all([onDecided(), refreshInbox()]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'The decision could not be saved'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{REQUEST_KIND_LABELS[r.kind]}</Badge>
              <Badge className={REQUEST_STATUS[r.status].className}>{REQUEST_STATUS[r.status].label}</Badge>
            </div>
            <p className="text-sm font-semibold">{r.step.title}</p>
            <p className="text-xs text-muted-foreground">
              {r.step.phase.name} · requested by {fullName(r.requester)} on {formatDay(r.created_at)}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/dashboard/organizations/${orgId}/projects/${r.project_id}/steps/${r.step_id}`}>
              <ExternalLink className="h-4 w-4 mr-1.5" />Open step
            </Link>
          </Button>
        </div>

        <p className="whitespace-pre-line text-sm">{r.description}</p>

        {r.status !== 'PENDING' && r.decider && r.decided_at && (
          <p className="text-sm text-muted-foreground">
            {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {fullName(r.decider)} on {formatDay(r.decided_at)}
            {r.decision_comment && <>: <span className="text-foreground">{r.decision_comment}</span></>}
          </p>
        )}

        {r.status === 'PENDING' && canDecide && (
          <div className="space-y-2 rounded-lg border p-3">
            <Textarea
              rows={2}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment for the requester (required to reject)"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="text-destructive" disabled={!!busy} onClick={() => decide('REJECTED')}>
                {busy === 'REJECTED' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <XCircle className="h-4 w-4 mr-1.5" />}Reject
              </Button>
              <Button size="sm" disabled={!!busy} onClick={() => decide('APPROVED')}>
                {busy === 'APPROVED' ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}Approve
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
