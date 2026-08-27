'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BookOpen, FileText, Download, User, Clock } from 'lucide-react';
import { documentsApi, DocumentInstance } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

export default function LibraryPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [docs, setDocs] = useState<DocumentInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await documentsApi.getLibrary(orgId);
        setDocs(data);
      } catch {
        /* silent */
      } finally {
        setIsLoading(false);
      }
    })();
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <BookOpen className="h-6 w-6 text-primary" />
          Document Library
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Published compliance documents from all projects in this organization.
        </p>
      </div>

      {docs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground text-sm">No published documents yet.</p>
            <p className="text-xs text-muted-foreground">
              Documents appear here when they are submitted to the library from their project steps.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const latestVersion = doc.versions?.[0];
            return (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="text-sm font-semibold truncate">{doc.title}</h3>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                          v{doc.version}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {doc.template && <span>{doc.template.name}</span>}
                        {doc.step && <span>· {doc.step.title}</span>}
                        {doc.last_editor && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {doc.last_editor.first_name} {doc.last_editor.last_name}
                          </span>
                        )}
                        {latestVersion && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(latestVersion.published_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                      {latestVersion?.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{latestVersion.notes}&rdquo;</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/documents/${doc.id}/library/${doc.version}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-accent transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
