'use client';

import { useEffect, useRef, useState } from 'react';
import { Tldraw, getSnapshot, loadSnapshot, type Editor, type TLEditorSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { getErrorMessage } from '@/lib/utils';

const SAVE_DELAY_MS = 1500;

interface Board {
  snapshot: TLEditorSnapshot | null;
  updated_at: string | null;
  updated_by: string | null;
  canEdit: boolean;
}

/** The project's whiteboard: saved automatically a moment after each change; read-only for auditors. */
export default function WhiteboardCanvas({ projectId }: { projectId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    apiClient.get<Board>(`/projects/${projectId}/whiteboard`)
      .then((r) => {
        setBoard(r.data);
        if (r.data.updated_at) setStatus(`Saved · last change by ${r.data.updated_by} on ${new Date(r.data.updated_at).toLocaleString()}`);
      })
      .catch((err) => toast.error(getErrorMessage(err, 'The whiteboard could not be loaded')));
    return () => clearTimeout(timer.current);
  }, [projectId]);

  const onMount = (editor: Editor) => {
    if (board?.snapshot) loadSnapshot(editor.store, board.snapshot);
    editor.updateInstanceState({ isReadonly: !board?.canEdit });
    if (!board?.canEdit) return;
    // Only changes made by the person (not loading) trigger a save.
    return editor.store.listen(() => {
      setStatus('Unsaved changes…');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        apiClient.put(`/projects/${projectId}/whiteboard`, { snapshot: getSnapshot(editor.store) })
          .then(() => setStatus(`Saved at ${new Date().toLocaleTimeString()}`))
          .catch((err) => { setStatus('Not saved'); toast.error(getErrorMessage(err, 'The whiteboard could not be saved')); });
      }, SAVE_DELAY_MS);
    }, { scope: 'document', source: 'user' });
  };

  if (!board) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading the whiteboard…</div>;
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {board.canEdit ? status || 'Changes are saved automatically.' : 'Read-only: auditors can view the whiteboard.'}
        {board.canEdit && ' One board per project: if two people edit at the same time, the last save wins.'}
      </p>
      <div className="relative flex-1 overflow-hidden rounded-lg border">
        <Tldraw onMount={onMount} />
      </div>
    </div>
  );
}
