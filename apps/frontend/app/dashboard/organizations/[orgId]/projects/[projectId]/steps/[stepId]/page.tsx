'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, CheckCircle2, Clock, FileText, Gavel,
  Loader2, Scale, UserPlus, Users, X, Calendar, CalendarCheck,
  ChevronDown, ChevronRight, SkipForward, Trash2,
} from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { EducationalStepBody } from '@/lib/steps-content';
import { projectsApi, documentsApi, TaskAssignment } from '@/lib/api';
import RequirementsStep from '@/components/requirements/requirements-step';
import RiskRegisterStep from '@/components/risk-register/risk-register-step';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

const DOC_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  IN_REVIEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PUBLISHED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  WORK_ON_DOCUMENT: 'Write document', REVIEW_DOCUMENT: 'Review document',
  APPROVE_DOCUMENT: 'Approve document', AWARENESS_TASK: 'Awareness',
  TRAINING_TASK: 'Training', HR_REQUEST: 'HR request',
  FINANCE_REQUEST: 'Finance request', TECHNOLOGY_REQUEST: 'Technology request',
};

const TASK_TYPE_COLORS: Record<string, string> = {
  WORK_ON_DOCUMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  REVIEW_DOCUMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVE_DOCUMENT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  AWARENESS_TASK: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  TRAINING_TASK: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  HR_REQUEST: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  FINANCE_REQUEST: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  TECHNOLOGY_REQUEST: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default function StepDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  const stepId = params.stepId as string;
  const { currentProject, phases, isLoading, selectProject, completeStep } = useProjectStore();

  const [isCompleting, setIsCompleting] = useState(false);
  const [completionData, setCompletionData] = useState<Record<string, unknown>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignType, setAssignType] = useState('WORK_ON_DOCUMENT');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stepTasks, setStepTasks] = useState<TaskAssignment[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  useEffect(() => { if (projectId) selectProject(projectId); }, [projectId, selectProject]);

  const { foundPhase, foundStep } = useMemo(() => {
    if (isLoading || !currentProject) return { foundPhase: null, foundStep: null };
    for (const p of phases) {
      const s = p.steps?.find((st) => st.id === stepId);
      if (s) return { foundPhase: p, foundStep: s };
    }
    return { foundPhase: null, foundStep: null };
  }, [phases, stepId, isLoading, currentProject]);

  useEffect(() => {
    if (foundStep?.completion_data) setCompletionData(foundStep.completion_data as Record<string, unknown>);
  }, [foundStep?.id, foundStep?.completion_data]);

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await projectsApi.getProjectTasks(projectId);
      setStepTasks(tasks.filter((t) => t.step_id === stepId));
    } catch { /* silent */ }
  }, [projectId, stepId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  if (isLoading || !currentProject) {
    return (<div className="flex items-center justify-center py-16"><Spinner className="h-6 w-6" /></div>);
  }

  const phase = foundPhase;
  const step = foundStep;

  if (!step || !phase) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground text-sm">Step not found in this project.</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={'/dashboard/organizations/' + orgId + '/projects/' + projectId + '/steps'}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back to Implementation Steps
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isDone = step.status === 'COMPLETED';
  const meta = step.metadata_json;
  const doc = step.document_instance;
  const members = currentProject.members ?? [];
  const stepsHref = '/dashboard/organizations/' + orgId + '/projects/' + projectId + '/steps';
  const wizardHref = stepsHref + '/' + step.id + '/wizard?key=' + encodeURIComponent(step.key);
  const editorHref = doc ? '/dashboard/organizations/' + orgId + '/projects/' + projectId + '/documents/' + doc.id : null;

  const proceedAnswer = completionData.proceed as boolean | null | undefined;
  const isMandatory = meta?.mandatory ?? false;

  const saveCompletionData = async (updates: Record<string, unknown>, label: string) => {
    const merged = { ...completionData, ...updates };
    setSavingSection(label);
    try {
      const updated = await projectsApi.updateStepCompletionData(projectId, stepId, merged);
      setCompletionData((updated.completion_data as Record<string, unknown>) ?? merged);
      toast.success(label + ' saved');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save ' + label.toLowerCase()));
    } finally { setSavingSection(null); }
  };

  const handleAssign = async () => {
    if (!assignUserId) { toast.error('Please select a team member'); return; }
    setIsAssigning(true);
    try {
      await projectsApi.assignTask(projectId, stepId, {
        assigned_to: assignUserId, type: assignType, notes: assignNotes || undefined,
      });
      toast.success('Task assigned');
      setShowAssignDialog(false); setAssignUserId(''); setAssignNotes('');
      await loadTasks();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to assign task')); }
    finally { setIsAssigning(false); }
  };

  const handleCompleteStep = async () => {
    setIsCompleting(true);
    try { await completeStep(step!.id); toast.success('Step marked as completed'); }
    catch (err) { toast.error(getErrorMessage(err, 'Failed to complete step')); }
    finally { setIsCompleting(false); }
  };

  const handleSkipStep = async () => {
    saveCompletionData({ proceed: false, skipped: true }, 'Skip answer');
    setIsCompleting(true);
    try { await completeStep(step!.id); toast.success('Step skipped'); }
    catch (err) { toast.error(getErrorMessage(err, 'Failed to skip step')); }
    finally { setIsCompleting(false); }
  };

  const handleDeleteDocument = async () => {
    if (!doc) return;
    if (!window.confirm('Are you sure you want to delete this document? You can recreate it from the wizard.')) return;
    setIsDeleting(true);
    try {
      await documentsApi.delete(doc.id);
      toast.success('Document deleted — you can now restart the wizard');
      await selectProject(projectId);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete document'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Count active requests for the badge
  const activeRequests = [
    completionData.needs_awareness,
    completionData.needs_training,
    completionData.needs_technology,
    completionData.needs_hr,
    completionData.needs_finance,
  ].filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href={stepsHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />Back to Implementation Steps
      </Link>

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-orange)]">Phase {phase.order} {phase.name}</p>
        <div className="flex items-start justify-between gap-4 mt-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            {step.type === 'REGISTER' ? <FileText className="h-6 w-6 shrink-0 text-primary" /> : step.type === 'DOCUMENT' ? <FileText className="h-6 w-6 shrink-0 text-primary" /> : <BookOpen className="h-6 w-6 shrink-0 text-primary" />}
            Step {step.order}: {step.title}
          </h1>
          {isDone && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 shrink-0 mt-1.5">Completed</Badge>}
        </div>
        {step.purpose && <p className="text-muted-foreground text-sm mt-2 max-w-2xl">{step.purpose}</p>}
      </div>

      {/* Metadata chips */}
      {meta && (
        <div className="grid gap-3 sm:grid-cols-4">
          {meta.clause && (<div className="rounded-lg border bg-card px-3 py-2.5"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Scale className="h-3.5 w-3.5" /> ISO 27001 ref.</p><p className="text-sm font-medium mt-0.5">{meta.clause}</p></div>)}
          {meta.workload_hours != null && (<div className="rounded-lg border bg-card px-3 py-2.5"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Workload</p><p className="text-sm font-medium mt-0.5">~{meta.workload_hours}h total</p></div>)}
          {meta.estimated_days != null && (<div className="rounded-lg border bg-card px-3 py-2.5"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Duration</p><p className="text-sm font-medium mt-0.5">{meta.estimated_days} day{meta.estimated_days !== 1 ? 's' : ''}</p></div>)}
          <div className="rounded-lg border bg-card px-3 py-2.5"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Gavel className="h-3.5 w-3.5" /> Requirement</p><p className="text-sm font-medium mt-0.5">{isMandatory ? 'Mandatory' : 'Suggested'}</p></div>
        </div>
      )}

      {/* Educational content */}
      {step.type === 'EDUCATIONAL' && (<Card><CardContent className="py-6"><EducationalStepBody stepKey={step.key} /></CardContent></Card>)}

      {/* Register of Requirements — custom table-based step */}
      {step.type === 'REGISTER' && step.key === 'iso27001.p1s5.legal-requirements' && (
        <RequirementsStep stepId={step.id} members={members} orgId={orgId} projectId={projectId} />
      )}

      {/* Risk Register — 7-step wizard */}
      {step.type === 'REGISTER' && step.key === 'iso27001.p2s2.risk-register' && (
        <RiskRegisterStep stepId={step.id} orgId={orgId} projectId={projectId} />
      )}

      {/* Document section — only for DOCUMENT steps */}
      {step.type === 'DOCUMENT' && (<>
        {/* Document info card */}
        <Card>
          <CardHeader>
            <CardDescription className="uppercase text-xs tracking-wide">Document / Register Information</CardDescription>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />{step.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {doc ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground w-28">Status</span><Badge className={DOC_STATUS_COLORS[doc.status]}>{doc.status.charAt(0) + doc.status.slice(1).toLowerCase()}</Badge></div>
                  <div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground w-28">Version</span><span className="font-medium">{doc.version}</span></div>
                  <div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground w-28">Last Update</span><span>{new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                  {doc.deadline && (<div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground w-28">Deadline</span><span className="flex items-center gap-1"><CalendarCheck className="h-3.5 w-3.5" />{new Date(doc.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>)}
                  {doc.update_interval && (<div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground w-28">Review Interval</span><span>{doc.update_interval} months</span></div>)}
                </div>
                <div className="space-y-3">
                  {doc.owner && (<div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground w-28">Owner</span><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{doc.owner.first_name} {doc.owner.last_name}</span></div>)}
                  {doc.reviewer && (<div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground w-28">Reviewer</span><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{doc.reviewer.first_name} {doc.reviewer.last_name}</span></div>)}
                  {doc.approver && (<div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground w-28">Approver</span><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{doc.approver.first_name} {doc.approver.last_name}</span></div>)}
                  {!doc.owner && !doc.reviewer && !doc.approver && (<p className="text-xs text-muted-foreground italic">No owner, reviewer or approver assigned yet.</p>)}
                </div>
              </div>
            ) : (<p className="text-sm text-muted-foreground">No document created yet.</p>)}
            <div className="flex items-center gap-3 pt-2 border-t border-border/60">
              {doc ? (
                <>
                  <Button onClick={() => router.push(editorHref!)} disabled={!editorHref}><FileText className="h-4 w-4 mr-2" />Open document</Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteDocument} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                    Delete &amp; restart wizard
                  </Button>
                </>
              ) : (
                <Button onClick={() => router.push(wizardHref)}><FileText className="h-4 w-4 mr-2" />Create document</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gate: Would you like to proceed? — only for optional steps when no document yet */}
        {!doc && !isMandatory && (
          <Card>
            <CardContent className="py-5 space-y-3">
              <p className="text-sm font-medium">Would you like to proceed with this document?</p>
              <p className="text-xs text-muted-foreground">
                {isMandatory
                  ? 'This document is required for your project.'
                  : 'This document is not mandatory but is recommended for larger organizations.'}
              </p>
              <div className="flex gap-3">
                <Button
                  size="sm"
                  variant={proceedAnswer === true ? 'default' : 'outline'}
                  onClick={() => saveCompletionData({ proceed: true }, 'Gate answer')}
                  disabled={savingSection === 'Gate answer'}
                >
                  Yes, create the document
                </Button>
                <Button
                  size="sm"
                  variant={proceedAnswer === false ? 'destructive' : 'outline'}
                  onClick={handleSkipStep}
                  disabled={isCompleting}
                >
                  <SkipForward className="h-4 w-4 mr-1.5" />
                  No, skip this step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* People assignment — only when document exists */}
        {doc && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />People Assignment</CardTitle>
              <CardDescription>Assign team members to work on, review, or approve this document.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stepTasks.length > 0 && (
                <div className="space-y-2">
                  {stepTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 text-sm rounded-lg border px-3 py-2">
                      <Badge className={TASK_TYPE_COLORS[task.type]}>{TASK_TYPE_LABELS[task.type]}</Badge>
                      <span className="flex-1">{task.assignee?.first_name} {task.assignee?.last_name}</span>
                      {task.assigner && <span className="text-xs text-muted-foreground">by {task.assigner.first_name}</span>}
                      <Badge variant={task.status === 'COMPLETED' ? 'default' : 'secondary'}>{task.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {!showAssignDialog ? (
                <Button variant="outline" size="sm" onClick={() => setShowAssignDialog(true)}><UserPlus className="h-4 w-4 mr-2" />Assign someone</Button>
              ) : (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium">New assignment</p><button onClick={() => setShowAssignDialog(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className="text-xs text-muted-foreground mb-1 block">Type</label><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={assignType} onChange={(e) => setAssignType(e.target.value)}><option value="WORK_ON_DOCUMENT">Write document</option><option value="REVIEW_DOCUMENT">Review document</option><option value="APPROVE_DOCUMENT">Approve document</option></select></div>
                    <div><label className="text-xs text-muted-foreground mb-1 block">Assign to</label><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}><option value="">Select member...</option>{members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.user.first_name} {m.user.last_name}{m.privilege === 'PROJECT_LEAD' ? ' (Lead)' : ''}</option>))}</select></div>
                  </div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label><Input placeholder="Any instructions for the assignee..." value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} /></div>
                  <Button size="sm" onClick={handleAssign} disabled={isAssigning}>{isAssigning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}Assign</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </>)}

      {/* Optional additional requests — collapsed by default */}
      {!isDone && (
        <Card>
          <button
            onClick={() => setShowRequests(!showRequests)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-accent/30 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-3">
              {showRequests ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm font-medium">Additional requests</span>
              {activeRequests > 0 && (
                <Badge variant="secondary" className="text-xs">{activeRequests} active</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">Optional</span>
          </button>
          {showRequests && (
            <CardContent className="pt-0 space-y-4 border-t border-border/60">
              <p className="text-xs text-muted-foreground pt-4">If you need extra resources for this step, flag them here. These are optional and do not block step completion.</p>

              {/* Awareness */}
              <RequestRow
                label="Do your people need awareness for this step?"
                description="Relevant people will be notified to review the related materials."
                value={completionData.needs_awareness as boolean | undefined}
                onToggle={(v) => saveCompletionData({ needs_awareness: v }, 'Awareness')}
                saving={savingSection === 'Awareness'}
              />

              {/* Training */}
              <RequestRow
                label="Do your people need training for this step?"
                description="A training request will be created for top management."
                value={completionData.needs_training as boolean | undefined}
                onToggle={(v) => saveCompletionData({ needs_training: v }, 'Training')}
                saving={savingSection === 'Training'}
              />

              {/* Technology */}
              <RequestRow
                label="Do you need extra technology for this step?"
                description="A request will be sent to top management for approval."
                value={completionData.needs_technology as boolean | undefined}
                onToggle={(v) => saveCompletionData({ needs_technology: v }, 'Technology')}
                saving={savingSection === 'Technology'}
              >
                {Boolean(completionData.needs_technology) && (
                  <Textarea
                    placeholder="Describe the technology needed..."
                    className="text-sm mt-2"
                    value={(completionData.technology_notes as string) ?? ''}
                    onChange={(e) => setCompletionData((d) => ({ ...d, technology_notes: e.target.value }))}
                    onBlur={() => saveCompletionData({ needs_technology: true, technology_notes: completionData.technology_notes }, 'Technology')}
                  />
                )}
              </RequestRow>

              {/* HR */}
              <RequestRow
                label="Do you need extra human resources for this step?"
                description="A request will be sent to top management."
                value={completionData.needs_hr as boolean | undefined}
                onToggle={(v) => saveCompletionData({ needs_hr: v }, 'Human Resources')}
                saving={savingSection === 'Human Resources'}
              >
                {Boolean(completionData.needs_hr) && (
                  <Textarea
                    placeholder="Describe the human resources needed..."
                    className="text-sm mt-2"
                    value={(completionData.hr_notes as string) ?? ''}
                    onChange={(e) => setCompletionData((d) => ({ ...d, hr_notes: e.target.value }))}
                    onBlur={() => saveCompletionData({ needs_hr: true, hr_notes: completionData.hr_notes }, 'Human Resources')}
                  />
                )}
              </RequestRow>

              {/* Finance */}
              <RequestRow
                label="Do you need extra budget for this step?"
                description="A financial request will be sent to top management."
                value={completionData.needs_finance as boolean | undefined}
                onToggle={(v) => saveCompletionData({ needs_finance: v }, 'Finance')}
                saving={savingSection === 'Finance'}
              >
                {Boolean(completionData.needs_finance) && (
                  <Textarea
                    placeholder="Describe the budget needed..."
                    className="text-sm mt-2"
                    value={(completionData.finance_notes as string) ?? ''}
                    onChange={(e) => setCompletionData((d) => ({ ...d, finance_notes: e.target.value }))}
                    onBlur={() => saveCompletionData({ needs_finance: true, finance_notes: completionData.finance_notes }, 'Finance')}
                  />
                )}
              </RequestRow>
            </CardContent>
          )}
        </Card>
      )}

      {/* Mark as completed */}
      {!isDone && (
        <Card>
          <CardContent className="py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ready to complete this step?</p>
              <p className="text-xs text-muted-foreground">This will mark the step as done and advance the project.</p>
            </div>
            <Button onClick={handleCompleteStep} disabled={isCompleting}>
              {isCompleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Mark as completed
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── RequestRow sub-component ─── */
function RequestRow({
  label,
  description,
  value,
  onToggle,
  saving,
  children,
}: {
  label: string;
  description: string;
  value: boolean | undefined;
  onToggle: (v: boolean) => void;
  saving: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant={value === true ? 'default' : 'outline'}
            onClick={() => onToggle(true)}
            disabled={saving}
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant={value === false ? 'default' : 'outline'}
            onClick={() => onToggle(false)}
            disabled={saving}
          >
            No
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
