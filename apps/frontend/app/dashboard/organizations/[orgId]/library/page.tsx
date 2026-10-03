'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BookOpen, ChevronDown, ChevronRight, Download, FileText, Folder, Search } from 'lucide-react';
import { toast } from 'sonner';
import { documentsApi, LibraryDocument } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { getErrorMessage } from '@/lib/utils';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB');
const person = (p: { first_name: string; last_name: string } | null) => (p ? `${p.first_name} ${p.last_name}` : '—');

/** Groups documents as Project / Phase, in the order of the implementation steps. */
function groupDocuments(docs: LibraryDocument[]) {
  const projects = new Map<string, { name: string; phases: Map<string, LibraryDocument[]> }>();
  for (const doc of docs) {
    const project = doc.step.phase.project;
    if (!projects.has(project.id)) projects.set(project.id, { name: project.name, phases: new Map() });
    const phases = projects.get(project.id)!.phases;
    const phase = `${doc.step.phase.order}. ${doc.step.phase.name}`;
    phases.set(phase, [...(phases.get(phase) ?? []), doc]);
  }
  return [...projects.entries()];
}

export default function LibraryPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  useEffect(() => {
    void documentsApi.getLibrary(orgId)
      .then(setDocs)
      .catch((err) => toast.error(getErrorMessage(err, 'Failed to load the library')))
      .finally(() => setIsLoading(false));
  }, [orgId]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupDocuments(q ? docs.filter((d) => `${d.title} ${d.step.title}`.toLowerCase().includes(q)) : docs);
  }, [docs, query]);

  const download = async (doc: LibraryDocument, version: string) => {
    try {
      await documentsApi.downloadPdf(doc.id, version);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download the PDF'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-primary" />
            Document Library
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Controlled documents submitted from the implementation steps. Every version is kept.
          </p>
        </div>
        {docs.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents" />
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground text-sm">No documents in the library yet.</p>
            <p className="text-xs text-muted-foreground">
              Open a document from its step and click &quot;Submit to Library&quot; to publish its first version.
            </p>
          </CardContent>
        </Card>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">No document matches &quot;{query}&quot;.</p>
      ) : (
        grouped.map(([projectId, project]) => (
          <section key={projectId} className="space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2"><Folder className="h-4 w-4 text-primary" />{project.name}</h2>
            {[...project.phases.entries()].map(([phase, phaseDocs]) => (
              <Card key={phase}>
                <CardContent className="py-3 px-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-2">{phase}</p>
                  <ul className="divide-y divide-border/60">
                    {phaseDocs.map((doc) => {
                      const latest = doc.versions[0];
                      const historyOpen = openHistory === doc.id;
                      return (
                        <li key={doc.id} className="py-3">
                          <div className="flex items-start gap-3">
                            <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/dashboard/organizations/${orgId}/projects/${projectId}/documents/${doc.id}`}
                                  className="text-sm font-semibold hover:underline"
                                >
                                  {doc.title}
                                </Link>
                                <Badge variant="outline">v{latest.version}</Badge>
                                {doc.status !== 'PUBLISHED' && (
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Revision in progress</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Published {formatDate(latest.published_at)} by {person(latest.publisher ?? null)} · Owner {person(doc.owner)} · Approver {person(doc.approver)}
                              </p>
                              {doc.versions.length > 1 && (
                                <button
                                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => setOpenHistory(historyOpen ? null : doc.id)}
                                >
                                  {historyOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  {doc.versions.length - 1} earlier version{doc.versions.length > 2 ? 's' : ''}
                                </button>
                              )}
                              {historyOpen && (
                                <ul className="mt-2 space-y-1">
                                  {doc.versions.slice(1).map((v) => (
                                    <li key={v.version} className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="w-12">v{v.version}</span>
                                      <span className="flex-1 truncate">{formatDate(v.published_at)}{v.notes && ` · ${v.notes}`}</span>
                                      <Button size="sm" variant="ghost" className="h-7" onClick={() => download(doc, v.version)}>
                                        <Download className="h-3.5 w-3.5 mr-1" />PDF
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <Button size="sm" variant="outline" onClick={() => download(doc, latest.version)}>
                              <Download className="h-3.5 w-3.5 mr-1.5" />PDF
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
