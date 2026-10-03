'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, CheckCircle2, FileText, Loader2, Download, Send, History, Undo2, XCircle } from 'lucide-react';
import {
  DocumentInstance,
  ProseMirrorNode,
  documentsApi,
} from '@/lib/api';
import DocumentEditor from '@/components/editor/document-editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth-store';
import { useProjectStore } from '@/store/project-store';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { DOC_STATUS } from '@/lib/documents';
import { fullName } from '@/lib/tasks';
import { Textarea } from '@/components/ui/textarea';

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  const documentId = params.documentId as string;

  const [doc, setDoc] = useState<DocumentInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [versionNotes, setVersionNotes] = useState('');
  const [changes, setChanges] = useState('');
  const [deciding, setDeciding] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { currentProject, selectProject } = useProjectStore();
  useEffect(() => { if (currentProject?.id !== projectId) void selectProject(projectId); }, [currentProject?.id, projectId, selectProject]);
  const myPrivilege = currentProject?.members?.find((m) => m.user_id === currentUserId)?.privilege;
  const canEdit = myPrivilege === 'PROJECT_LEAD' || myPrivilege === 'PROJECT_MEMBER';

  // Latest content kept in a ref so autosave always sees current JSON
  const contentRef = useRef<ProseMirrorNode | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const instance = await documentsApi.getOne(documentId);
        if (cancelled) return;
        setDoc(instance);
        contentRef.current = instance.content;
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const save = useCallback(async () => {
    if (!contentRef.current || isSaving) return;
    setIsSaving(true);
    try {
      const updated = await documentsApi.updateContent(documentId, contentRef.current);
      setDoc((prev) => (prev ? { ...prev, status: updated.status } : prev));
      setDirty(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save document'));
    } finally {
      setIsSaving(false);
    }
  }, [documentId, isSaving]);

  const handleChange = useCallback(
    (content: ProseMirrorNode) => {
      contentRef.current = content;
      setDirty(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void save(), 2000);
    },
    [save],
  );

  // Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, save]);

  const handleExportDocx = useCallback(async () => {
    try {
      const content = contentRef.current ?? undefined;
      await documentsApi.exportDocx(documentId, content);
      toast.success('Document exported as .docx');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to export document'));
    }
  }, [documentId]);

  const reload = useCallback(async () => setDoc(await documentsApi.getOne(documentId)), [documentId]);

  const handlePublish = useCallback(async () => {
    if (dirty) await save();
    setIsPublishing(true);
    try {
      const result = await documentsApi.publish(documentId, versionNotes || undefined);
      await reload();
      setVersionNotes('');
      toast.success(result.status === 'IN_REVIEW' ? 'Sent to the approver' : `Version ${result.version} added to the library`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to submit the document to the library'));
    } finally {
      setIsPublishing(false);
    }
  }, [documentId, dirty, save, versionNotes, reload]);

  /** Approver decisions and withdrawing a request for approval. */
  const decide = useCallback(async (action: () => Promise<unknown>, success: string) => {
    setDeciding(true);
    try {
      await action();
      await reload();
      setChanges('');
      toast.success(success);
    } catch (err) {
      toast.error(getErrorMessage(err, 'The action could not be completed'));
    } finally {
      setDeciding(false);
    }
  }, [reload]);

  const handleDownloadPdf = useCallback(async (version: string) => {
    try {
      await documentsApi.downloadPdf(documentId, version);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download the PDF'));
    }
  }, [documentId]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dirty]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <Card className="border-dashed max-w-xl mx-auto">
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            Document not found or you do not have access to it.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Go back
          </Button>
        </CardContent>
      </Card>
    );
  }

  const versions = doc.versions ?? [];
  const inReview = doc.status === 'IN_REVIEW';
  const isApprover = !!currentUserId && doc.approver?.id === currentUserId;
  const canWithdraw = inReview && (doc.review_requester?.id === currentUserId || myPrivilege === 'PROJECT_LEAD');
  // With an approver other than me, submitting sends the document for approval.
  const needsApproval = !!doc.approver && !isApprover;
  const stepHref = doc.step
    ? `/dashboard/organizations/${orgId}/projects/${projectId}/steps/${doc.step.id}`
    : `/dashboard/organizations/${orgId}/projects/${projectId}/steps`;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link
            href={stepHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to step
          </Link>
          <h1 className="text-xl font-bold tracking-tight mt-1.5 flex items-center gap-2 truncate">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            {doc.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>{versions.length ? `Library version ${versions[0].version}` : 'Draft, not in the library yet'}</span>
            {doc.template && <span>· {doc.template.name}</span>}
            {doc.creator && (
              <span>
                · Created by {doc.creator.first_name} {doc.creator.last_name}
              </span>
            )}
            {doc.last_editor && (
              <span>
                · Last edited by {doc.last_editor.first_name} {doc.last_editor.last_name}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 pt-6">
          <Badge className={DOC_STATUS[doc.status].className}>{DOC_STATUS[doc.status].label}</Badge>
          <Button size="sm" variant="outline" onClick={handleExportDocx}>
            <Download className="h-4 w-4 mr-1.5" />
            Download .docx
          </Button>
          {canEdit && !inReview && (
          <Button size="sm" variant={dirty ? 'default' : 'outline'} onClick={() => void save()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : dirty ? (
              <FileText className="h-4 w-4 mr-1.5" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
            )}
            {dirty ? 'Save' : 'Saved'}
          </Button>
          )}
        </div>
      </div>

      {/* Live document control data, printed on the first page of every export */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Document control</span>
            <Link href={stepHref} className="text-xs text-primary hover:underline">Change on the step page</Link>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Code</dt><dd>{doc.code || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Version</dt><dd>{versions[0]?.version ?? 'Draft'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Owner</dt><dd>{fullName(doc.owner) || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Approver</dt><dd>{fullName(doc.approver) || 'Whoever submits'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Confidentiality</dt><dd>{doc.confidentiality ?? 'Internal'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Review</dt><dd>{doc.update_interval ? `Every ${doc.update_interval} months` : '—'}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">
            These values and the change history are added automatically to the first page of the PDF and Word files; they are not part of the text below.
          </p>
        </CardContent>
      </Card>

      {/* Library: every submission is kept as a version (clause 7.5.3) */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" />Document library</div>
          {inReview && (
            <div className="space-y-3 rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-sm">
                Sent for approval by {fullName(doc.review_requester)} to <strong>{fullName(doc.approver)}</strong>.
                {doc.review_notes && <> What changed: {doc.review_notes}</>} The document cannot be edited until it is approved or withdrawn.
              </p>
              {isApprover && (
                <div className="space-y-2">
                  <Textarea rows={2} maxLength={2000} value={changes} onChange={(e) => setChanges(e.target.value)}
                    placeholder="What must change? (required to request changes)" />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={deciding || !changes.trim()}
                      onClick={() => decide(() => documentsApi.requestChanges(documentId, changes.trim()), 'Sent back with your changes')}>
                      <XCircle className="h-4 w-4 mr-1.5" />Request changes
                    </Button>
                    <Button size="sm" disabled={deciding} onClick={() => decide(() => documentsApi.approve(documentId), 'Approved and added to the library')}>
                      {deciding ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}Approve and publish
                    </Button>
                  </div>
                </div>
              )}
              {canWithdraw && !isApprover && (
                <Button size="sm" variant="outline" disabled={deciding} onClick={() => decide(() => documentsApi.withdraw(documentId), 'Withdrawn: you can edit the document again')}>
                  <Undo2 className="h-4 w-4 mr-1.5" />Withdraw to edit
                </Button>
              )}
            </div>
          )}
          {canEdit && doc.status === 'DRAFT' && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 flex-1 min-w-[220px]"
                maxLength={500}
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                placeholder={versions.length ? 'What changed in this version? (optional)' : 'Note for the first version (optional)'}
              />
              <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
                {isPublishing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                {needsApproval ? 'Send for approval' : versions.length ? 'Submit new version' : 'Submit to Library'}
              </Button>
              {needsApproval && (
                <p className="w-full text-xs text-muted-foreground">{fullName(doc.approver)} is the approver of this document: it reaches the library once approved (clause 7.5.2).</p>
              )}
            </div>
          )}
          {versions.length > 0 && doc.status === 'DRAFT' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">This draft has changes that are not in the library yet. The library still shows version {versions[0].version}.</p>
          )}
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Not in the library yet. Submitting creates version 1.0 as a PDF; earlier versions are always kept.</p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {versions.map((v) => (
                <li key={v.version} className="flex items-center gap-3 py-2">
                  <Badge variant="outline">v{v.version}</Badge>
                  <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
                    {new Date(v.published_at).toLocaleDateString('en-GB')}
                    {v.approver && ` · approved by ${fullName(v.approver)}`}
                    {v.notes && ` · ${v.notes}`}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => handleDownloadPdf(v.version)}>
                    <Download className="h-4 w-4 mr-1" />PDF
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <DocumentEditor initialContent={doc.content} editable={canEdit && !inReview} onChange={handleChange} onExportDocx={handleExportDocx} />

      {canEdit && !inReview && (
        <p className="text-xs text-muted-foreground text-center">
          Changes are saved automatically a moment after you stop typing — or press Ctrl+S to save
          immediately.
        </p>
      )}
    </div>
  );
}
