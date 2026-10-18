'use client';

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Link2Off,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as   TableIcon,
  Undo2,
  Redo2,
  Rows3,
  Columns3,
  Trash2,
  Download,
} from 'lucide-react';
import type { ProseMirrorNode } from '@/lib/api';

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
  }),
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
];

interface ToolbarProps {
  editor: Editor;
  onExportDocx?: () => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      } disabled:opacity-40 disabled:pointer-events-none`}
    >
      {children}
    </button>
  );
}

const Divider = () => <div className="w-px h-5 bg-border mx-1" />;

function Toolbar({ editor, onExportDocx }: ToolbarProps) {
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    if (previous) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: previous }).run();
      return;
    }
    const url = window.prompt('Link URL');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5 sticky top-0 bg-card z-10 rounded-t-lg">
      <ToolbarButton
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {[1, 2, 3].map((level) => (
        <ToolbarButton
          key={level}
          title={`Heading ${level}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
          active={editor.isActive('heading', { level })}
        >
          {level === 1 ? <Heading1 className="h-4 w-4" /> : level === 2 ? <Heading2 className="h-4 w-4" /> : <Heading3 className="h-4 w-4" />}
        </ToolbarButton>
      ))}

      <Divider />

      <ToolbarButton
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton title="Insert link" onClick={setLink} active={editor.isActive('link')}>
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Remove link"
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
      >
        <Link2Off className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      {(['left', 'center', 'right'] as const).map((align) => (
        <ToolbarButton
          key={align}
          title={`Align ${align}`}
          onClick={() => editor.chain().focus().setTextAlign(align).run()}
          active={editor.isActive({ textAlign: align })}
        >
          {align === 'left' ? <AlignLeft className="h-4 w-4" /> : align === 'center' ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
        </ToolbarButton>
      ))}

      <Divider />

      <ToolbarButton
        title="Insert table"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <TableIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Add row below"
        onClick={() => editor.chain().focus().addRowAfter().run()}
        disabled={!editor.can().addRowAfter()}
      >
        <Rows3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Add column right"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        disabled={!editor.can().addColumnAfter()}
      >
        <Columns3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Delete selection"
        onClick={() => editor.chain().focus().deleteTable().run()}
        disabled={!editor.can().deleteTable()}
      >
        <Trash2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      {onExportDocx && (
        <>
          <Divider />
          <button
            type="button"
            title="Download as .docx"
            onClick={onExportDocx}
            className="h-8 px-2 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">.docx</span>
          </button>
        </>
      )}
    </div>
  );
}

export interface DocumentEditorProps {
  initialContent: ProseMirrorNode;
  editable?: boolean;
  onChange?: (content: ProseMirrorNode) => void;
  onReady?: (editor: Editor) => void;
  onExportDocx?: () => void;
}

export default function DocumentEditor({
  initialContent,
  editable = true,
  onChange,
  onExportDocx,
}: DocumentEditorProps) {
  const readyRef = useRef(false);

  const editor = useEditor({
    extensions,
    content: initialContent as unknown as Record<string, unknown>,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (!readyRef.current) return;
      onChange?.(editor.getJSON() as unknown as ProseMirrorNode);
    },
  });

  // Permissions can arrive after the editor (project still loading) or change (document sent for approval).
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (editor) {
      const t = setTimeout(() => { readyRef.current = true; }, 500);
      return () => clearTimeout(t);
    }
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-border bg-card h-[480px] flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading editor…</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {editable && <Toolbar editor={editor} onExportDocx={onExportDocx} />}
      <div className="document-editor-area px-6 py-5 max-h-[70vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
