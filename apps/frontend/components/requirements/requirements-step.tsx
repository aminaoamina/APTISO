'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, FileText, Loader2, Trash2, Edit2, FileEdit, FilePlus,
} from 'lucide-react';
import { requirementsApi, Requirement, CreateRequirementData, DocumentInstance } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  CONTRACTUAL: 'Contractual',
  LEGAL_REGULATORY: 'Legal/Regulatory',
  OTHER: 'Other',
};

const TYPE_COLORS: Record<string, string> = {
  CONTRACTUAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  LEGAL_REGULATORY: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  OTHER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const STATUS_COLORS: Record<string, string> = {
  COMPLIANT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  NON_COMPLIANT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const RELATED_AREAS = [
  'Document and record control',
  'Defining to which parts of the company information security needs to be applied',
  'Top-level security roles and responsibilities',
  'Setting top-level information security objectives and intentions',
  'Reporting the performance of information security',
  'Risk management',
  'Specifying mandatory safeguards',
  'Measuring information security',
  'Internal auditing',
  'Corrections and corrective actions',
  'Nonconformities / non-compliance',
  'Planning the information security project',
  'Identification of stakeholders and security requirements',
  'Use of mobile devices',
  'Teleworking / working from home',
  'Defining responsibility for assets and proper use of assets',
  'Passwords and other authentication mechanisms',
  'Physical protection of assets',
  'Proper usage of IT equipment',
  'Protection against malware',
  'Protection against data loss / backup',
  'Control of the installation of software',
  'Protecting transfer of information through various communication channels (email, social media, data transfer, etc.)',
  'Protection of intellectual property and licensed software',
  'Access control',
  'Disposal of media and equipment',
  'Operation of information technology',
  'Change control related to IT and software',
  'Logging and review of activities in information systems',
  'Network security',
  'Encryption',
  'Protection of data centers and other secure areas',
  'Resilience, business continuity and disaster recovery',
  'Information classification',
  'Security in software development (in-house and outsourced)',
  'Software testing',
  'Managing security with suppliers and partners',
  'Confidentiality obligations and non-disclosure agreements',
  'Handling security events, incidents and data breaches',
  'Privacy',
  '(other)',
];

const EMPTY_FORM: CreateRequirementData = {
  requirement_type: 'CONTRACTUAL',
  status: 'NON_COMPLIANT',
  interested_party: '',
  description: '',
  responsible_person_id: '',
  related_area: '',
  deadline: '',
  document_stipulating: '',
  date_of_document: '',
  valid_from: '',
  country: '',
  state: '',
  link: '',
  law_regulation_name: '',
};

export default function RequirementsStep({
  stepId,
  members,
  orgId,
  projectId,
}: {
  stepId: string;
  members: { user_id: string; user: { first_name: string; last_name: string } }[];
  orgId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateRequirementData>({ ...EMPTY_FORM });
  const [customArea, setCustomArea] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [document, setDocument] = useState<DocumentInstance | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, doc] = await Promise.all([
        requirementsApi.list(stepId),
        requirementsApi.getDocument(stepId),
      ]);
      setRequirements(data);
      setDocument(doc);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load requirements'));
    } finally {
      setIsLoading(false);
    }
  }, [stepId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setCustomArea('');
    setIsDialogOpen(true);
  };

  const openEdit = (req: Requirement) => {
    setEditingId(req.id);
    const isOtherArea = req.related_area && !RELATED_AREAS.includes(req.related_area);
    setForm({
      requirement_type: req.requirement_type,
      status: req.status,
      interested_party: req.interested_party,
      description: req.description,
      responsible_person_id: req.responsible_person_id,
      related_area: isOtherArea ? '(other)' : (req.related_area ?? ''),
      deadline: req.deadline ? req.deadline.slice(0, 10) : '',
      document_stipulating: req.document_stipulating ?? '',
      date_of_document: req.date_of_document ? req.date_of_document.slice(0, 10) : '',
      valid_from: req.valid_from ? req.valid_from.slice(0, 10) : '',
      country: req.country ?? '',
      state: req.state ?? '',
      link: req.link ?? '',
      law_regulation_name: req.law_regulation_name ?? '',
    });
    setCustomArea(isOtherArea ? req.related_area ?? '' : '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.interested_party.trim() || !form.description.trim() || !form.responsible_person_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    const raw: CreateRequirementData = {
      ...form,
      related_area: form.related_area === '(other)' ? customArea : form.related_area,
    };
    const payload = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ) as CreateRequirementData;

    setIsSaving(true);
    try {
      if (editingId) {
        await requirementsApi.update(editingId, payload);
        toast.success('Requirement updated');
      } else {
        await requirementsApi.create(stepId, payload);
        toast.success('Requirement created');
      }
      setIsDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save requirement'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return;
    try {
      await requirementsApi.delete(id);
      toast.success('Requirement deleted');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete requirement'));
    }
  };

  const handleCreateReport = async () => {
    setIsCreatingDoc(true);
    try {
      const doc = await requirementsApi.createDocument(stepId);
      router.push(`/dashboard/organizations/${orgId}/projects/${projectId}/documents/${doc.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create report'));
      setIsCreatingDoc(false);
    }
  };

  const setField = (key: keyof CreateRequirementData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const type = form.requirement_type;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Requirements table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Requirements Register</CardTitle>
            <CardDescription>
              {requirements.length} requirement{requirements.length !== 1 ? 's' : ''} added
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleCreateReport}
              disabled={requirements.length === 0 || isCreatingDoc}
            >
              {isCreatingDoc ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : document ? (
                <FileEdit className="h-4 w-4 mr-2" />
              ) : (
                <FilePlus className="h-4 w-4 mr-2" />
              )}
              {document ? 'Edit Report' : 'Create Report'}
            </Button>
            <Button size="sm" variant="outline" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />New Requirement
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No requirements added yet. Click &quot;New Requirement&quot; to start.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Description</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Interested Party</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Responsible</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((req) => (
                    <tr
                      key={req.id}
                      className="border-b border-border/40 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => openEdit(req)}
                    >
                      <td className="py-2.5 px-3"><Badge className={TYPE_COLORS[req.requirement_type]}>{TYPE_LABELS[req.requirement_type]}</Badge></td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate">{req.description}</td>
                      <td className="py-2.5 px-3">{req.interested_party}</td>
                      <td className="py-2.5 px-3">{req.responsible_person ? `${req.responsible_person.first_name} ${req.responsible_person.last_name}` : '—'}</td>
                      <td className="py-2.5 px-3"><Badge className={STATUS_COLORS[req.status]}>{req.status === 'COMPLIANT' ? 'Compliant' : 'Non-Compliant'}</Badge></td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(req); }}
                          className="p-1 hover:bg-accent rounded-md transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}
                          className="p-1 hover:bg-destructive/10 rounded-md transition-colors ml-1"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requirement form dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDialogOpen(false)} />
          <div className="relative rounded-xl shadow-xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4" style={{ backgroundColor: '#F4F1EA' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Requirement' : 'New Requirement'}</h2>
              <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
            </div>

            {/* Type selector */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Requirement type *</Label>
                <NativeSelect
                  value={form.requirement_type}
                  onChange={(e) => setField('requirement_type', e.target.value)}
                >
                  <option value="CONTRACTUAL">Contractual requirement</option>
                  <option value="LEGAL_REGULATORY">Legal/regulatory requirement</option>
                  <option value="OTHER">Other requirement</option>
                </NativeSelect>
              </div>
              <div>
                <Label>Status *</Label>
                <NativeSelect
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  <option value="NON_COMPLIANT">Non-compliant</option>
                  <option value="COMPLIANT">Compliant</option>
                </NativeSelect>
              </div>
            </div>

            {/* Common fields */}
            <div>
              <Label>Interested party *</Label>
              <Input
                value={form.interested_party}
                onChange={(e) => setField('interested_party', e.target.value)}
                placeholder="Enter interested party"
              />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Enter description"
              />
            </div>
            <div>
              <Label>Responsible person *</Label>
              <NativeSelect
                value={form.responsible_person_id}
                placeholder="Select user"
                onChange={(e) => setField('responsible_person_id', e.target.value)}
              >
                <option value="">Select user…</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user.first_name} {m.user.last_name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* Related area — shared across all types */}
            <div>
              <Label>To what area is this requirement related? *</Label>
              <NativeSelect
                value={form.related_area}
                placeholder="Select related documents"
                onChange={(e) => setField('related_area', e.target.value)}
              >
                <option value="">Select area…</option>
                {RELATED_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </NativeSelect>
              {form.related_area === '(other)' && (
                <Input
                  className="mt-2"
                  value={customArea}
                  onChange={(e) => setCustomArea(e.target.value)}
                  placeholder="Enter custom area"
                />
              )}
            </div>

            {/* Type-specific fields: Contractual & Other */}
            {(type === 'CONTRACTUAL' || type === 'OTHER') && (
              <>
                <div>
                  <Label>Document stipulating the requirement *</Label>
                  <Input
                    value={form.document_stipulating}
                    onChange={(e) => setField('document_stipulating', e.target.value)}
                    placeholder="Enter prescribing document"
                  />
                </div>
                <div>
                  <Label>Date of the document</Label>
                  <Input
                    type="date"
                    value={form.date_of_document}
                    onChange={(e) => setField('date_of_document', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Deadline — shared across all types */}
            <div>
              <Label>Deadline</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setField('deadline', e.target.value)}
              />
            </div>

            {/* Type-specific fields: Legal/Regulatory */}
            {type === 'LEGAL_REGULATORY' && (
              <>
                <div>
                  <Label>Valid from *</Label>
                  <Input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setField('valid_from', e.target.value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Country</Label>
                    <Input
                      value={form.country}
                      onChange={(e) => setField('country', e.target.value)}
                      placeholder="Enter country"
                    />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input
                      value={form.state}
                      onChange={(e) => setField('state', e.target.value)}
                      placeholder="Enter state"
                    />
                  </div>
                </div>
                <div>
                  <Label>Name of the law/regulation *</Label>
                  <Input
                    value={form.law_regulation_name}
                    onChange={(e) => setField('law_regulation_name', e.target.value)}
                    placeholder="Enter law/regulation name"
                  />
                </div>
                <div>
                  <Label>Link</Label>
                  <Input
                    value={form.link}
                    onChange={(e) => setField('link', e.target.value)}
                    placeholder="Enter link"
                  />
                </div>
              </>
            )}

            {/* Save button */}
            <div className="flex justify-end gap-3 pt-2 border-t border-border/60">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {editingId ? 'Save changes' : 'Add requirement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
