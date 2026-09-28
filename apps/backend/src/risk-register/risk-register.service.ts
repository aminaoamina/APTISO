import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AuditAction, Prisma, ProjectRole, TreatmentOption } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import {
  ProseMirrorNode,
  text,
  paragraph,
  heading,
  table,
  bulletList,
} from '../documents/templates/doc-control.template';
import {
  ASSET_CATALOG,
  VULNERABILITY_CATALOG,
  THREAT_CATALOG,
  ASSET_CATEGORY_LABELS,
  RISK_SCALE,
  riskLevel,
  isAcceptableLevel,
} from './constants';
import {
  assertCatalogConsistency,
  CATEGORY_THREAT_SUGGESTIONS,
  THREAT_CONTROL_SUGGESTIONS,
  VULNERABILITY_SUGGESTIONS,
} from './catalog-suggestions';
import {
  ReviewRisksDto,
  RiskApprovalDto,
  RiskApprovalRequestDto,
  SaveAssetsDto,
  SaveThreatsDto,
  SaveVulnerabilitiesDto,
  UpdateRiskDto,
} from './dto/risk.dto';

const REPORT_TEMPLATE_CODE = 'RISK-REPORT';
const METHODOLOGY_STEP_KEY = 'iso27001.p2s1.risk-methodology';

const TREATMENT_LABELS: Record<TreatmentOption, string> = {
  DECREASE: 'Decrease the risk using safeguards (controls)',
  TRANSFER: 'Transfer the risk to a third party',
  AVOID: 'Avoid the risk',
  ACCEPT: 'Accept the risk',
};

const USER_SELECT = { id: true, first_name: true, last_name: true, email: true } as const;

const RISK_INCLUDE = {
  asset: { select: { id: true, name: true, category: true } },
  vulnerability: { select: { id: true, name: true } },
  threat: { select: { id: true, name: true, threat_category: true } },
  risk_owner: { select: USER_SELECT },
  asset_owner: { select: USER_SELECT },
  approval_user: { select: USER_SELECT },
  treatment_controls_link: {
    include: { control: { select: { id: true, code: true, title: true } } },
    orderBy: { control: { code: 'asc' } },
  },
} satisfies Prisma.RiskItemInclude;

type RiskWithRelations = Prisma.RiskItemGetPayload<{ include: typeof RISK_INCLUDE }>;

type Access = { stepId: string; projectId: string; role: ProjectRole };

const pairKey = (assetId: string, vulnerabilityId: string) => `${assetId}:${vulnerabilityId}`;

@Injectable()
export class RiskRegisterService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  onModuleInit() {
    assertCatalogConsistency([...new Set(VULNERABILITY_CATALOG.map(v => v.name))]);
  }

  // ─── Read ──────────────────────────────────────────────────────

  async getSeedCategories(stepId: string, userId: string) {
    await this.ensureAccess(stepId, userId);
    const controls = await this.prisma.riskControl.findMany({
      select: { code: true, title: true },
    });
    controls.sort((a, b) => compareControlCodes(a.code, b.code));
    return {
      assets: ASSET_CATALOG,
      vulnerabilities: VULNERABILITY_CATALOG,
      threats: THREAT_CATALOG,
      controls,
      assetCategories: Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
      scale: {
        min: RISK_SCALE.MIN_VALUE,
        max: RISK_SCALE.MAX_VALUE,
        maxAcceptableLevel: RISK_SCALE.MAX_ACCEPTABLE_LEVEL,
        labels: RISK_SCALE.VALUE_LABELS,
      },
      suggestions: {
        threatsByVulnerability: Object.fromEntries(
          Object.entries(VULNERABILITY_SUGGESTIONS).map(([v, s]) => [v, s.threats]),
        ),
        threatsByAssetCategory: CATEGORY_THREAT_SUGGESTIONS,
        controlsByVulnerability: Object.fromEntries(
          Object.entries(VULNERABILITY_SUGGESTIONS).map(([v, s]) => [v, s.controls]),
        ),
        controlsByThreat: THREAT_CONTROL_SUGGESTIONS,
      },
    };
  }

  async getRegister(stepId: string, userId: string) {
    const access = await this.ensureAccess(stepId, userId);

    const [assets, vulnerabilities, threats, assetVulnLinks, vulnThreatLinks, risks, projectUsers] =
      await Promise.all([
        this.prisma.riskAsset.findMany({
          where: { step_id: stepId },
          orderBy: [{ category: 'asc' }, { order: 'asc' }],
        }),
        this.prisma.riskVulnerability.findMany({ where: { step_id: stepId } }),
        this.prisma.riskThreat.findMany({ where: { step_id: stepId } }),
        this.prisma.riskAssetVulnLink.findMany({ where: { step_id: stepId } }),
        this.prisma.riskVulnThreatLink.findMany({ where: { step_id: stepId } }),
        this.prisma.riskItem.findMany({
          where: { step_id: stepId },
          include: RISK_INCLUDE,
          orderBy: { created_at: 'asc' },
        }),
        this.getProjectUsers(access.projectId),
      ]);
    const completion = await this.getCompletion(stepId);

    return {
      assets,
      vulnerabilities,
      threats,
      assetVulnLinks,
      vulnThreatLinks,
      risks,
      projectUsers,
      summary: this.summarize(risks),
      completion,
      permissions: {
        role: access.role,
        canEdit: access.role !== ProjectRole.PROJECT_AUDITOR,
        canApproveAny: access.role === ProjectRole.PROJECT_LEAD,
        userId,
      },
    };
  }

  // ─── Stage 1: Assets ───────────────────────────────────────────

  async saveAssets(stepId: string, dto: SaveAssetsDto, userId: string, ipAddress?: string, userAgent?: string) {
    await this.ensureCanEdit(stepId, userId);
    const existing = await this.getSelectedEntities(stepId);

    const requested: { name: string; category: string }[] = [];
    for (const name of new Set(dto.assetNames)) {
      const entry = ASSET_CATALOG.find(a => a.name === name);
      if (entry) requested.push({ name, category: entry.category });
    }
    const customs = dedupeByName(
      (dto.customAssets ?? []).map(c => ({ name: c.name.trim(), category: c.category as string })),
    ).filter(c => c.name && !requested.some(r => r.name === c.name));

    await this.prisma.$transaction(async (tx) => {
      const keep = new Set([...requested, ...customs].map(a => `${a.category}::${a.name}`));
      const toDelete = existing.assets.filter(a => !keep.has(`${a.category}::${a.name}`));
      if (toDelete.length > 0) {
        await tx.riskAsset.deleteMany({ where: { id: { in: toDelete.map(a => a.id) } } });
      }

      let order = 0;
      for (const item of [...requested.map(r => ({ ...r, is_custom: false })), ...customs.map(c => ({ ...c, is_custom: true }))]) {
        const found = existing.assets.find(a => a.name === item.name && a.category === item.category);
        if (found) {
          await tx.riskAsset.update({ where: { id: found.id }, data: { order } });
        } else {
          await tx.riskAsset.create({
            data: {
              step_id: stepId,
              name: item.name,
              category: item.category as never,
              is_custom: item.is_custom,
              order,
            },
          });
        }
        order++;
      }
    });

    await this.log(userId, 'risk_register', stepId, { action: 'save_assets', count: requested.length + customs.length }, ipAddress, userAgent);
    return this.getRegister(stepId, userId);
  }

  // ─── Stage 2: Vulnerabilities ──────────────────────────────────

  async saveVulnerabilities(
    stepId: string,
    dto: SaveVulnerabilitiesDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.ensureCanEdit(stepId, userId);
    const existing = await this.getSelectedEntities(stepId);
    const assetsById = new Map(existing.assets.map(a => [a.id, a]));

    for (const assetId of Object.keys(dto.vulnerabilitiesByAsset)) {
      if (!assetsById.has(assetId)) throw new BadRequestException('Unknown asset in vulnerability selection');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.riskAssetVulnLink.deleteMany({ where: { step_id: stepId } });

      const requestedNames = new Set<string>();
      Object.values(dto.vulnerabilitiesByAsset).forEach(names => names.forEach(n => requestedNames.add(n)));
      const customs = dedupeByName((dto.customVulnerabilities ?? []).map(c => ({ ...c, name: c.name.trim() })));
      customs.forEach(c => requestedNames.add(c.name));

      const customToDelete = existing.vulnerabilities.filter(v => v.is_custom && !requestedNames.has(v.name));
      if (customToDelete.length > 0) {
        await tx.riskVulnerability.deleteMany({ where: { id: { in: customToDelete.map(v => v.id) } } });
      }

      const vulnByName = new Map(
        existing.vulnerabilities.filter(v => !customToDelete.includes(v)).map(v => [v.name, v]),
      );

      // Custom vulnerabilities first, so that a new one selected for an asset in
      // this same request can be linked below.
      for (const c of customs) {
        if (!c.name) continue;
        const found = vulnByName.get(c.name);
        if (found) {
          await tx.riskVulnerability.update({
            where: { id: found.id },
            data: { applicable_controls: c.applicable_controls ?? Prisma.JsonNull },
          });
          continue;
        }
        const created = await tx.riskVulnerability.create({
          data: {
            step_id: stepId,
            name: c.name,
            category: c.category as never,
            is_custom: true,
            applicable_controls: c.applicable_controls ?? Prisma.JsonNull,
          },
        });
        vulnByName.set(c.name, created);
      }

      const links: Prisma.RiskAssetVulnLinkCreateManyInput[] = [];
      for (const [assetId, names] of Object.entries(dto.vulnerabilitiesByAsset)) {
        const asset = assetsById.get(assetId)!;
        for (const name of new Set(names)) {
          let vuln = vulnByName.get(name);
          if (!vuln) {
            // Some catalogue names exist in two categories; prefer the asset's own.
            const entry =
              VULNERABILITY_CATALOG.find(v => v.name === name && v.category === asset.category) ??
              VULNERABILITY_CATALOG.find(v => v.name === name);
            if (!entry) continue;
            vuln = await tx.riskVulnerability.create({
              data: { step_id: stepId, name: entry.name, category: entry.category as never, is_custom: false },
            });
            vulnByName.set(name, vuln);
          }
          links.push({ step_id: stepId, asset_id: assetId, vulnerability_id: vuln.id });
        }
      }
      if (links.length > 0) await tx.riskAssetVulnLink.createMany({ data: links, skipDuplicates: true });

      // Threats chosen for an asset/vulnerability pair that was just removed go too.
      const livePairs = new Set(links.map(l => pairKey(l.asset_id, l.vulnerability_id)));
      const staleThreatLinks = existing.vulnThreatLinks.filter(
        l => !livePairs.has(pairKey(l.asset_id, l.vulnerability_id)),
      );
      if (staleThreatLinks.length > 0) {
        await tx.riskVulnThreatLink.deleteMany({ where: { id: { in: staleThreatLinks.map(l => l.id) } } });
      }

      // Catalogue vulnerabilities no longer used by any asset are dropped
      // (with their threat links), so later stages only show live selections.
      await tx.riskVulnerability.deleteMany({
        where: { step_id: stepId, is_custom: false, asset_links: { none: {} } },
      });
    });

    await this.syncRisks(stepId);
    await this.log(userId, 'risk_register', stepId, { action: 'save_vulnerabilities' }, ipAddress, userAgent);
    return this.getRegister(stepId, userId);
  }

  // ─── Stage 3: Threats ──────────────────────────────────────────

  async saveThreats(stepId: string, dto: SaveThreatsDto, userId: string, ipAddress?: string, userAgent?: string) {
    await this.ensureCanEdit(stepId, userId);
    const existing = await this.getSelectedEntities(stepId);
    const pairs = new Map(
      existing.assetVulnLinks.map(l => [pairKey(l.asset_id, l.vulnerability_id), l]),
    );

    for (const key of Object.keys(dto.threatsByAssetVulnerability)) {
      if (!pairs.has(key)) throw new BadRequestException('Unknown asset/vulnerability pair in threat selection');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.riskVulnThreatLink.deleteMany({ where: { step_id: stepId } });

      const requestedNames = new Set<string>();
      Object.values(dto.threatsByAssetVulnerability).forEach(names => names.forEach(n => requestedNames.add(n)));
      const customs = dedupeByName((dto.customThreats ?? []).map(c => ({ ...c, name: c.name.trim() })));
      customs.forEach(c => requestedNames.add(c.name));

      const customToDelete = existing.threats.filter(t => t.is_custom && !requestedNames.has(t.name));
      if (customToDelete.length > 0) {
        await tx.riskThreat.deleteMany({ where: { id: { in: customToDelete.map(t => t.id) } } });
      }

      const threatByName = new Map(
        existing.threats.filter(t => !customToDelete.includes(t)).map(t => [t.name, t]),
      );

      for (const c of customs) {
        if (!c.name) continue;
        const found = threatByName.get(c.name);
        if (found) {
          await tx.riskThreat.update({
            where: { id: found.id },
            data: { applicable_controls: c.applicable_controls ?? Prisma.JsonNull },
          });
          continue;
        }
        const created = await tx.riskThreat.create({
          data: {
            step_id: stepId,
            name: c.name,
            threat_category: c.threat_category as never,
            is_custom: true,
            applicable_controls: c.applicable_controls ?? Prisma.JsonNull,
          },
        });
        threatByName.set(c.name, created);
      }

      const links: Prisma.RiskVulnThreatLinkCreateManyInput[] = [];
      for (const [key, names] of Object.entries(dto.threatsByAssetVulnerability)) {
        const pair = pairs.get(key)!;
        for (const name of new Set(names)) {
          let threat = threatByName.get(name);
          if (!threat) {
            const entry = THREAT_CATALOG.find(t => t.name === name);
            if (!entry) continue;
            threat = await tx.riskThreat.create({
              data: { step_id: stepId, name: entry.name, threat_category: entry.category as never, is_custom: false },
            });
            threatByName.set(name, threat);
          }
          links.push({
            step_id: stepId,
            asset_id: pair.asset_id,
            vulnerability_id: pair.vulnerability_id,
            threat_id: threat.id,
          });
        }
      }
      if (links.length > 0) await tx.riskVulnThreatLink.createMany({ data: links, skipDuplicates: true });

      await tx.riskThreat.deleteMany({
        where: { step_id: stepId, is_custom: false, vuln_links: { none: {} } },
      });
    });

    await this.syncRisks(stepId);
    await this.log(userId, 'risk_register', stepId, { action: 'save_threats' }, ipAddress, userAgent);
    return this.getRegister(stepId, userId);
  }

  // ─── Stage 4: Build the risk list ──────────────────────────────

  /**
   * Brings the risk list in line with the current asset → vulnerability →
   * threat selections. Existing risks keep their evaluation, treatment and
   * approval; only combinations that no longer exist are removed and only
   * new combinations are added. Safe to call any number of times.
   */
  async generateRisks(stepId: string, userId: string, ipAddress?: string, userAgent?: string) {
    await this.ensureCanEdit(stepId, userId);
    const { assetVulnLinks, vulnThreatLinks } = await this.getSelectedEntities(stepId);

    if (assetVulnLinks.length === 0) throw new BadRequestException('Select vulnerabilities for your assets first');
    if (vulnThreatLinks.length === 0) throw new BadRequestException('Select threats for your vulnerabilities first');

    const result = await this.syncRisks(stepId);
    await this.log(userId, 'risk_register', stepId, { action: 'generate_risks', ...result }, ipAddress, userAgent);
    return this.getRegister(stepId, userId);
  }

  // ─── Stages 5-6: Evaluation and treatment ──────────────────────

  async updateRisk(riskId: string, dto: UpdateRiskDto, userId: string, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.riskItem.findUnique({
      where: { id: riskId },
      include: { asset: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundException('Risk not found');
    const access = await this.ensureCanEdit(existing.step_id, userId);

    const memberIds = new Set((await this.getProjectUsers(access.projectId)).map(u => u.id));
    for (const id of [dto.risk_owner_id, dto.asset_owner_id]) {
      if (id && !memberIds.has(id)) throw new BadRequestException('Owners must be members of this project');
    }

    const data: Prisma.RiskItemUpdateInput = {};
    if (dto.risk_owner_id !== undefined) {
      data.risk_owner = dto.risk_owner_id ? { connect: { id: dto.risk_owner_id } } : { disconnect: true };
    }
    if (dto.asset_owner_id !== undefined) {
      data.asset_owner = dto.asset_owner_id ? { connect: { id: dto.asset_owner_id } } : { disconnect: true };
    }
    if (dto.department !== undefined) data.department = dto.department.trim() || null;
    if (dto.existing_controls !== undefined) data.existing_controls = dto.existing_controls.trim() || null;
    if (dto.comment !== undefined) data.comment = dto.comment.trim() || null;
    if (dto.has_incidents !== undefined) data.has_incidents = dto.has_incidents;
    if (dto.treatment_option !== undefined) data.treatment_option = dto.treatment_option as TreatmentOption;
    if (dto.treatment_description !== undefined) data.treatment_description = dto.treatment_description.trim() || null;
    if (dto.residual_impact !== undefined) data.residual_impact = dto.residual_impact;
    if (dto.residual_likelihood !== undefined) data.residual_likelihood = dto.residual_likelihood;

    // Derived values are always computed here, never accepted from the client.
    const impact = dto.impact ?? existing.impact;
    const likelihood = dto.likelihood ?? existing.likelihood;
    const ownerId = dto.risk_owner_id !== undefined ? dto.risk_owner_id : existing.risk_owner_id;
    if (dto.impact !== undefined) data.impact = dto.impact;
    if (dto.likelihood !== undefined) data.likelihood = dto.likelihood;

    let acceptable: boolean | null = existing.acceptability ? existing.acceptability === 'ACCEPTABLE' : null;
    if (impact != null && likelihood != null) {
      const level = riskLevel(impact, likelihood);
      acceptable = isAcceptableLevel(level);
      data.level = level;
      data.acceptability = acceptable ? 'ACCEPTABLE' : 'NOT_ACCEPTABLE';
      if (!acceptable && existing.treatment_option == null && dto.treatment_option === undefined) {
        data.treatment_option = 'DECREASE';
      }
    }
    data.is_evaluated = impact != null && likelihood != null && !!ownerId;

    const residualImpact = dto.residual_impact !== undefined ? dto.residual_impact : existing.residual_impact;
    const residualLikelihood =
      dto.residual_likelihood !== undefined ? dto.residual_likelihood : existing.residual_likelihood;
    data.residual_risk =
      residualImpact != null && residualLikelihood != null ? riskLevel(residualImpact, residualLikelihood) : null;

    let controlIds: string[] | undefined;
    if (dto.treatment_controls !== undefined) {
      const codes = [...new Set(dto.treatment_controls)];
      const controls = await this.prisma.riskControl.findMany({ where: { code: { in: codes } }, select: { id: true } });
      if (controls.length !== codes.length) throw new BadRequestException('Unknown Annex A control code');
      controlIds = controls.map(c => c.id);
    }

    // Changing the assessment invalidates the review; changing the assessment or
    // the treatment invalidates the treatment confirmation and the risk owner's
    // approval, which must be given again on the new values.
    const scoringChanged =
      (dto.impact !== undefined && dto.impact !== existing.impact) ||
      (dto.likelihood !== undefined && dto.likelihood !== existing.likelihood);
    const treatmentChanged =
      dto.treatment_option !== undefined ||
      dto.treatment_description !== undefined ||
      dto.residual_impact !== undefined ||
      dto.residual_likelihood !== undefined ||
      dto.treatment_controls !== undefined;
    if (scoringChanged) data.is_reviewed = false;
    if (scoringChanged || treatmentChanged) {
      data.treatment_confirmed = false;
      if (existing.approval_decision !== 'PENDING') {
        data.approval_decision = 'PENDING';
        data.approval_user = { disconnect: true };
        data.approval_at = null;
      }
    }
    data.status = 'EDITED';

    await this.prisma.$transaction(async (tx) => {
      if (controlIds !== undefined) {
        await tx.riskItemControl.deleteMany({ where: { item_id: riskId } });
        if (controlIds.length > 0) {
          await tx.riskItemControl.createMany({
            data: controlIds.map(control_id => ({ item_id: riskId, control_id })),
          });
        }
      }
      await tx.riskItem.update({ where: { id: riskId }, data });
    });

    await this.log(
      userId,
      'risk_item',
      riskId,
      { action: 'update', step_id: existing.step_id, asset: existing.asset.name, fields: Object.keys(dto) },
      ipAddress,
      userAgent,
    );
    return this.getRegister(existing.step_id, userId);
  }

  /** Stage 5 (Review): bulk "Mark risks as reviewed". */
  async reviewRisks(stepId: string, dto: ReviewRisksDto, userId: string, ipAddress?: string, userAgent?: string) {
    await this.ensureCanEdit(stepId, userId);
    const reviewed = dto.reviewed ?? true;

    const risks = await this.prisma.riskItem.findMany({
      where: { id: { in: dto.riskIds }, step_id: stepId },
      select: { id: true, is_evaluated: true },
    });
    if (risks.length !== new Set(dto.riskIds).size) throw new BadRequestException('Some risks do not belong to this register');
    if (reviewed && risks.some(r => !r.is_evaluated)) {
      throw new BadRequestException('Only evaluated risks (impact, likelihood and risk owner set) can be marked as reviewed');
    }

    await this.prisma.riskItem.updateMany({
      where: { id: { in: dto.riskIds } },
      data: { is_reviewed: reviewed },
    });

    await this.log(userId, 'risk_register', stepId, { action: reviewed ? 'mark_reviewed' : 'unmark_reviewed', count: risks.length }, ipAddress, userAgent);
    return this.getRegister(stepId, userId);
  }

  /** Stage 6 (Treatment): "Confirm treatment for this risk". */
  async confirmTreatment(riskId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const risk = await this.prisma.riskItem.findUnique({
      where: { id: riskId },
      include: { treatment_controls_link: { select: { id: true } } },
    });
    if (!risk) throw new NotFoundException('Risk not found');
    await this.ensureCanEdit(risk.step_id, userId);

    if (!risk.is_evaluated || risk.level == null) {
      throw new BadRequestException('Evaluate the risk (impact, likelihood and risk owner) before treating it');
    }
    if (risk.acceptability === 'ACCEPTABLE') {
      throw new BadRequestException('This risk is acceptable and does not need treatment');
    }

    const option = risk.treatment_option ?? 'DECREASE';
    const hasResidual = risk.residual_impact != null && risk.residual_likelihood != null;
    const data: Prisma.RiskItemUpdateInput = { treatment_option: option };

    switch (option) {
      case 'DECREASE':
        if (risk.treatment_controls_link.length === 0) {
          throw new BadRequestException('Select at least one Annex A control to decrease this risk');
        }
        if (!hasResidual) throw new BadRequestException('Assess the residual impact and likelihood after the controls are applied');
        break;
      case 'TRANSFER':
      case 'AVOID':
        if (!risk.treatment_description) throw new BadRequestException('Describe how the risk will be transferred or avoided');
        if (!hasResidual) throw new BadRequestException('Assess the residual impact and likelihood');
        break;
      case 'ACCEPT':
        // Methodology 3.3: accepting an unacceptable risk is only allowed when
        // every other option would cost more than the potential impact.
        if (!risk.treatment_description) {
          throw new BadRequestException('Justify why this risk is accepted (e.g., treatment would cost more than the impact)');
        }
        data.residual_impact = risk.impact;
        data.residual_likelihood = risk.likelihood;
        data.residual_risk = risk.level;
        break;
    }

    await this.prisma.riskItem.update({
      where: { id: riskId },
      data: { ...data, treatment_confirmed: true, status: 'EDITED' },
    });

    await this.log(userId, 'risk_item', riskId, { action: 'confirm_treatment', option, step_id: risk.step_id }, ipAddress, userAgent);
    return this.getRegister(risk.step_id, userId);
  }

  // ─── Stage 7: Approval of residual risk (clause 6.1.3 f) ───────

  async approveRisk(
    riskId: string,
    dto: RiskApprovalRequestDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const risk = await this.prisma.riskItem.findUnique({ where: { id: riskId } });
    if (!risk) throw new NotFoundException('Risk not found');
    const access = await this.ensureCanEdit(risk.step_id, userId);

    const isRiskOwner = risk.risk_owner_id === userId;
    const isLead = access.role === ProjectRole.PROJECT_LEAD;
    if (!isRiskOwner && !isLead) {
      throw new ForbiddenException('Only the risk owner (or the project lead on their behalf) can decide on the residual risk');
    }
    if (!risk.is_evaluated) {
      throw new BadRequestException('The risk must be evaluated and have a risk owner before approval');
    }
    if (risk.acceptability === 'NOT_ACCEPTABLE' && !risk.treatment_confirmed) {
      throw new BadRequestException('Confirm the treatment of this risk before approving the residual risk');
    }

    const approved = dto.approval_decision === RiskApprovalDto.APPROVED;
    await this.prisma.riskItem.update({
      where: { id: riskId },
      data: {
        approval_decision: dto.approval_decision,
        approval_user: { connect: { id: userId } },
        approval_at: new Date(),
        approval_comment: dto.comment?.trim() || null,
        status: approved ? 'APPROVED' : 'EDITED',
        // A rejection sends the risk back to whoever manages the treatment.
        ...(approved ? {} : { treatment_confirmed: false }),
      },
    });

    await this.log(
      userId,
      'risk_item',
      riskId,
      {
        action: 'residual_risk_decision',
        decision: dto.approval_decision,
        on_behalf_of_owner: !isRiskOwner,
        step_id: risk.step_id,
      },
      ipAddress,
      userAgent,
    );
    return this.getRegister(risk.step_id, userId);
  }

  async removeRisk(riskId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.riskItem.findUnique({
      where: { id: riskId },
      include: { asset: { select: { name: true } }, vulnerability: { select: { name: true } }, threat: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundException('Risk not found');
    await this.ensureCanEdit(existing.step_id, userId);

    // Removing the threat link too keeps the next sync from re-creating the risk.
    await this.prisma.$transaction([
      this.prisma.riskItem.delete({ where: { id: riskId } }),
      this.prisma.riskVulnThreatLink.deleteMany({
        where: {
          asset_id: existing.asset_id,
          vulnerability_id: existing.vulnerability_id,
          threat_id: existing.threat_id,
        },
      }),
    ]);

    await this.log(
      userId,
      'risk_item',
      riskId,
      {
        action: 'deleted',
        step_id: existing.step_id,
        asset: existing.asset.name,
        vulnerability: existing.vulnerability.name,
        threat: existing.threat.name,
      },
      ipAddress,
      userAgent,
    );
    return this.getRegister(existing.step_id, userId);
  }

  async discardRisk(riskId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const existing = await this.prisma.riskItem.findUnique({ where: { id: riskId } });
    if (!existing) throw new NotFoundException('Risk not found');
    await this.ensureCanEdit(existing.step_id, userId);

    await this.prisma.riskItem.update({
      where: { id: riskId },
      data: { discarding: !existing.discarding, status: 'EDITED' },
    });

    await this.log(userId, 'risk_item', riskId, { action: existing.discarding ? 'restore' : 'discard', step_id: existing.step_id }, ipAddress, userAgent);
    return this.getRegister(existing.step_id, userId);
  }

  // ─── Output: Risk Assessment and Treatment Report (clauses 8.2, 8.3) ─

  async getDocuments(stepId: string, userId: string) {
    await this.ensureAccess(stepId, userId);
    return this.prisma.documentInstance.findMany({
      where: { step_id: stepId },
      include: {
        versions: { orderBy: { published_at: 'desc' }, take: 1 },
        creator: { select: { id: true, first_name: true, last_name: true } },
      },
    });
  }

  async createDocuments(stepId: string, userId: string, ipAddress?: string, userAgent?: string) {
    await this.ensureCanEdit(stepId, userId);

    const risks = await this.prisma.riskItem.findMany({
      where: { step_id: stepId, discarding: false },
      include: RISK_INCLUDE,
      orderBy: { created_at: 'asc' },
    });
    if (risks.length === 0) {
      throw new BadRequestException('Add at least one risk before generating the report');
    }

    const template = await this.prisma.documentTemplate.findUnique({ where: { code: REPORT_TEMPLATE_CODE } });
    if (!template) throw new NotFoundException(`${REPORT_TEMPLATE_CODE} template not found`);

    const [orgName, methodology] = await Promise.all([
      this.getOrganizationName(stepId),
      this.getMethodologyReference(stepId),
    ]);
    const content = this.buildReportContent(risks, orgName, methodology);

    // document_instances.step_id is unique: one report per register.
    const existing = await this.prisma.documentInstance.findUnique({ where: { step_id: stepId } });
    const doc = existing
      ? await this.prisma.documentInstance.update({
          where: { id: existing.id },
          data: { content: content as never, last_edited_by: userId },
        })
      : await this.prisma.documentInstance.create({
          data: {
            template_id: template.id,
            step_id: stepId,
            title: 'Risk Assessment and Treatment Report',
            status: 'DRAFT',
            version: '0.1',
            content: content as never,
            created_by: userId,
            last_edited_by: userId,
          },
        });

    await this.log(userId, 'document_instance', doc.id, { action: 'create_risk_report', risk_count: risks.length }, ipAddress, userAgent);
    return [doc];
  }

  private buildReportContent(
    risks: RiskWithRelations[],
    orgName: string,
    methodology: { title: string; code: string | null } | null,
  ): ProseMirrorNode {
    const s = this.summarize(risks);
    const scale = (v: number | null) => (v == null ? '—' : `${v} (${RISK_SCALE.VALUE_LABELS[v]})`);
    const person = (u: { first_name: string; last_name: string; email: string } | null) =>
      u ? `${u.first_name} ${u.last_name}`.trim() || u.email : '—';
    const cellText = (v: string | null | undefined) => [text(v && v.trim() ? v : '—')];
    const riskRef = (i: number) => `R-${String(i + 1).padStart(3, '0')}`;

    const methodologyName = methodology
      ? `${methodology.title}${methodology.code ? ` (${methodology.code})` : ''}`
      : 'Risk Assessment and Risk Treatment Methodology';

    const content: ProseMirrorNode[] = [
      heading(1, 'Risk Assessment and Treatment Report'),
      paragraph(text(`Organization: ${orgName}`)),
      paragraph(text(`Date of report: ${formatDate(new Date())}`)),

      heading(2, '1. Purpose, scope and users'),
      paragraph(
        text(
          `The purpose of this document is to record the results of the information security risk assessment and risk treatment performed in ${orgName}, as required by clauses 8.2 and 8.3 of ISO/IEC 27001. The assessment covers the assets within the scope of the Information Security Management System (ISMS). Users of this document are top management, risk owners and the persons responsible for the ISMS.`,
        ),
      ),

      heading(2, '2. Reference documents'),
      bulletList([
        [text('ISO/IEC 27001 standard, clauses 6.1.2, 6.1.3, 8.2 and 8.3')],
        [text(methodologyName)],
        [text('Statement of Applicability')],
      ]),

      heading(2, '3. Risk assessment criteria'),
      paragraph(
        text(
          `Risks were assessed according to the ${methodologyName}. Impact (consequence) and likelihood are each rated 0 (Low), 1 (Moderate) or 2 (High). The risk level is the sum of impact and likelihood (0 to 4). Risks with levels 0 to ${RISK_SCALE.MAX_ACCEPTABLE_LEVEL} are acceptable; risks with levels ${RISK_SCALE.MAX_ACCEPTABLE_LEVEL + 1} and 4 are unacceptable and must be treated.`,
        ),
      ),

      heading(2, '4. Summary of results'),
      table([
        [[text('Indicator')], [text('Value')]],
        [[text('Risks identified')], [text(String(s.total))]],
        [[text('Risks evaluated')], [text(String(s.evaluated))]],
        [[text('Acceptable risks')], [text(String(s.acceptable))]],
        [[text('Unacceptable risks')], [text(String(s.unacceptable))]],
        [[text('Unacceptable risks with confirmed treatment')], [text(String(s.treated))]],
        [[text('Residual risks approved by risk owners')], [text(String(s.approved))]],
        [[text('Residual risks rejected by risk owners')], [text(String(s.rejected))]],
      ]),
    ];

    const openItems: ProseMirrorNode[][] = [];
    if (s.total - s.evaluated > 0) openItems.push([text(`${s.total - s.evaluated} risk(s) not yet fully evaluated.`)]);
    if (s.unacceptable - s.treated > 0) openItems.push([text(`${s.unacceptable - s.treated} unacceptable risk(s) without confirmed treatment.`)]);
    if (s.total - s.approved > 0) openItems.push([text(`${s.total - s.approved} risk(s) without the risk owner's approval of the residual risk.`)]);
    if (openItems.length > 0) {
      content.push(
        paragraph(text('Open items at the date of this report:')),
        bulletList(openItems),
      );
    }

    // 5. Risk assessment table
    content.push(
      heading(2, '5. Risk assessment table'),
      table([
        ['Ref', 'Asset', 'Vulnerability', 'Threat', 'Existing controls', 'Impact', 'Likelihood', 'Level', 'Acceptable', 'Risk owner'].map(h => [text(h)]),
        ...risks.map((r, i) => [
          [text(riskRef(i))],
          [text(r.asset.name)],
          [text(r.vulnerability.name)],
          [text(r.threat.name)],
          cellText(r.existing_controls),
          [text(scale(r.impact))],
          [text(scale(r.likelihood))],
          [text(r.level == null ? '—' : String(r.level))],
          [text(r.acceptability == null ? '—' : r.acceptability === 'ACCEPTABLE' ? 'Yes' : 'No')],
          [text(person(r.risk_owner))],
        ]),
      ]),
    );

    // 6. Risk treatment table (unacceptable risks only, per the methodology)
    const unacceptable = risks
      .map((r, i) => ({ r, ref: riskRef(i) }))
      .filter(({ r }) => r.acceptability === 'NOT_ACCEPTABLE');
    content.push(heading(2, '6. Risk treatment table'));
    if (unacceptable.length === 0) {
      content.push(paragraph(text('No unacceptable risks were identified; no treatment is required.')));
    } else {
      content.push(
        table([
          ['Ref', 'Risk', 'Treatment option', 'Controls (Annex A) / description', 'Residual impact', 'Residual likelihood', 'Residual level', 'Confirmed'].map(h => [text(h)]),
          ...unacceptable.map(({ r, ref }) => {
            const controls = r.treatment_controls_link.map(l => `${l.control.code} ${l.control.title}`);
            const detail = [...controls, r.treatment_description ?? ''].filter(Boolean).join('; ');
            return [
              [text(ref)],
              [text(`${r.asset.name}: ${r.threat.name} (via ${r.vulnerability.name})`)],
              [text(r.treatment_option ? TREATMENT_LABELS[r.treatment_option] : '—')],
              cellText(detail),
              [text(scale(r.residual_impact))],
              [text(scale(r.residual_likelihood))],
              [text(r.residual_risk == null ? '—' : String(r.residual_risk))],
              [text(r.treatment_confirmed ? 'Yes' : 'No')],
            ];
          }),
        ]),
      );
    }

    // 7. Acceptance of residual risks (clause 6.1.3 f)
    content.push(
      heading(2, '7. Acceptance of residual risks'),
      paragraph(
        text(
          'Risk owners have reviewed the risk treatment and decided on the acceptance of the residual risks as recorded below. A decision made by the project lead on behalf of a risk owner is recorded under the name of the person who made it.',
        ),
      ),
      table([
        ['Ref', 'Risk owner', 'Residual level', 'Decision', 'Decided by', 'Date', 'Comment'].map(h => [text(h)]),
        ...risks.map((r, i) => [
          [text(riskRef(i))],
          [text(person(r.risk_owner))],
          [text(r.residual_risk != null ? String(r.residual_risk) : r.level != null ? String(r.level) : '—')],
          [text(r.approval_decision === 'APPROVED' ? 'Approved' : r.approval_decision === 'REJECTED' ? 'Rejected' : 'Pending')],
          [text(r.approval_user ? person(r.approval_user) : '—')],
          [text(r.approval_at ? formatDate(r.approval_at) : '—')],
          cellText(r.approval_comment),
        ]),
      ]),
    );

    return { type: 'doc', content };
  }

  // ─── Step completion (clauses 6.1.2, 6.1.3, 8.2, 8.3) ──────────

  /**
   * What must be true before the Risk Register step can be finished. Used by
   * the register UI and enforced by ProjectsService.completeStep.
   */
  async getCompletion(stepId: string) {
    const [risks, report] = await Promise.all([
      this.prisma.riskItem.findMany({
        where: { step_id: stepId, discarding: false },
        select: {
          discarding: true,
          is_evaluated: true,
          is_reviewed: true,
          acceptability: true,
          treatment_confirmed: true,
          approval_decision: true,
          updated_at: true,
        },
      }),
      this.prisma.documentInstance.findUnique({
        where: { step_id: stepId },
        select: { updated_at: true },
      }),
    ]);
    const s = this.summarize(risks);
    const lastRiskChange = risks.reduce<Date | null>(
      (max, r) => (!max || r.updated_at > max ? r.updated_at : max),
      null,
    );
    const reportUpToDate = !!report && (!lastRiskChange || report.updated_at >= lastRiskChange);
    const pending = s.total - s.approved - s.rejected;

    const items = [
      {
        key: 'risks',
        label: 'Risks are identified (assets, vulnerabilities and threats)',
        done: s.total > 0,
        detail: s.total > 0 ? `${s.total} risk(s)` : 'No risks yet',
      },
      {
        key: 'evaluated',
        label: 'Every risk has impact, likelihood and a risk owner',
        done: s.total > 0 && s.evaluated === s.total,
        detail: `${s.total - s.evaluated} risk(s) still empty`,
      },
      {
        key: 'reviewed',
        label: 'Every risk is marked as reviewed',
        done: s.total > 0 && s.reviewed === s.total,
        detail: `${s.total - s.reviewed} risk(s) not reviewed`,
      },
      {
        key: 'treated',
        label: 'Every unacceptable risk has a confirmed treatment',
        done: s.treated === s.unacceptable,
        detail: `${s.unacceptable - s.treated} unacceptable risk(s) without confirmed treatment`,
      },
      {
        key: 'approved',
        label: 'Every risk owner has approved the residual risk',
        done: s.total > 0 && s.approved === s.total,
        detail: [pending > 0 && `${pending} awaiting approval`, s.rejected > 0 && `${s.rejected} rejected`]
          .filter(Boolean)
          .join(', ') || 'No risks yet',
      },
      {
        key: 'report',
        label: 'The Risk Assessment and Treatment Report is generated and up to date',
        done: reportUpToDate,
        detail: report ? 'Risks changed after the report was generated; refresh it' : 'Report not generated yet',
      },
    ];
    return { ready: items.every(i => i.done), items };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /**
   * Adds risks for new asset → vulnerability → threat combinations and removes
   * risks whose combination no longer exists. Existing risks are untouched.
   */
  private async syncRisks(stepId: string) {
    const { assetVulnLinks, vulnThreatLinks } = await this.getSelectedEntities(stepId);
    const livePairs = new Set(assetVulnLinks.map(l => pairKey(l.asset_id, l.vulnerability_id)));

    const wanted = new Map<string, { asset_id: string; vulnerability_id: string; threat_id: string }>();
    for (const l of vulnThreatLinks) {
      if (!livePairs.has(pairKey(l.asset_id, l.vulnerability_id))) continue;
      const t = { asset_id: l.asset_id, vulnerability_id: l.vulnerability_id, threat_id: l.threat_id };
      wanted.set(`${t.asset_id}|${t.vulnerability_id}|${t.threat_id}`, t);
    }

    const current = await this.prisma.riskItem.findMany({
      where: { step_id: stepId },
      select: { id: true, asset_id: true, vulnerability_id: true, threat_id: true },
    });
    const currentKeys = new Set(current.map(r => `${r.asset_id}|${r.vulnerability_id}|${r.threat_id}`));
    const stale = current.filter(r => !wanted.has(`${r.asset_id}|${r.vulnerability_id}|${r.threat_id}`));
    const fresh = [...wanted.entries()].filter(([k]) => !currentKeys.has(k)).map(([, t]) => t);

    await this.prisma.$transaction([
      this.prisma.riskItem.deleteMany({ where: { id: { in: stale.map(r => r.id) } } }),
      this.prisma.riskItem.createMany({
        data: fresh.map(t => ({ step_id: stepId, ...t })),
        skipDuplicates: true,
      }),
    ]);

    return { added: fresh.length, removed: stale.length, total: wanted.size };
  }

  private summarize(risks: {
    discarding: boolean;
    is_evaluated: boolean;
    is_reviewed: boolean;
    acceptability: string | null;
    treatment_confirmed: boolean;
    approval_decision: string;
  }[]) {
    const active = risks.filter(r => !r.discarding);
    return {
      total: active.length,
      evaluated: active.filter(r => r.is_evaluated).length,
      reviewed: active.filter(r => r.is_reviewed).length,
      acceptable: active.filter(r => r.acceptability === 'ACCEPTABLE').length,
      unacceptable: active.filter(r => r.acceptability === 'NOT_ACCEPTABLE').length,
      treated: active.filter(r => r.acceptability === 'NOT_ACCEPTABLE' && r.treatment_confirmed).length,
      approved: active.filter(r => r.approval_decision === 'APPROVED').length,
      rejected: active.filter(r => r.approval_decision === 'REJECTED').length,
    };
  }

  private async getSelectedEntities(stepId: string) {
    const [assets, vulnerabilities, threats, assetVulnLinks, vulnThreatLinks] = await Promise.all([
      this.prisma.riskAsset.findMany({ where: { step_id: stepId } }),
      this.prisma.riskVulnerability.findMany({ where: { step_id: stepId } }),
      this.prisma.riskThreat.findMany({ where: { step_id: stepId } }),
      this.prisma.riskAssetVulnLink.findMany({ where: { step_id: stepId } }),
      this.prisma.riskVulnThreatLink.findMany({ where: { step_id: stepId } }),
    ]);
    return { assets, vulnerabilities, threats, assetVulnLinks, vulnThreatLinks };
  }

  private async getProjectUsers(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: projectId },
      include: { user: { select: USER_SELECT } },
    });
    return members.map(({ user: u, privilege }) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      privilege,
      label: `${u.first_name} ${u.last_name}`.trim() || u.email,
    }));
  }

  private async getOrganizationName(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      select: { phase: { select: { project: { select: { organization: { select: { name: true } } } } } } },
    });
    return step?.phase.project.organization?.name ?? 'Organization';
  }

  /** The P2S1 methodology document of the same project, cited by the report. */
  private async getMethodologyReference(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { phase_id: true } });
    if (!step) return null;
    const methodologyStep = await this.prisma.projectStep.findUnique({
      where: { phase_id_key: { phase_id: step.phase_id, key: METHODOLOGY_STEP_KEY } },
      select: { document_instance: { select: { title: true, answers: true } } },
    });
    const doc = methodologyStep?.document_instance;
    if (!doc) return null;
    const answers = (doc.answers ?? {}) as Record<string, unknown>;
    const code = typeof answers.document_code === 'string' && answers.document_code.trim() ? answers.document_code.trim() : null;
    return { title: doc.title, code };
  }

  private async log(
    userId: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType,
      entityId,
      details: details as never,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Membership and role are resolved here from the database rather than
   * trusted from the request, so the rules hold for every route.
   */
  private async ensureAccess(stepId: string, userId: string): Promise<Access> {
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        key: true,
        phase: {
          select: {
            project_id: true,
            project: { select: { members: { where: { user_id: userId }, select: { privilege: true } } } },
          },
        },
      },
    });
    if (!step) throw new NotFoundException('Step not found');
    const membership = step.phase.project.members[0];
    if (!membership) throw new ForbiddenException('You are not a member of this project');
    return { stepId: step.id, projectId: step.phase.project_id, role: membership.privilege };
  }

  private async ensureCanEdit(stepId: string, userId: string): Promise<Access> {
    const access = await this.ensureAccess(stepId, userId);
    if (access.role === ProjectRole.PROJECT_AUDITOR) {
      throw new ForbiddenException('Auditors have read-only access to the risk register');
    }
    return access;
  }
}

function dedupeByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(i => (seen.has(i.name) ? false : (seen.add(i.name), true)));
}

/** Natural order for Annex A codes: A.5.2 before A.5.10. */
function compareControlCodes(a: string, b: string) {
  const pa = a.split('.').slice(1).map(Number);
  const pb = b.split('.').slice(1).map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1];
}

function formatDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
