'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ImprovementRegisters } from '@/components/audit-prep/registers';

/** Nonconformity (with corrective actions) and incident registers of a project. */
export default function RegistersPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href={`/dashboard/organizations/${orgId}/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />Back to project
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registers</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Nonconformities and corrective actions (ISO 27001 clause 10.2) and information security incidents (controls A.5.24–A.5.28).
          These registers are used throughout the ISMS — by internal audits, incident handling and management reviews.
        </p>
      </div>
      <ImprovementRegisters projectId={projectId} />
    </div>
  );
}
