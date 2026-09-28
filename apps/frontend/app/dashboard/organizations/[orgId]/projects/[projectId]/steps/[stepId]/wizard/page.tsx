'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  documentsApi,
  DocumentTemplate,
  DocumentTemplateQuestion,
} from '@/lib/api';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

const STEP_TEMPLATE_MAP: Record<string, string> = {
  'iso27001.p1s2.doc-control': 'DOC-CONTROL',
  'iso27001.p1s3.project-plan': 'PROJECT-PLAN',
  'iso27001.p1s4.req-identification': 'REQ-IDENTIFICATION',
  'iso27001.p1s6.isms-scope': 'ISMS-SCOPE',
  'iso27001.p1s7.security-policy': 'SECURITY-POLICY',
  'iso27001.p2s1.risk-methodology': 'RISK-METHODOLOGY',
};

function QuestionField({
  question,
  value,
  onChange,
  members,
}: {
  question: DocumentTemplateQuestion;
  value: string;
  onChange: (value: string) => void;
  members: { user_id: string; user: { first_name: string; last_name: string } }[];
}) {
  const id = `q-${question.key}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {question.label}
        {question.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {question.help_text && (
        <p className="text-xs text-muted-foreground">{question.help_text}</p>
      )}
      <div className="pt-1">
        {question.input_type === 'LONGTEXT' && (
          <Textarea
            id={id}
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${question.label.toLowerCase()}…`}
          />
        )}
        {question.input_type === 'TEXT' && (
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${question.label.toLowerCase()}…`}
          />
        )}
        {question.input_type === 'DATE' && (
          <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
        )}
        {question.input_type === 'PERSON' && (
          <NativeSelect
            id={id}
            value={value}
            placeholder="Select a person…"
            onChange={(e) => onChange(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.user.first_name} {m.user.last_name}
              </option>
            ))}
          </NativeSelect>
        )}
        {question.input_type === 'SELECT' && (
          <NativeSelect
            id={id}
            value={value}
            placeholder="Select an option…"
            onChange={(e) => onChange(e.target.value)}
          >
            {(question.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
    </div>
  );
}

export default function DocumentWizardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  const stepId = params.stepId as string;
  const stepKey = searchParams.get('key') ?? '';

  const { currentProject, members, selectProject } = useProjectStore();
  const user = useAuthStore((s) => s.user);

  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [page, setPage] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const templateCode = STEP_TEMPLATE_MAP[stepKey];
        if (!templateCode) throw new Error('Unknown step key: ' + stepKey);
        const tpl = await documentsApi.getTemplate(templateCode);
        if (cancelled) return;
        setTemplate(tpl);
        if (!currentProject) await selectProject(projectId);
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err, 'Failed to load the document template'));
      } finally {
        if (!cancelled) setIsLoadingTemplate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, stepKey]);

  // Prefill sensible defaults once both project and template are known
  useEffect(() => {
    if (!template || !currentProject) return;
    setAnswers((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const lead = members.find((m) => m.privilege === 'PROJECT_LEAD');
      const me = members.find((m) => m.user_id === user?.id);
      const next: Record<string, string> = {};
      for (const q of template.questions) {
        if (q.key === 'company_name') next[q.key] = currentProject.organization?.name ?? '';
        else if (q.key === 'author' && me) next[q.key] = me.user_id;
        else if (q.key === 'approver' && lead) next[q.key] = lead.user_id;
      }
      return next;
    });
  }, [template, currentProject, members, user]);

  const totalPages = useMemo(() => {
    if (!template) return 8;
    return Math.max(...template.questions.map((q) => q.wizard_page));
  }, [template]);

  const pages = useMemo(() => {
    const map: Record<number, DocumentTemplateQuestion[]> = {};
    for (const q of template?.questions ?? []) {
      (map[q.wizard_page] ??= []).push(q);
    }
    for (const list of Object.values(map)) list.sort((a, b) => a.order - b.order);
    return map;
  }, [template]);

  if (isLoadingTemplate || !template || !currentProject) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const currentPageQuestions = pages[page] ?? [];
  const isLastPage = page === totalPages;

  const setValue = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const goNext = () => {
    const missing = currentPageQuestions.filter(
      (q) => q.required && !(answers[q.key] ?? '').trim(),
    );
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((q) => [q.key, true])));
      toast.error('Please fill in the required fields');
      return;
    }
    setPage((p) => Math.min(p + 1, totalPages));
  };

  const createDocument = async () => {
    const missing = template.questions.filter(
      (q) => q.required && !(answers[q.key] ?? '').trim(),
    );
    if (missing.length > 0) {
      setPage(missing[0].wizard_page);
      setErrors(Object.fromEntries(missing.map((q) => [q.key, true])));
      toast.error('Please fill in all required questions first');
      return;
    }

    setIsCreating(true);
    try {
      const doc = await documentsApi.createFromWizard(projectId, stepId, answers);
      toast.success('Document created — opening editor');
      router.push(
        `/dashboard/organizations/${orgId}/projects/${projectId}/documents/${doc.id}`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate the document'));
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href={`/dashboard/organizations/${orgId}/projects/${projectId}/steps/${stepId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to step
      </Link>

      {/* Progress header */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-orange)]">
            Guided setup · {template.name}
          </p>
          <p className="text-xs text-muted-foreground font-medium">
            Step {page} / {totalPages}
          </p>
        </div>
        <h1 className="text-xl font-bold tracking-tight mt-1">
          {`Section ${page} of ${totalPages}`}
        </h1>
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--brand-orange)] transition-all duration-300"
            style={{ width: `${(page / totalPages) * 100}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <Card>
        <CardContent className="py-6 space-y-5">
          {currentPageQuestions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={answers[question.key] ?? ''}
              onChange={(v) => setValue(question.key, v)}
              members={members}
            />
          ))}

          {currentPageQuestions.some((q) => errors[q.key]) && (
            <p className="text-xs text-destructive">Required fields are marked with *</p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1 || isCreating}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>

        {isLastPage ? (
          <Button onClick={createDocument} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Create document
          </Button>
        ) : (
          <Button onClick={goNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        )}
      </div>

      {/* Reassurance footer */}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        After you create the document you can freely edit everything in the built-in editor.
        Anything left unanswered stays as a clearly visible placeholder in the draft — APTISO
        never invents information about your organization.
      </p>
    </div>
  );
}
