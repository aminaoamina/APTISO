'use client';

import { useState } from 'react';
import { FileArchive, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportsApi, RegisterKey } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Downloads one register (or all of them) as an Excel file. */
export function ExcelButton({ projectId, register, label = 'Excel' }: { projectId: string; register: RegisterKey | 'all'; label?: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try { await exportsApi.register(projectId, register); }
    catch (err) { toast.error(getErrorMessage(err, 'The Excel export failed')); }
    finally { setBusy(false); }
  };
  return (
    <Button size="sm" variant="outline" onClick={download} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}{label}
    </Button>
  );
}

/**
 * Downloads the project's library as a ZIP: the approved documents (PDF and
 * Word) by phase, the master list of documents and every register, with
 * earlier versions and evidence files on request.
 */
export function LibraryZipButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [earlierVersions, setEarlierVersions] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await exportsApi.library(projectId, { earlierVersions, evidence });
      setOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'The ZIP export failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileArchive className="h-4 w-4 mr-1.5" />}Download library (ZIP)
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 space-y-3 rounded-lg border bg-background p-3 text-sm shadow-lg">
          <p className="text-xs text-muted-foreground">
            The current approved version of each document as PDF and Word, in folders by phase, with the master list of documents and all registers in Excel.
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={earlierVersions} onChange={(e) => setEarlierVersions(e.target.checked)} />
            <span>Include earlier versions <span className="text-xs text-muted-foreground">(PDF, in an &quot;Earlier versions&quot; folder)</span></span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={evidence} onChange={(e) => setEvidence(e.target.checked)} />
            <span>Include evidence files <span className="text-xs text-muted-foreground">(can be large)</span></span>
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={download} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileArchive className="h-4 w-4 mr-1.5" />}{busy ? 'Preparing…' : 'Download'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
