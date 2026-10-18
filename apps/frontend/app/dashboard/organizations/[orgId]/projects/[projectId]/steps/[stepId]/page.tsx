'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, CheckCircle2, Clock, FileText, Gavel,
  Loader2, Scale, UserPlus, X, Calendar, CalendarCheck,
  ChevronDown, ChevronRight, SkipForward, Trash2,
} from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { EducationalStepBody } from '@/lib/steps-content';
import { projectsApi, documentsApi, requestsApi, ResourceRequest, ResourceRequestKind, TaskAssignment, TaskType } from '@/lib/api';
import { REQUEST_KIND_LABELS, REQUEST_STATUS } from '@/lib/requests';
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS, formatDay, fullName, isOpen } from '@/lib/tasks';
import RequirementsStep from '@/components/requirements/requirements-step';
import RiskRegisterStep from '@/components/risk-register/risk-register-step';
import SoaStep from '@/components/soa/soa-step';
import { PolicyControls } from '@/components/policies/policy-controls';
import TrainingPlan from '@/components/audit-prep/training-plan';
import SecurityObjectives from '@/components/audit-prep/objectives';
import InternalAudit from '@/components/audit-prep/internal-audit';
import { ManagementReviewMeeting, ManagementReviewSetup } from '@/components/audit-prep/management-review';
import Maintenance from '@/components/maintenance/maintenance';
import { policiesApi } from '@/lib/api';
import { AwarenessPanel, TrainingPanel } from '@/components/steps/awareness-training';
import { STEP_AWARENESS_MATERIALS } from '@/lib/step-materials';
import { useAuthStore } from '@/store/auth-store';
import type { RiskRegisterCompletion } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { DOC_STATUS } from '@/lib/documents';
import { DocumentControl } from '@/components/steps/document-control';



const RISK_REGISTER_KEY = 'iso27001.p2s2.risk-register';
const SOA_KEY = 'iso27001.p2s3.statement-of-applicability';
// Steps that can only be finished once their checklist is complete (also enforced by the API).
// Phase 4: Preparation for External Audit
const P4 = {
  NC_PROCEDURE: 'iso27001.p4s1.nonconformity-procedure',
  TRAINING_PLAN: 'iso27001.p4s3.training-plan',
  OBJECTIVES: 'iso27001.p4s4.security-objectives',
  REVIEW_SETUP: 'iso27001.p4s5.management-review-setup',
  INTERNAL_AUDIT: 'iso27001.p4s6.internal-audit',
  MANAGEMENT_REVIEW: 'iso27001.p4s7.management-review',
};
const MAINTENANCE_KEY = 'iso27001.p5s1.maintenance';
const CHECKLIST_STEPS = [RISK_REGISTER_KEY, SOA_KEY, P4.TRAINING_PLAN, P4.OBJECTIVES, P4.REVIEW_SETUP, P4.INTERNAL_AUDIT, P4.MANAGEMENT_REVIEW, MAINTENANCE_KEY];

export default function StepDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  const stepId = params.stepId as string;
  const { currentProject, phases, isLoading, selectProject, completeStep, reopenStep } = useProjectStore();

  const [isCompleting, setIsCompleting] = useState(false);
  const [completionData, setCompletionData] = useState<Record<string, unknown>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignType, setAssignType] = useState<TaskType>('WORK_ON_DOCUMENT');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [stepTasks, setStepTasks] = useState<TaskAssignment[]>([]);
  const [stepRequests, setStepRequests] = useState<ResourceRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [registerCompletion, setRegisterCompletion] = useState<RiskRegisterCompletion | null>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);

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

  const loadRequests = useCallback(async () => {
    try {
      const { items } = await requestsApi.list(projectId);
      setStepRequests(items.filter((r) => r.step_id === stepId));
    } catch { /* silent */ }
  }, [projectId, stepId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

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
  const awarenessMaterials = STEP_AWARENESS_MATERIALS[step.key];
  const myPrivilege = members.find((m) => m.user_id === currentUserId)?.privilege;
  const canEditStep = myPrivilege === 'PROJECT_LEAD' || myPrivilege === 'PROJECT_MEMBER';
  const isRiskRegister = step.key === RISK_REGISTER_KEY;
  // Phase 3 policies are generated from the SoA: "Create document" builds a draft instead of opening a wizard.
  const isPolicyStep = !!meta?.policy_key;
  const hasChecklist = CHECKLIST_STEPS.includes(step.key);
  // A document step is finished once its document is approved into the library (clause 7.5).
  const documentMissing = step.type === 'DOCUMENT' && !doc?._count?.versions;
  const finishBlocked = (hasChecklist && !registerCompletion?.ready) || documentMissing;
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
        assigned_to: assignUserId, type: assignType, notes: assignNotes || undefined, deadline: assignDeadline || undefined,
      });
      toast.success('Task assigned');
      setShowAssignDialog(false); setAssignUserId(''); setAssignNotes(''); setAssignDeadline('');
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
    setIsCompleting(true);
    try { await completeStep(step!.id, true); toast.success('Step skipped'); }
    catch (err) { toast.error(getErrorMessage(err, 'Failed to skip step')); }
    finally { setIsCompleting(false); }
  };

  const handleReopenStep = async () => {
    if (!window.confirm('Reopen this step? Its work is kept; the step has to be finished again.')) return;
    setIsCompleting(true);
    try { await reopenStep(step!.id); toast.success('Step reopened'); }
    catch (err) { toast.error(getErrorMessage(err, 'Failed to reopen the step')); }
    finally { setIsCompleting(false); }
  };

  const handleCreatePolicyDraft = async () => {
    setIsCreatingDraft(true);
    try {
      const created = await policiesApi.createDraft(stepId);
      await selectProject(projectId);
      toast.success('Draft created from the Statement of Applicability');
      router.push('/dashboard/organizations/' + orgId + '/projects/' + projectId + '/documents/' + created.id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create the draft'));
    } finally {
      setIsCreatingDraft(false);
    }
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
  const documentTasks = stepTasks.filter((t) => DOCUMENT_TASK_TYPES.includes(t.type));
  const activeRequests = stepRequests.filter((r) => r.status === 'PENDING').length;

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
          {isDone && (
            <div className="flex shrink-0 items-center gap-2 mt-1.5">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                {completionData.skipped ? 'Skipped' : 'Completed'}{step.completed_at && ` on ${formatDay(step.completed_at)}`}
              </Badge>
              {myPrivilege === 'PROJECT_LEAD' && (
                <Button size="sm" variant="outline" onClick={handleReopenStep} disabled={isCompleting}>Reopen</Button>
              )}
            </div>
          )}
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
        <RiskRegisterStep stepId={step.id} orgId={orgId} projectId={projectId} onCompletionChange={setRegisterCompletion} />
      )}

      {/* Statement of Applicability + Risk Treatment Plan — 5-stage module */}
      {step.type === 'REGISTER' && step.key === SOA_KEY && (
        <SoaStep stepId={step.id} orgId={orgId} projectId={projectId} onCompletionChange={setRegisterCompletion} />
      )}

      {/* Phase 5: maintenance module */}
      {step.key === MAINTENANCE_KEY && <Maintenance orgId={orgId} projectId={projectId} onCompletionChange={setRegisterCompletion} />}

      {/* Phase 4 registers and modules */}
      {step.key === P4.TRAINING_PLAN && <TrainingPlan stepId={step.id} orgId={orgId} projectId={projectId} onCompletionChange={setRegisterCompletion} />}
      {step.key === P4.OBJECTIVES && <SecurityObjectives stepId={step.id} orgId={orgId} projectId={projectId} onCompletionChange={setRegisterCompletion} />}
      {step.key === P4.REVIEW_SETUP && <ManagementReviewSetup stepId={step.id} orgId={orgId} projectId={projectId} onCompletionChange={setRegisterCompletion} />}
      {step.key === P4.INTERNAL_AUDIT && <InternalAudit stepId={step.id} orgId={orgId} projectId={projectId} onCompletionChange={setRegisterCompletion} />}
      {step.key === P4.MANAGEMENT_REVIEW && <ManagementReviewMeeting stepId={step.id} orgId={orgId} projectId={projectId} onCompletionChange={setRegisterCompletion} />}
      {step.key === P4.NC_PROCEDURE && (
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground max-w-xl">
              This procedure describes how the Nonconformity and Corrective Action registers are used. The registers are available at any time.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href={'/dashboard/organizations/' + orgId + '/projects/' + projectId + '/registers'}>Open the registers</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase 3 policy: why it is required and the controls it covers */}
      {isPolicyStep && <PolicyControls stepId={step.id} />}

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
              <div className="space-y-4">
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <span className="flex items-center gap-2"><span className="text-muted-foreground">Status</span><Badge className={DOC_STATUS[doc.status].className}>{DOC_STATUS[doc.status].label}</Badge></span>
                  <span><span className="text-muted-foreground">Library version </span><span className="font-medium">{doc._count?.versions ? doc.version : '—'}</span></span>
                  <span><span className="text-muted-foreground">Last update </span>{formatDay(doc.updated_at)}</span>
                  {doc.deadline && <span className="flex items-center gap-1"><span className="text-muted-foreground">Deadline </span><CalendarCheck className="h-3.5 w-3.5" />{formatDay(doc.deadline)}</span>}
                </div>
                <DocumentControl key={doc.id + doc.updated_at} doc={doc} members={members} canEdit={canEditStep} onSaved={() => selectProject(projectId)} />
              </div>
            ) : (<p className="text-sm text-muted-foreground">No document created yet.</p>)}
            <div className="flex items-center gap-3 pt-2 border-t border-border/60">
              {doc ? (
                <>
                  <Button onClick={() => router.push(editorHref!)} disabled={!editorHref}><FileText className="h-4 w-4 mr-2" />Open document</Button>
                  {doc._count?.versions ? (
                    <span className="text-xs text-muted-foreground">In the library. Edit the document and submit a new version to update it.</span>
                  ) : canEditStep && (
                    <Button variant="destructive" size="sm" onClick={handleDeleteDocument} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                      {isPolicyStep ? 'Delete & regenerate draft' : 'Delete & restart wizard'}
                    </Button>
                  )}
                </>
              ) : (
                isPolicyStep ? (
                  <Button onClick={handleCreatePolicyDraft} disabled={isCreatingDraft}>
                    {isCreatingDraft ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                    Create draft from the SoA
                  </Button>
                ) : (
                  <Button onClick={() => router.push(wizardHref)}><FileText className="h-4 w-4 mr-2" />Create document</Button>
                )
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
              <CardDescription>Assign team members to work on or review this document. Approval is done by the document approver above.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {documentTasks.length > 0 && (
                <div className="space-y-2">
                  {documentTasks.map((task) => (
                    <div key={task.id} className="flex flex-wrap items-center gap-3 text-sm rounded-lg border px-3 py-2">
                      <Badge className={TASK_TYPE_COLORS[task.type]}>{TASK_TYPE_LABELS[task.type]}</Badge>
                      <span className="flex-1">{fullName(task.assignee)}</span>
                      {task.deadline && isOpen(task) && <span className="text-xs text-muted-foreground">due {formatDay(task.deadline)}</span>}
                      <span className="text-xs text-muted-foreground">by {task.assigner.first_name}</span>
                      <Badge variant={task.status === 'COMPLETED' ? 'default' : 'secondary'}>{task.status === 'COMPLETED' ? 'Done' : task.status === 'CANCELLED' ? 'Cancelled' : 'To do'}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {canEditStep && (!showAssignDialog ? (
                <Button variant="outline" size="sm" onClick={() => setShowAssignDialog(true)}><UserPlus className="h-4 w-4 mr-2" />Assign someone</Button>
              ) : (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium">New assignment</p><button onClick={() => setShowAssignDialog(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><label className="text-xs text-muted-foreground mb-1 block">Task</label><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={assignType} onChange={(e) => setAssignType(e.target.value as TaskType)}><option value="WORK_ON_DOCUMENT">Work on document</option><option value="REVIEW_DOCUMENT">Review document</option></select></div>
                    <div><label className="text-xs text-muted-foreground mb-1 block">Assign to</label><select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}><option value="">Select member...</option>{members.map((m) => (<option key={m.user_id} value={m.user_id}>{m.user.first_name} {m.user.last_name}{m.privilege === 'PROJECT_LEAD' ? ' (Lead)' : ''}</option>))}</select></div>
                    <div><label className="text-xs text-muted-foreground mb-1 block">Deadline</label><Input type="date" value={assignDeadline} onChange={(e) => setAssignDeadline(e.target.value)} /></div>
                  </div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Instructions (optional)</label><Input placeholder="What exactly should be done..." value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} /></div>
                  {!assignDeadline && doc?.deadline && <p className="text-xs text-muted-foreground">Without a date, the document deadline ({formatDay(doc.deadline)}) is used.</p>}
                  <Button size="sm" onClick={handleAssign} disabled={isAssigning}>{isAssigning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}Assign</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </>)}

      {/* Awareness and training with suggested materials (steps configured in step-materials.ts) */}
      {!isDone && step.type !== 'EDUCATIONAL' && (
        <>
          <AwarenessPanel
            projectId={projectId}
            stepId={step.id}
            stepTitle={step.title}
            materials={awarenessMaterials ?? []}
            members={members}
            sent={completionData.awareness as Parameters<typeof AwarenessPanel>[0]['sent']}
            canEdit={canEditStep}
            onSaved={setCompletionData}
          />
          <TrainingPanel
            projectId={projectId}
            stepId={step.id}
            members={members}
            confirmed={completionData.training as Parameters<typeof TrainingPanel>[0]['confirmed']}
            canEdit={canEditStep}
            onSaved={setCompletionData}
          />
        </>
      )}

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
                <Badge variant="secondary" className="text-xs">{activeRequests} waiting</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">Optional</span>
          </button>
          {showRequests && (
            <CardContent className="pt-0 space-y-4 border-t border-border/60">
              <p className="text-xs text-muted-foreground pt-4">If this step needs extra resources (clause 7.1), send a request: top management approves or rejects it on the Requests page. Requests are optional and do not block step completion.</p>

              {RESOURCE_REQUESTS.map((r) => (
                <ResourceRequestRow
                  key={r.kind}
                  label={REQUEST_KIND_LABELS[r.kind]}
                  placeholder={r.placeholder}
                  canSend={canEditStep}
                  sent={stepRequests.filter((x) => x.kind === r.kind)}
                  onSend={async (description) => {
                    await requestsApi.send(projectId, stepId, { kind: r.kind, description });
                    toast.success('Request sent to top management');
                    await loadRequests();
                  }}
                />
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Mark as completed */}
      {!isDone && (
        <Card>
          <CardContent className="py-5 space-y-4">
            {hasChecklist && registerCompletion && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Before finishing this step</p>
                <ul className="space-y-1.5">
                  {registerCompletion.items.map((i) => (
                    <li key={i.key} className="flex items-start gap-2 text-sm">
                      {i.done
                        ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" aria-label="Done" />
                        : <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-amber-500" aria-label="Not done" />}
                      <span>
                        {i.label}
                        {!i.done && <span className="block text-xs text-amber-700 dark:text-amber-400">{i.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Ready to complete this step?</p>
                <p className="text-xs text-muted-foreground">
                  {documentMissing
                    ? 'Submit the document to the library first (and have it approved if it has an approver).'
                    : finishBlocked
                    ? 'Complete the items above first.'
                    : isRiskRegister
                      ? 'This marks the step as done and schedules the yearly review of risks.'
                      : 'This will mark the step as done and advance the project.'}
                </p>
              </div>
              <Button onClick={handleCompleteStep} disabled={isCompleting || finishBlocked}>
                {isCompleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {hasChecklist ? 'Finish step' : 'Mark as completed'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const DOCUMENT_TASK_TYPES: TaskType[] = ['WORK_ON_DOCUMENT', 'REVIEW_DOCUMENT', 'APPROVE_DOCUMENT'];

const RESOURCE_REQUESTS: { kind: ResourceRequestKind; placeholder: string }[] = [
  { kind: 'TECHNOLOGY', placeholder: 'Which tool, license or equipment is needed, and why...' },
  { kind: 'HR', placeholder: 'Which people or skills are needed, and for how long...' },
  { kind: 'FINANCE', placeholder: 'How much is needed and for what...' },
];

/** One kind of resource request: the requests already sent with their decision, and a form to send a new one. */
function ResourceRequestRow({ label, placeholder, sent, canSend, onSend }: {
  label: string;
  placeholder: string;
  sent: ResourceRequest[];
  canSend: boolean;
  onSend: (description: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await onSend(notes.trim());
      setNotes('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send the request'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {sent.map((r) => (
        <div key={r.id} className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={REQUEST_STATUS[r.status].className}>{REQUEST_STATUS[r.status].label}</Badge>
            <span className="text-muted-foreground">Sent {formatDay(r.created_at)} by {fullName(r.requester)}</span>
          </div>
          <p className="whitespace-pre-line">{r.description}</p>
          {r.decider && r.decided_at && (
            <p className="text-muted-foreground">
              {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {fullName(r.decider)} on {formatDay(r.decided_at)}
              {r.decision_comment && `: ${r.decision_comment}`}
            </p>
          )}
        </div>
      ))}
      {canSend && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Textarea rows={2} className="text-sm" placeholder={placeholder} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button size="sm" variant="outline" disabled={busy || !notes.trim()} onClick={send}>
            {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Send request
          </Button>
        </div>
      )}
    </div>
  );
}
