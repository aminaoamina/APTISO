'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { policiesApi, PolicyInfo } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS } from '@/components/soa/soa-stages';

/** Phase 3 policy step: why the policy is required and which SoA controls it covers. */
export function PolicyControls({ stepId }: { stepId: string }) {
  const [info, setInfo] = useState<PolicyInfo | null>(null);

  useEffect(() => {
    policiesApi.get(stepId).then(setInfo).catch(() => setInfo(null));
  }, [stepId]);

  if (!info) return null;
  const covered = info.controls.filter(c => c.applicable);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Why do this?</CardTitle>
        <CardDescription>{info.why}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!info.required && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            This policy is no longer required by the Statement of Applicability. It is kept so no work is lost; you do not need to complete it.
          </p>
        )}
        <p className="text-xs font-medium text-muted-foreground">
          Covers these ISO 27001 controls ({covered.length} applicable in the SoA). The draft is built from their implementation methods.
        </p>
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {info.controls.map(c => (
            <li key={c.code} className={`flex flex-wrap items-center gap-2 px-3 py-2 text-sm ${c.applicable ? '' : 'text-muted-foreground'}`}>
              <span className="w-14 font-mono text-xs">{c.code}</span>
              <span className="flex-1 min-w-40">{c.title}</span>
              {!c.applicable
                ? <Badge variant="outline" className="text-xs">Not applicable</Badge>
                : c.status && <Badge variant="outline" className="text-xs">{STATUS_LABELS[c.status]}</Badge>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
