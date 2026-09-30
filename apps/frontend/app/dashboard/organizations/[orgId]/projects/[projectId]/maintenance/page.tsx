'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Maintenance from '@/components/maintenance/maintenance';

/** Conformio's Maintenance module: reachable from the project page, not only from Phase 5. */
export default function MaintenancePage() {
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
        <h1 className="text-2xl font-bold tracking-tight">ISMS Maintenance &amp; Certification Cycle</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          ISO 27001 is a continuing cycle, not a project that ends at certification. Keep the recurring activities on time to pass the surveillance audits.
        </p>
      </div>
      <Maintenance orgId={orgId} projectId={projectId} />
    </div>
  );
}
