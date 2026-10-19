'use client';

import { useParams } from 'next/navigation';
import { CompanionChat } from '@/components/ai/companion-chat';

/** Every project page offers the ISO companion. */
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  return (
    <>
      {children}
      <CompanionChat orgId={orgId} projectId={projectId} />
    </>
  );
}
