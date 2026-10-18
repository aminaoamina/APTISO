import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ISO_REQUIREMENTS } from '../audit-prep/iso-requirements';

export interface CatalogEntry {
  ref: string;
  kind: 'clause' | 'control';
  title: string;
}

/**
 * ISO/IEC 27001:2022 reference catalog: clauses 4-10 and the Annex A controls
 * (risk_controls). Every clause or control ID the AI returns is resolved here;
 * anything else (e.g. a 2013 number such as A.12.3.1) is rejected.
 */
@Injectable()
export class CatalogService {
  private entries: Map<string, CatalogEntry> | null = null;
  private byTitle = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async all() {
    return [...(await this.load()).values()];
  }

  async get(ref: string) {
    return (await this.load()).get(ref) ?? null;
  }

  /**
   * "A.5.15", "a 5.15", "5.15", "Access control" → "A.5.15"; "9.2.2" → "9.2.2"
   * (a sub-clause of 9.2). Returns null for anything that is not in ISO/IEC 27001:2022.
   */
  async resolve(input: string): Promise<string | null> {
    const entries = await this.load();
    const raw = input.trim();
    const title = this.byTitle.get(raw.toLowerCase());
    if (title) return title;
    const m = raw.toUpperCase().replace(/^(CLAUSE|CONTROL)\s+/, '').match(/^(A)?[\s.]*(\d+(?:\.\d+)*)/);
    if (!m) return null;
    const [, annex, num] = m;
    if (annex) return entries.has(`A.${num}`) ? `A.${num}` : null;
    // Clauses first (5.1 is a clause); otherwise a bare control number such as 5.15.
    const parts = num.split('.');
    for (let n = parts.length; n >= 2; n--) if (entries.get(parts.slice(0, n).join('.'))?.kind === 'clause') return num;
    return entries.has(`A.${num}`) ? `A.${num}` : null;
  }

  /** Resolves a list, returning the IDs and an error for each unknown one. */
  async resolveAll(inputs: string[]) {
    const refs: string[] = [];
    const errors: string[] = [];
    for (const input of inputs) {
      const ref = await this.resolve(input);
      if (ref) refs.push(ref);
      else errors.push(`"${input}" is not an ISO/IEC 27001:2022 clause or Annex A control`);
    }
    return { refs: [...new Set(refs)], errors };
  }

  private async load() {
    if (this.entries) return this.entries;
    const controls = await this.prisma.riskControl.findMany({ select: { code: true, title: true } });
    const entries = new Map<string, CatalogEntry>();
    for (const r of ISO_REQUIREMENTS) entries.set(r.ref, { ref: r.ref, kind: 'clause', title: r.requirement });
    for (const c of controls) entries.set(c.code, { ref: c.code, kind: 'control', title: c.title });
    this.byTitle = new Map([...entries.values()].map(e => [e.title.toLowerCase(), e.ref]));
    this.entries = entries;
    return entries;
  }
}
