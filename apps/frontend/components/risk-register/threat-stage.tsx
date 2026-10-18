'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronRight, Shield, X } from 'lucide-react';
import type { RiskRegisterState, RiskSeedData } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';

export const THREAT_CATEGORY_LABELS: Record<string, string> = {
  FORCE_MAJEURE: 'Force majeure & threats from the environment',
  INTERNAL_OVERSIGHT: 'Internal organizational oversight',
  UNINTENTIONAL_MISTAKE: 'Unintentional human mistake',
  MALICIOUS_INTENT: 'Malicious intent',
  TECHNICAL_ERROR: 'Technical error',
};

const ASSET_CATEGORY_LABELS: Record<string, string> = {
  INFRASTRUCTURE: 'Infrastructure',
  IT_COMMUNICATION: 'IT and communication equipment',
  SOFTWARE_DATABASE: 'Software & databases',
  DOCUMENTS_DATA: 'Other documents and data',
  HUMAN_RESOURCES: 'Human resources',
  THIRD_PARTY: 'Third-party services',
};

export type CustomThreat = { name: string; threat_category: string; applicable_controls?: string[] };

/** Key of an asset + vulnerability combination in the local selection map. */
export const threatPairKey = (assetName: string, vulnName: string) => `${assetName}||${vulnName}`;

const THREATS_PER_PAIR = 3;

function Chip({ active, onClick, disabled, children }: {
  active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${
        active
          ? 'border-[var(--brand-orange)] bg-[var(--brand-orange)]/10 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-accent'
      }`}>
      {active ? <Check className="h-4 w-4 shrink-0 text-[var(--brand-orange)]" /> : <span className="h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </button>
  );
}

export function ThreatStage({
  state,
  seed,
  selectedVulnsByAsset,
  selected,
  setSelected,
  customThreats,
  setCustomThreats,
}: {
  state: RiskRegisterState;
  seed: RiskSeedData;
  selectedVulnsByAsset: Record<string, Set<string>>;
  selected: Record<string, Set<string>>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, Set<string>>>>;
  customThreats: CustomThreat[];
  setCustomThreats: React.Dispatch<React.SetStateAction<CustomThreat[]>>;
}) {
  const canEdit = state.permissions.canEdit;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogPair, setDialogPair] = useState<{ asset: string; vuln: string } | null>(null);

  const allThreats = useMemo(() => {
    const seen = new Set<string>();
    return [...seed.threats.map(t => ({ name: t.name, category: t.category })),
      ...customThreats.map(t => ({ name: t.name, category: t.threat_category }))]
      .filter(t => (seen.has(t.name) ? false : (seen.add(t.name), true)));
  }, [seed.threats, customThreats]);
  const threatCategory = useMemo(() => new Map(allThreats.map(t => [t.name, t.category])), [allThreats]);

  const pairs = state.assets.flatMap(a =>
    [...(selectedVulnsByAsset[a.name] ?? [])].map(v => ({ asset: a, vuln: v })),
  );
  const totalSelected = pairs.reduce((n, p) => n + (selected[threatPairKey(p.asset.name, p.vuln)]?.size ?? 0), 0);

  const suggestionsFor = (assetCategory: string, vulnName: string) => {
    const list = [
      ...(seed.suggestions.threatsByVulnerability[vulnName] ?? []),
      ...(seed.suggestions.threatsByAssetCategory[assetCategory] ?? []),
    ];
    return [...new Set(list)];
  };

  const toggle = (assetName: string, vulnName: string, threat: string) => {
    const key = threatPairKey(assetName, vulnName);
    setSelected(prev => {
      const set = new Set(prev[key] ?? []);
      if (set.has(threat)) set.delete(threat); else set.add(threat);
      return { ...prev, [key]: set };
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Select Threats</CardTitle>
            <CardDescription className="mt-2 max-w-3xl leading-relaxed">
              <span className="font-semibold">Threat entry</span><br />
              For the initial risk assessment we recommend defining up to {THREATS_PER_PAIR} threats per vulnerability-asset combination.
              <br /><br />
              For each vulnerability you selected in the previous step you&apos;ll see some suggested threats — select the ones you feel are appropriate in your situation and/or add new threats if needed.
              A threat is what kind of negative thing can happen to your asset because the vulnerability exists.
              <br /><br />
              Once you select at least one threat for each of your vulnerabilities, click the Next button.
            </CardDescription>
          </div>
          <Badge className="shrink-0 text-sm bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]">
            Threats ({totalSelected} / {THREATS_PER_PAIR * pairs.length})
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.keys(ASSET_CATEGORY_LABELS).map(cat => {
          const assets = state.assets.filter(a => a.category === cat && (selectedVulnsByAsset[a.name]?.size ?? 0) > 0);
          if (assets.length === 0) return null;
          return (
            <div key={cat} className="border-t border-border/60 pt-4 space-y-2">
              <p className="text-sm font-semibold">{ASSET_CATEGORY_LABELS[cat]}</p>
              {assets.map(asset => {
                const vulns = [...(selectedVulnsByAsset[asset.name] ?? [])];
                const covered = vulns.filter(v => (selected[threatPairKey(asset.name, v)]?.size ?? 0) > 0).length;
                const open = expanded.has(asset.name);
                return (
                  <div key={asset.id} className="rounded-lg border border-border/60">
                    <button type="button" aria-expanded={open}
                      onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(asset.name)) n.delete(asset.name); else n.add(asset.name); return n; })}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-accent/50">
                      <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                      <span className="flex-1">{asset.name}</span>
                      <Badge className={covered === vulns.length ? 'bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]' : 'bg-muted text-muted-foreground'}>
                        {covered} / {vulns.length} vulnerabilities covered
                      </Badge>
                    </button>
                    {open && (
                      <div className="space-y-4 px-4 pb-4 pt-1">
                        {vulns.map(vuln => {
                          const key = threatPairKey(asset.name, vuln);
                          const chosen = selected[key] ?? new Set<string>();
                          const suggested = suggestionsFor(asset.category, vuln);
                          const extra = [...chosen].filter(t => !suggested.includes(t));
                          return (
                            <div key={vuln} className="space-y-2">
                              <p className="text-sm">
                                <span className="text-muted-foreground">Vulnerability:</span> <span className="font-medium">{vuln}</span>
                                {chosen.size === 0 && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">no threat selected</span>}
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {[...suggested, ...extra].map(t => (
                                  <Chip key={t} active={chosen.has(t)} disabled={!canEdit} onClick={() => toggle(asset.name, vuln, t)}>
                                    <span className="block">{t}</span>
                                    <span className="block text-xs text-muted-foreground mt-0.5">{THREAT_CATEGORY_LABELS[threatCategory.get(t) ?? ''] ?? 'Custom'}</span>
                                  </Chip>
                                ))}
                              </div>
                              {canEdit && (
                                <button type="button" onClick={() => setDialogPair({ asset: asset.name, vuln })}
                                  className="text-sm font-medium text-[var(--brand-orange)] hover:underline">
                                  + Add a new threat
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {pairs.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">Select vulnerabilities for your assets first.</p>
        )}
      </CardContent>

      {dialogPair && (
        <AddThreatDialog
          pair={dialogPair}
          allThreats={allThreats}
          controls={seed.controls}
          chosen={selected[threatPairKey(dialogPair.asset, dialogPair.vuln)] ?? new Set()}
          onToggle={(t) => toggle(dialogPair.asset, dialogPair.vuln, t)}
          onCreate={(t) => {
            setCustomThreats(prev => [...prev, t]);
            toggle(dialogPair.asset, dialogPair.vuln, t.name);
          }}
          onClose={() => setDialogPair(null)}
        />
      )}
    </Card>
  );
}

function AddThreatDialog({
  pair,
  allThreats,
  controls,
  chosen,
  onToggle,
  onCreate,
  onClose,
}: {
  pair: { asset: string; vuln: string };
  allThreats: { name: string; category: string }[];
  controls: { code: string; title: string }[];
  chosen: Set<string>;
  onToggle: (threat: string) => void;
  onCreate: (threat: CustomThreat) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'pick' | 'name' | 'controls'>('pick');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [controlSearch, setControlSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = allThreats.filter(t => !q || t.name.toLowerCase().includes(q));
  const cq = controlSearch.trim().toLowerCase();
  const filteredControls = controls.filter(c => !cq || c.code.toLowerCase().includes(cq) || c.title.toLowerCase().includes(cq));
  const scrollbox = 'overflow-y-auto border rounded-lg bg-white max-h-72';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="add-threat-title"
        className="relative w-full max-w-lg space-y-4 rounded-xl border bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h2 id="add-threat-title" className="text-lg font-semibold text-gray-900">
            {mode === 'pick' ? 'Add a threat' : 'New threat'}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-gray-500 hover:text-gray-900"><X className="h-5 w-5" /></button>
        </div>

        {mode === 'pick' && (
          <>
            <p className="text-sm text-gray-600">
              To add a threat to the vulnerability <span className="font-medium text-gray-900">{pair.vuln}</span> of <span className="font-medium text-gray-900">{pair.asset}</span>, select one from the list below, or create a new threat.
            </p>
            <Input placeholder="Search for threats" value={search} onChange={(e) => setSearch(e.target.value)}
              className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400" />
            <div className={scrollbox}>
              {filtered.map(t => {
                const active = chosen.has(t.name);
                return (
                  <button key={t.name} type="button" onClick={() => onToggle(t.name)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${active ? 'font-medium text-[var(--brand-orange)]' : 'text-gray-900'}`}>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                    <span className="flex-1">{t.name}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="px-3 py-2 text-sm text-gray-600">No threats match your search.</p>}
            </div>
            <button type="button" onClick={() => setMode('name')}
              className="w-full rounded-lg border border-[var(--brand-orange)] py-2.5 text-sm font-semibold text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/5">
              CREATE A NEW THREAT
            </button>
            <div className="flex justify-end"><Button onClick={onClose}>Done ({chosen.size})</Button></div>
          </>
        )}

        {mode === 'name' && (
          <>
            <p className="text-sm font-semibold text-gray-900">Step 1: Threat data</p>
            <p className="text-sm text-gray-600">If you did not find an appropriate threat in the list, add it here, together with the applicable category.</p>
            <div>
              <Label htmlFor="new-threat-name" className="text-gray-900">Threat name *</Label>
              <Input id="new-threat-name" className="mt-1 bg-white text-gray-900 border-gray-300" placeholder="Please specify..."
                value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label htmlFor="new-threat-category" className="text-gray-900">Threat category *</Label>
              <NativeSelect id="new-threat-category" className="mt-1 bg-white text-gray-900" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select a category</option>
                {Object.entries(THREAT_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </NativeSelect>
            </div>
            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setMode('pick')}>Back</Button>
              <Button disabled={!name.trim() || !category}
                onClick={() => {
                  if (allThreats.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
                    toast.error('This threat already exists — select it from the list');
                    return;
                  }
                  setMode('controls');
                }}>
                Next
              </Button>
            </div>
          </>
        )}

        {mode === 'controls' && (
          <>
            <p className="text-sm font-semibold text-gray-900">Step 2: Applicable controls</p>
            <p className="text-sm text-gray-600">
              Threat: <span className="font-medium text-gray-900">{name.trim()}</span> ({THREAT_CATEGORY_LABELS[category]}).
              Select at least one control that you deem applicable to this threat.
            </p>
            <Input placeholder="Search for controls..." value={controlSearch} onChange={(e) => setControlSearch(e.target.value)}
              className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400" />
            <div className={scrollbox}>
              {filteredControls.map(c => {
                const active = picked.has(c.code);
                return (
                  <button key={c.code} type="button"
                    onClick={() => setPicked(prev => { const n = new Set(prev); if (n.has(c.code)) n.delete(c.code); else n.add(c.code); return n; })}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${active ? 'font-medium text-[var(--brand-orange)]' : 'text-gray-900'}`}>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                    <span><span className="font-medium">{c.code}</span> {c.title}</span>
                  </button>
                );
              })}
            </div>
            {picked.size === 0 && <p className="text-xs text-gray-600">You must select at least one control.</p>}
            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setMode('name')}>Back</Button>
              <Button disabled={picked.size === 0}
                onClick={() => {
                  onCreate({ name: name.trim(), threat_category: category, applicable_controls: [...picked] });
                  toast.success('New threat created');
                  onClose();
                }}>
                Create
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
