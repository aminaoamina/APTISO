'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

// tldraw draws in the browser only.
const WhiteboardCanvas = dynamic(() => import('@/components/whiteboard/whiteboard-canvas'), { ssr: false });

export default function WhiteboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Whiteboard</h1>
        <p className="text-sm text-muted-foreground">Sketch the context, interested parties, scope or a risk workshop with sticky notes, shapes and arrows.</p>
      </div>
      <div className="flex-1 min-h-0">
        <WhiteboardCanvas projectId={projectId} />
      </div>
    </div>
  );
}
