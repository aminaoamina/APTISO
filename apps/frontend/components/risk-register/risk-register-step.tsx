'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Shield, Check, ChevronLeft, ChevronRight, X, AlertTriangle,
} from 'lucide-react';
import {
  riskApi,
  RiskRegisterCompletion,
  RiskRegisterState,
  RiskSeedData,
  RiskUpdate,
} from '@/lib/api';
import { ApprovalStage, EvaluationStage, ReviewStage, TreatmentStage } from './risk-stages';
import { CustomThreat, ThreatStage, threatPairKey } from './threat-stage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

// Conformio's seven register stages.
const STEP_TITLES = [
  'Assets',
  'Vulnerabilities',
  'Threats',
  'Evaluation',
  'Review',
  'Treatment',
  'Approval',
];
const LAST_STAGE = STEP_TITLES.length - 1;

const CATEGORY_LABELS: Record<string, string> = {
  INFRASTRUCTURE: 'Infrastructure',
  IT_COMMUNICATION: 'IT and communication equipment',
  SOFTWARE_DATABASE: 'Software & databases',
  DOCUMENTS_DATA: 'Other documents and data',
  HUMAN_RESOURCES: 'Human resources',
  THIRD_PARTY: 'Third-party services',
};

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        active
          ? 'border-[var(--brand-orange)] bg-[var(--brand-orange)]/10 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-accent'
      }`}
    >
      {active ? <Check className="h-4 w-4 shrink-0 text-[var(--brand-orange)]" /> : <span className="h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </button>
  );
}

export default function RiskRegisterStep({
  stepId,
  orgId,
  projectId,
  onCompletionChange,
}: {
  stepId: string;
  orgId: string;
  projectId: string;
  /** Lets the step page lock "Finish" until the register is complete. */
  onCompletionChange?: (completion: RiskRegisterCompletion) => void;
}) {
  const [seed, setSeed] = useState<RiskSeedData | null>(null);
  const [state, setState] = useState<RiskRegisterState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(0);
  const resumed = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingDocs, setIsCreatingDocs] = useState(false);
  const [documents, setDocuments] = useState<{ id: string; title: string }[]>([]);

  // local custom catalogs while on selection steps
  const [customAssets, setCustomAssets] = useState<{ name: string; category: string }[]>([]);
  const [customVulns, setCustomVulns] = useState<{ name: string; category: string; applicable_controls?: string[] }[]>([]);
  const [customThreats, setCustomThreats] = useState<CustomThreat[]>([]);
  const [newAssetName, setNewAssetName] = useState('');
  const [openAddCategory, setOpenAddCategory] = useState<string | null>(null);
  const [showAssetsWarning, setShowAssetsWarning] = useState(false);
  const [showVulnsWarning, setShowVulnsWarning] = useState(false);
  const [showThreatsWarning, setShowThreatsWarning] = useState(false);
  const [showEvalWarning, setShowEvalWarning] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<Set<string>>(new Set());
  const [addVulnFor, setAddVulnFor] = useState<string | null>(null);
  const [vulnSearch, setVulnSearch] = useState('');
  const [showNewVuln, setShowNewVuln] = useState(false);
  const [newVulnStep, setNewVulnStep] = useState(0);
  const [newVulnFormName, setNewVulnFormName] = useState('');
  const [newVulnFormCategory, setNewVulnFormCategory] = useState('');
  const [newVulnControls, setNewVulnControls] = useState<Set<string>>(new Set());
  const [newVulnControlSearch, setNewVulnControlSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, r, docs] = await Promise.all([
        riskApi.getSeed(stepId),
        riskApi.getRegister(stepId),
        riskApi.getDocuments(stepId),
      ]);
      setSeed(s);
      setState(r);
      setDocuments(docs);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load risk register'));
    } finally {
      setIsLoading(false);
    }
  }, [stepId]);

  useEffect(() => { load(); }, [load]);

  // ==================== Step 1: Assets ====================
  // Simplify: use a local working map for selected asset names
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [selectedVulnsByAsset, setSelectedVulnsByAsset] = useState<Record<string, Set<string>>>({});
  // Threats per asset + vulnerability combination, keyed by threatPairKey(asset, vulnerability).
  const [selectedThreatsByPair, setSelectedThreatsByPair] = useState<Record<string, Set<string>>>({});

  // hydate working sets from server state
  useEffect(() => {
    if (!state) return;
    setSelectedAssets(new Set(state.assets.map(a => a.name)));
    const vulnMap: Record<string, Set<string>> = {};
    const threatMap: Record<string, Set<string>> = {};
    const assetById = new Map(state.assets.map(a => [a.id, a.name]));
    const vulnById = new Map(state.vulnerabilities.map(v => [v.id, v.name]));
    state.assetVulnLinks.forEach(l => {
      const assetName = assetById.get(l.asset_id);
      const vulnName = vulnById.get(l.vulnerability_id);
      if (assetName && vulnName) {
        vulnMap[assetName] = vulnMap[assetName] ?? new Set();
        vulnMap[assetName].add(vulnName);
      }
    });
    const threatById = new Map(state.threats.map(t => [t.id, t.name]));
    state.vulnThreatLinks.forEach(l => {
      const assetName = assetById.get(l.asset_id);
      const vulnName = vulnById.get(l.vulnerability_id);
      const threatName = threatById.get(l.threat_id);
      if (assetName && vulnName && threatName) {
        const key = threatPairKey(assetName, vulnName);
        threatMap[key] = threatMap[key] ?? new Set();
        threatMap[key].add(threatName);
      }
    });
    setSelectedVulnsByAsset(vulnMap);
    setSelectedThreatsByPair(threatMap);
    setCustomAssets(state.assets.filter(a => a.is_custom).map(a => ({ name: a.name, category: a.category })));
    // Keep applicable_controls, otherwise the next save would clear them.
    setCustomVulns(state.vulnerabilities.filter(v => v.is_custom).map(v => ({
      name: v.name, category: v.category, applicable_controls: v.applicable_controls ?? undefined,
    })));
    setCustomThreats(state.threats.filter(t => t.is_custom).map(t => ({
      name: t.name, threat_category: t.threat_category, applicable_controls: t.applicable_controls ?? undefined,
    })));

    // Reopen the wizard at the first stage that still needs work.
    if (!resumed.current) {
      resumed.current = true;
      const { summary } = state;
      if (state.assets.length === 0) setStep(0);
      else if (state.assetVulnLinks.length === 0) setStep(1);
      else if (state.vulnThreatLinks.length === 0 || summary.total === 0) setStep(2);
      else if (summary.evaluated < summary.total) setStep(3);
      else if (summary.reviewed < summary.total) setStep(4);
      else if (summary.treated < summary.unacceptable) setStep(5);
      else setStep(6);
    }
  }, [state]);

  const canEdit = state?.permissions.canEdit ?? false;

  useEffect(() => {
    if (state) onCompletionChange?.(state.completion);
  }, [state, onCompletionChange]);

  const canProceed = useMemo(() => {
    if (step === 0) return selectedAssets.size > 0;
    if (step === 1) return Object.values(selectedVulnsByAsset).some(s => s.size > 0);
    if (step === 2) return Object.values(selectedThreatsByPair).some(s => s.size > 0);
    // Conformio: Next on Treatment is only possible once every unacceptable risk is treated.
    if (step === 5) return !canEdit || (state ? state.summary.treated >= state.summary.unacceptable : false);
    return true;
  }, [step, selectedAssets, selectedVulnsByAsset, selectedThreatsByPair, state, canEdit]);

  const assetsMissingVulns = useMemo(() => {
    return Array.from(selectedAssets).filter(name => !(selectedVulnsByAsset[name]?.size ?? 0));
  }, [selectedAssets, selectedVulnsByAsset]);

  const pairsMissingThreats = useMemo(() => {
    return Object.entries(selectedVulnsByAsset).flatMap(([asset, vulns]) =>
      [...vulns].filter(v => !(selectedThreatsByPair[threatPairKey(asset, v)]?.size ?? 0)).map(v => ({ asset, v })),
    );
  }, [selectedVulnsByAsset, selectedThreatsByPair]);

  const saveAssets = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const next = await riskApi.saveAssets(stepId, {
        assetNames: Array.from(selectedAssets),
        customAssets,
      });
      setState(next);
      toast.success('Assets saved');
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save assets'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveVulnerabilities = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const assetIdByName = new Map((state?.assets ?? []).map(a => [a.name, a.id]));
      const vulnerabilitiesByAsset: Record<string, string[]> = {};
      for (const [assetName, vulnSet] of Object.entries(selectedVulnsByAsset)) {
        const assetId = assetIdByName.get(assetName);
        if (!assetId) continue;
        vulnerabilitiesByAsset[assetId] = Array.from(vulnSet);
      }
      const next = await riskApi.saveVulnerabilities(stepId, {
        vulnerabilitiesByAsset,
        customVulnerabilities: customVulns,
      });
      setState(next);
      toast.success('Vulnerabilities saved');
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save vulnerabilities'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveThreats = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const assetIdByName = new Map((state?.assets ?? []).map(a => [a.name, a.id]));
      const vulnIdByName = new Map((state?.vulnerabilities ?? []).map(v => [v.name, v.id]));
      const livePairs = new Set((state?.assetVulnLinks ?? []).map(l => `${l.asset_id}:${l.vulnerability_id}`));
      const threatsByAssetVulnerability: Record<string, string[]> = {};
      for (const [assetName, vulns] of Object.entries(selectedVulnsByAsset)) {
        for (const vulnName of vulns) {
          const key = `${assetIdByName.get(assetName)}:${vulnIdByName.get(vulnName)}`;
          const threats = selectedThreatsByPair[threatPairKey(assetName, vulnName)];
          if (livePairs.has(key) && threats && threats.size > 0) threatsByAssetVulnerability[key] = [...threats];
        }
      }
      // Only send custom threats that are still used somewhere.
      const used = new Set(Object.values(threatsByAssetVulnerability).flat());
      const next = await riskApi.saveThreats(stepId, {
        threatsByAssetVulnerability,
        customThreats: customThreats.filter(t => used.has(t.name)),
      });
      setState(next);
      toast.success('Threats saved');
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save threats'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    // Auditors have read-only access: just move between stages.
    if (!canEdit) {
      setStep(s => Math.min(LAST_STAGE, s + 1));
      return;
    }
    // Step 3 (evaluation): warn about empty risks
    if (step === 3 && state && state.summary.evaluated < state.summary.total) {
      setShowEvalWarning(true);
      return;
    }
    // Step 0 (assets): intercept if not all asset categories are covered
    if (step === 0) {
      const covered = new Set<string>();
      seed?.assets.forEach(a => {
        if (selectedAssets.has(a.name)) covered.add(a.category);
      });
      customAssets.forEach(a => {
        if (selectedAssets.has(a.name)) covered.add(a.category);
      });
      const allCategories = Object.keys(CATEGORY_LABELS);
      const missing = allCategories.filter(c => !covered.has(c));
      if (missing.length > 0) {
        setShowAssetsWarning(true);
        return;
      }
    }
    // Step 1 (vulnerabilities): intercept if not every asset has a vulnerability
    if (step === 1 && assetsMissingVulns.length > 0) {
      setShowVulnsWarning(true);
      return;
    }
    // Step 2 (threats): intercept if a vulnerability has no threat
    if (step === 2 && pairsMissingThreats.length > 0) {
      setShowThreatsWarning(true);
      return;
    }
    let ok = true;
    if (step === 0) ok = await saveAssets();
    else if (step === 1) ok = await saveVulnerabilities();
    else if (step === 2) ok = await saveThreats(); // the backend syncs the risk list
    if (ok) setStep(s => Math.min(LAST_STAGE, s + 1));
  };

  const proceedPastAssetsWarning = async () => {
    setShowAssetsWarning(false);
    const ok = await saveAssets();
    if (ok) setStep(s => Math.min(LAST_STAGE, s + 1));
  };

  const proceedPastVulnsWarning = async () => {
    setShowVulnsWarning(false);
    const ok = await saveVulnerabilities();
    if (ok) setStep(s => Math.min(LAST_STAGE, s + 1));
  };

  const proceedPastThreatsWarning = async () => {
    setShowThreatsWarning(false);
    const ok = await saveThreats();
    if (ok) setStep(s => Math.min(LAST_STAGE, s + 1));
  };

  const handleBack = () => setStep(s => Math.max(0, s - 1));

  const updateRisk = async (riskId: string, data: RiskUpdate) => {
    try {
      setState(await riskApi.updateRisk(riskId, data));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update risk'));
    }
  };

  const removeRisk = async (riskId: string) => {
    try {
      setState(await riskApi.deleteRisk(riskId));
      toast.success('Risk removed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove risk'));
    }
  };

  const reviewRisks = async (riskIds: string[], reviewed: boolean) => {
    try {
      setState(await riskApi.reviewRisks(stepId, { riskIds, reviewed }));
      toast.success(reviewed ? `${riskIds.length} risk(s) marked as reviewed` : 'Review cleared');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update review'));
    }
  };

  const confirmTreatment = async (riskId: string) => {
    try {
      setState(await riskApi.confirmTreatment(riskId));
      toast.success('Treatment confirmed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Cannot confirm treatment'));
    }
  };

  const decideRisk = async (riskId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) => {
    try {
      setState(await riskApi.approveRisk(riskId, { approval_decision: decision, comment: comment?.trim() || undefined }));
      toast.success(decision === 'APPROVED' ? 'Residual risk approved' : 'Residual risk rejected, sent back for treatment');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record the decision'));
    }
  };

  const createDocs = async () => {
    setIsCreatingDocs(true);
    try {
      const docs = await riskApi.createDocuments(stepId);
      setDocuments(docs);
      setState(await riskApi.getRegister(stepId)); // refreshes the completion checklist
      toast.success('Report generated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate the report'));
    } finally {
      setIsCreatingDocs(false);
    }
  };

  const totalSelectedVulns = useMemo(() => {
    let total = 0;
    Object.values(selectedVulnsByAsset).forEach(s => total += s.size);
    return total;
  }, [selectedVulnsByAsset]);

  const assetsByCategory = useMemo(() => {
    const map = new Map<string, string[]>();
    Object.keys(CATEGORY_LABELS).forEach(cat => map.set(cat, []));
    Array.from(selectedAssets).forEach(name => {
      const category = state?.assets.find(a => a.name === name)?.category;
      if (category) map.get(category)?.push(name);
    });
    return map;
  }, [selectedAssets, state]);

  const globalVulnList = useMemo(() => {
    const seen = new Set<string>();
    return [...(seed?.vulnerabilities ?? []), ...customVulns].filter(v => {
      const already = seen.has(v.name);
      seen.add(v.name);
      return !already;
    });
  }, [seed?.vulnerabilities, customVulns]);

  const filteredGlobalVulns = useMemo(() => {
    const q = vulnSearch.trim().toLowerCase();
    if (!q) return globalVulnList;
    return globalVulnList.filter(v => v.name.toLowerCase().includes(q));
  }, [globalVulnList, vulnSearch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!seed || !state) {
    return <p className="text-sm text-muted-foreground">Unable to load the risk register.</p>;
  }

  const assetsForSelection = [...(seed?.assets ?? []), ...customAssets];

  // vulnerability catalog for a given asset (matching by the asset's category)
  const allVulns = [...(seed?.vulnerabilities ?? []), ...customVulns];
  const vulnsForAsset = (assetName: string) => {
    const assetCategory = state?.assets.find(a => a.name === assetName)?.category;
    return allVulns.filter(v => v.category === assetCategory);
  };

  const { summary } = state;

  return (
    <div className="space-y-4">
      {/* Register information (Conformio: number of risks / unacceptable risks) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {([
          ['Risks', summary.total],
          ['Unacceptable', summary.unacceptable],
          ['Evaluated', `${summary.evaluated}/${summary.total}`],
          ['Reviewed', `${summary.reviewed}/${summary.total}`],
          ['Treated', `${summary.treated}/${summary.unacceptable}`],
          ['Approved', `${summary.approved}/${summary.total}`],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {!canEdit && (
        <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          You have read-only access to this register (auditor).
        </p>
      )}

      {/* Step navigator */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            {STEP_TITLES.map((t, i) => (
              <button
                key={t}
                onClick={() => (i < step || !canEdit) && setStep(i)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === step
                    ? 'bg-[var(--brand-orange)] text-white'
                    : i < step
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 cursor-pointer'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : null}
                {i + 1}. {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ============ STEP 1: ASSETS ============ */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Select Assets</CardTitle>
                <CardDescription className="mt-2 max-w-3xl leading-relaxed">
                  <span className="font-semibold">General info</span>
                  <br />
                  This register is where you will need to list potential bad things that can happen to the information in your company (i.e. list the risks), assess how big those risks are, and figure out how to manage those risks.
                  <br /><br />
                  <span className="font-semibold">Asset entry</span>
                  <br />
                  For the initial risk assessment we recommend selecting up to 30 assets.
                  Select all the assets you have in your company that contain information, or can influence the information in your company.
                  Add the ones you cannot find in the list. Once you entered all the assets, click the button Next below.
                </CardDescription>
              </div>
              <Badge className="shrink-0 text-sm bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]">
                Assets ({selectedAssets.size} / 30)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">Please select your assets:</p>
            <p className="text-sm text-muted-foreground -mt-4">We recommend selecting up to 30 assets, at least one from each category:</p>

            {Object.keys(CATEGORY_LABELS).map((cat) => {
              const templateItems = seed.assets.filter(a => a.category === cat);
              const customInCat = customAssets.filter(a => a.category === cat);
              if (templateItems.length === 0 && customInCat.length === 0) return null;
              return (
                <div key={cat} className="border-t border-border/60 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">{CATEGORY_LABELS[cat]}</p>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {templateItems.filter(a => selectedAssets.has(a.name)).length + customInCat.filter(a => selectedAssets.has(a.name)).length} / {templateItems.length + customInCat.length}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {templateItems.map((a) => (
                      <ToggleChip
                        key={a.name}
                        active={selectedAssets.has(a.name)}
                        onClick={() => {
                          setSelectedAssets(prev => {
                            const next = new Set(prev);
                            if (next.has(a.name)) next.delete(a.name); else next.add(a.name);
                            return next;
                          });
                        }}
                      >
                        {a.name}
                      </ToggleChip>
                    ))}
                    {customInCat.map((a) => (
                      <div key={a.name} className="rounded-lg border border-dashed border-[var(--brand-orange)] bg-[var(--brand-orange)]/5 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[var(--brand-orange)]">+</span>{a.name}
                            <Badge className="bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]">Custom</Badge>
                          </span>
                          <button
                            onClick={() => {
                              setCustomAssets(prev => prev.filter(x => x.name !== a.name));
                              setSelectedAssets(prev => {
                                const next = new Set(prev);
                                next.delete(a.name);
                                return next;
                              });
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {openAddCategory === cat ? (
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <Input
                        className="sm:max-w-md"
                        placeholder="Asset name"
                        value={newAssetName}
                        onChange={(e) => setNewAssetName(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const name = newAssetName.trim();
                            if (!name) return;
                            if (assetsForSelection.some(a => a.name === name)) {
                              toast.error('This asset already exists');
                              return;
                            }
                            setCustomAssets(prev => [...prev, { name, category: cat }]);
                            setSelectedAssets(prev => new Set(prev).add(name));
                            setNewAssetName('');
                            setOpenAddCategory(null);
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" />Done
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setOpenAddCategory(null); setNewAssetName(''); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="mt-2 text-sm font-medium text-[var(--brand-orange)] hover:underline"
                      onClick={() => setOpenAddCategory(cat)}
                    >
                      + Add Asset not listed in this category
                    </button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ============ STEP 2: VULNERABILITIES ============ */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Select Vulnerabilities</CardTitle>
                <CardDescription className="mt-2 max-w-3xl leading-relaxed">
                  <span className="font-semibold">Vulnerability entry</span>
                  <br />
                  For the initial risk assessment we recommend defining up to 8 vulnerabilities per asset.
                  <br /><br />
                  For each asset you selected in the previous step you&apos;ll see some suggested vulnerabilities - select the ones you feel are appropriate in your situation. Vulnerability is a reason why a risk can happen - e.g. a threat &quot;Malware attack&quot; is possible if vulnerability &quot;Lack of or not updated anti-virus software&quot; exists. If there is no vulnerability, a threat cannot materialize.
                  <br /><br />
                  Once you select at least one vulnerability for each of your assets, click the Next button.
                </CardDescription>
              </div>
              <Badge className="shrink-0 text-sm bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]">
                Vulnerabilities ({totalSelectedVulns} / {8 * selectedAssets.size})
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              We recommend selecting up to {8 * selectedAssets.size} vulnerabilities. For each asset selected there is a list of suggestions depending on its category - the assets are grouped below by category.
            </p>

            {Object.keys(CATEGORY_LABELS).map((cat) => {
              const assetsInCat = assetsByCategory.get(cat) ?? [];
              if (assetsInCat.length === 0) return null;
              const coveredCount = assetsInCat.filter(name => (selectedVulnsByAsset[name]?.size ?? 0) > 0).length;
              const totalCatVulns = assetsInCat.reduce((sum, name) => sum + (selectedVulnsByAsset[name]?.size ?? 0), 0);
              return (
                <div key={cat} className="border-t border-border/60 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">{CATEGORY_LABELS[cat]}</p>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {coveredCount} assets covered · {totalCatVulns} vulnerabilities
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {assetsInCat.map((assetName) => {
                      const expanded = expandedAsset.has(assetName);
                      const vulns = vulnsForAsset(assetName);
                      const selected = selectedVulnsByAsset[assetName] ?? new Set<string>();
                      const hasAny = selected.size > 0;
                      return (
                        <div key={assetName} className="rounded-lg border border-border/60">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedAsset(prev => {
                                const next = new Set(prev);
                                if (next.has(assetName)) next.delete(assetName); else next.add(assetName);
                                return next;
                              });
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-accent/50"
                          >
                            <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                            <span className="flex-1">{assetName}</span>
                            <Badge className={hasAny ? 'bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]' : 'bg-muted text-muted-foreground'}>
                              {selected.size} / {vulns.length}
                            </Badge>
                          </button>
                          {expanded && (
                            <div className="px-4 pb-4 pt-1">
                              {vulns.length > 0 ? (
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {vulns.map((v) => (
                                    <ToggleChip
                                      key={v.name}
                                      active={selected.has(v.name)}
                                      onClick={() => {
                                        setSelectedVulnsByAsset(prev => {
                                          const set = new Set(prev[assetName] ?? []);
                                          if (set.has(v.name)) set.delete(v.name); else set.add(v.name);
                                          return { ...prev, [assetName]: set };
                                        });
                                      }}
                                    >
                                      {v.name}
                                    </ToggleChip>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No suggested vulnerabilities for this asset&apos;s category.</p>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setAddVulnFor(assetName);
                                  setVulnSearch('');
                                  setShowNewVuln(false);
                                  setNewVulnStep(0);
                                  setNewVulnFormName('');
                                  setNewVulnFormCategory('');
                                  setNewVulnControls(new Set());
                                  setNewVulnControlSearch('');
                                }}
                                className="mt-3 text-sm font-medium text-[var(--brand-orange)] hover:underline"
                              >
                                + Add new vulnerability
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ============ STEP 3: THREATS ============ */}
      {step === 2 && (
        <ThreatStage
          state={state}
          seed={seed}
          selectedVulnsByAsset={selectedVulnsByAsset}
          selected={selectedThreatsByPair}
          setSelected={setSelectedThreatsByPair}
          customThreats={customThreats}
          setCustomThreats={setCustomThreats}
        />
      )}

      {step === 3 && (
        <EvaluationStage state={state} seed={seed} onUpdate={updateRisk} onRemove={removeRisk} />
      )}

      {step === 4 && <ReviewStage state={state} seed={seed} onReview={reviewRisks} />}

      {step === 5 && (
        <TreatmentStage state={state} seed={seed} onUpdate={updateRisk} onConfirm={confirmTreatment} />
      )}

      {step === 6 && (
        <ApprovalStage
          state={state}
          seed={seed}
          onDecide={decideRisk}
          documents={documents}
          onCreateDocs={createDocs}
          isCreatingDocs={isCreatingDocs}
          documentHref={(id) => `/dashboard/organizations/${orgId}/projects/${projectId}/documents/${id}`}
        />
      )}

      {/* Threats warning modal */}
      {showThreatsWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowThreatsWarning(false)} />
          <div className="relative rounded-xl shadow-xl border w-full max-w-md p-6 space-y-4" style={{ backgroundColor: '#F4F1EA' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">Warning</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You did not add threats to each vulnerability ({pairsMissingThreats.length} without a threat) - if you proceed, your risk assessment will not be complete, and you might fail the certification.
            </p>
            <p className="text-sm font-medium">Do you want to proceed to the next screen?</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowThreatsWarning(false)}>No, go back</Button>
              <Button onClick={proceedPastThreatsWarning} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Yes, proceed
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation warning modal */}
      {showEvalWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEvalWarning(false)} />
          <div className="relative rounded-xl shadow-xl border w-full max-w-md p-6 space-y-4" style={{ backgroundColor: '#F4F1EA' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">Warning</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Some risks are empty ({summary.total - summary.evaluated}), please fill in missing data (impact, likelihood and risk owner). You can use the filter to show only empty risks.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowEvalWarning(false)}>Go back</Button>
              <Button onClick={() => { setShowEvalWarning(false); setStep(4); }}>Proceed anyway</Button>
            </div>
          </div>
        </div>
      )}

      {/* Assets category warning modal */}
      {showAssetsWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAssetsWarning(false)} />
          <div className="relative rounded-xl shadow-xl border w-full max-w-md p-6 space-y-4" style={{ backgroundColor: '#F4F1EA' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">Warning</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You did not add assets from each category of assets - if you proceed, your risk assessment will not be complete, and you might fail the certification.
            </p>
            <p className="text-sm font-medium">Do you want to proceed to the next screen?</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAssetsWarning(false)}>No, go back</Button>
              <Button onClick={proceedPastAssetsWarning} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Yes, proceed
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vulnerabilities warning modal */}
      {showVulnsWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowVulnsWarning(false)} />
          <div className="relative rounded-xl shadow-xl border w-full max-w-md p-6 space-y-4" style={{ backgroundColor: '#F4F1EA' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold">Warning</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You did not add vulnerabilities to each asset - if you proceed, your risk assessment will not be complete, and you might fail the certification.
            </p>
            <p className="text-sm font-medium">Do you want to proceed to the next screen?</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowVulnsWarning(false)}>No, go back</Button>
              <Button onClick={proceedPastVulnsWarning} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Yes, proceed
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add vulnerability dialog */}
      {addVulnFor && !showNewVuln && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAddVulnFor(null)} />
          <div className="relative rounded-xl shadow-xl border w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col overflow-y-auto [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [scrollbar-width:thin] [scrollbar-color:#9ca3af_#f3f4f6]" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add a vulnerability</h2>
                <p className="text-sm text-gray-600 mt-1">
                  To add a vulnerability to the asset <span className="font-medium text-gray-900">{addVulnFor}</span>, please select one from the list below, or create a new vulnerability.
                </p>
              </div>
              <button onClick={() => setAddVulnFor(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <Input
              placeholder="Search for Vulnerabilities"
              value={vulnSearch}
              onChange={(e) => setVulnSearch(e.target.value)}
              className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
            />
            <p className="text-xs font-medium text-gray-600">
              {(selectedVulnsByAsset[addVulnFor]?.size ?? 0)} selected for this asset
            </p>
            <div className="overflow-y-auto border rounded-lg bg-white [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-gray-400 [&::-webkit-scrollbar-track]:bg-gray-100 [scrollbar-width:thin] [scrollbar-color:#9ca3af_#f3f4f6]">
              {filteredGlobalVulns.map((v) => {
                const selected = selectedVulnsByAsset[addVulnFor]?.has(v.name) ?? false;
                return (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => {
                      setSelectedVulnsByAsset(prev => {
                        const set = new Set(prev[addVulnFor] ?? []);
                        if (set.has(v.name)) set.delete(v.name); else set.add(v.name);
                        return { ...prev, [addVulnFor]: set };
                      });
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${selected ? 'font-medium text-[var(--brand-orange)]' : 'text-gray-900'}`}
                  >
                    {selected ? <Check className="h-4 w-4 shrink-0 text-[var(--brand-orange)]" /> : <span className="h-4 w-4 shrink-0" />}
                    <span>{v.name}</span>
                    {customVulns.some(c => c.name === v.name) && (
                      <Badge className="ml-auto bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]">Custom</Badge>
                    )}
                  </button>
                );
              })}
              {filteredGlobalVulns.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-600">No vulnerabilities match your search.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowNewVuln(true);
                setNewVulnStep(0);
                setNewVulnFormName('');
                setNewVulnFormCategory(state.assets.find(a => a.name === addVulnFor)?.category ?? '');
                setNewVulnControls(new Set());
                setNewVulnControlSearch('');
              }}
              className="w-full py-2.5 text-sm font-semibold text-[var(--brand-orange)] rounded-lg border border-[var(--brand-orange)] bg-transparent hover:bg-[var(--brand-orange)]/5"
            >
              CREATE A NEW VULNERABILITY
            </button>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAddVulnFor(null)}>Cancel</Button>
              <Button onClick={() => setAddVulnFor(null)} disabled={(selectedVulnsByAsset[addVulnFor]?.size ?? 0) === 0}>
                Add ({selectedVulnsByAsset[addVulnFor]?.size ?? 0})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New vulnerability wizard */}
      {addVulnFor && showNewVuln && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewVuln(false)} />
          <div className="relative rounded-xl shadow-xl border w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col overflow-y-auto [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [scrollbar-width:thin] [scrollbar-color:#9ca3af_#f3f4f6]" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New vulnerability</h2>
              <button onClick={() => setShowNewVuln(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {newVulnStep === 0 && (
              <>
                <p className="text-sm font-semibold text-gray-900">Step 1: Vulnerability Data</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  To create a new vulnerability, please specify its name (it needs to be related to the category displayed below).
                </p>
                <div>
                  <Label className="text-gray-900">Vulnerability name *</Label>
                  <Input
                    className="mt-1 bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                    placeholder="Please specify..."
                    value={newVulnFormName}
                    onChange={(e) => setNewVulnFormName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-gray-900">Category</Label>
                  <NativeSelect
                    className="mt-1 bg-white text-gray-900"
                    value={newVulnFormCategory}
                    onChange={(e) => setNewVulnFormCategory(e.target.value)}
                  >
                    <option value="">select your category</option>
                    {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowNewVuln(false)}>Cancel</Button>
                  <Button onClick={() => newVulnFormName.trim() && setNewVulnStep(1)} disabled={!newVulnFormName.trim()}>next</Button>
                </div>
              </>
            )}

            {newVulnStep === 1 && (
              <>
                <p className="text-sm font-semibold text-gray-900">Step 2: Applicable Controls</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Select at least one control that you consider applicable to this new vulnerability.
                </p>
                <Input
                  placeholder="Search for controls..."
                  value={newVulnControlSearch}
                  onChange={(e) => setNewVulnControlSearch(e.target.value)}
                  className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                />
                <div className="overflow-y-auto border rounded-lg bg-white [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-gray-400 [&::-webkit-scrollbar-track]:bg-gray-100 [scrollbar-width:thin] [scrollbar-color:#9ca3af_#f3f4f6]">
                  {seed.controls
                    .filter((c) => !newVulnControlSearch.trim() || c.title.toLowerCase().includes(newVulnControlSearch.trim().toLowerCase()))
                    .map((c) => {
                      const selected = newVulnControls.has(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setNewVulnControls(prev => {
                              const next = new Set(prev);
                              if (next.has(c.code)) next.delete(c.code); else next.add(c.code);
                              return next;
                            });
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${selected ? 'font-medium text-[var(--brand-orange)]' : 'text-gray-900'}`}
                        >
                          {selected ? <Check className="h-4 w-4 shrink-0 text-[var(--brand-orange)]" /> : <span className="h-4 w-4 shrink-0" />}
                          <span>{c.title}</span>
                        </button>
                      );
                    })}
                </div>
                <div className="flex justify-between gap-3 pt-2">
                  <Button variant="outline" onClick={() => setNewVulnStep(0)}>back</Button>
                  <Button
                    onClick={() => {
                      if (!addVulnFor) return;
                      const name = newVulnFormName.trim();
                      const category = newVulnFormCategory;
                      setCustomVulns(prev => [...prev, { name, category, applicable_controls: Array.from(newVulnControls) }]);
                      setSelectedVulnsByAsset(prev => ({
                        ...prev,
                        [addVulnFor]: new Set(prev[addVulnFor] ?? []).add(name),
                      }));
                      setAddVulnFor(null);
                      setShowNewVuln(false);
                      toast.success('New vulnerability created');
                    }}
                    disabled={newVulnControls.size === 0}
                  >
                    Create
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />Back
        </Button>
        {step < LAST_STAGE ? (
          <Button onClick={handleNext} disabled={!canProceed || isSaving}
            title={step === 5 && !canProceed ? 'Confirm the treatment of every unacceptable risk first' : undefined}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronRight className="h-4 w-4 mr-1" />}
            {canEdit && step <= 2 ? 'Save & Continue' : 'Next'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
