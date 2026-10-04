import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, DriveConnectionStatus, DriveProvider, DriveSyncStatus, OrganizationRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { fileName } from '../documents/file-name';
import { DriveAuthError, GoogleDriveClient } from './google-drive.client';
import { SecretBox } from './secret-box';

const ROOT_FOLDER = 'APTISO';
const MAX_ATTEMPTS = 5;
const BATCH = 50;
const STATE_TTL_SECONDS = 600;
/** A drive accepts most characters, but "/" would read as a path in exports. */
const folderName = (name: string) => name.replace(/[\\/]+/g, '-').trim().slice(0, 200) || 'Untitled';

interface OAuthState { org: string; user: string }

/**
 * Mirror of the document library to the organization's drive (Google Drive
 * first). APTISO stays the record: every approved version is copied as a new
 * file into Organization / Project / Phase / Document, nothing is ever
 * deleted or overwritten in the drive, and failed copies are retried.
 */
@Injectable()
export class DriveSyncService {
  private readonly logger = new Logger(DriveSyncService.name);
  /** Runs of one connection are chained, so two runs never upload the same file twice. */
  private readonly runs = new Map<string, Promise<{ copied: number; failed: number }>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleDriveClient,
    private readonly secrets: SecretBox,
    private readonly auditLog: AuditLogService,
  ) {}

  get googleAvailable() {
    return this.google.configured && this.secrets.enabled;
  }

  // ─── Connecting ──────────────────────────────────────────────

  startGoogle(orgId: string, userId: string) {
    if (!this.googleAvailable) {
      throw new BadRequestException('Google Drive is not set up on this server (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and CONNECTOR_SECRET_KEY)');
    }
    return { url: this.google.authUrl(this.secrets.sign({ org: orgId, user: userId } satisfies OAuthState, STATE_TTL_SECONDS)) };
  }

  /** Which organization a (still valid) sign-in link belongs to, to send the browser back there. */
  stateOrganization(state: string | undefined) {
    return (state && this.secrets.enabled && this.secrets.verify<OAuthState>(state)?.org) || null;
  }

  /** The browser comes back from Google: store the access, create the APTISO folder, copy the library. */
  async finishGoogle(code: string, state: string) {
    const s = this.secrets.verify<OAuthState>(state);
    if (!s) throw new BadRequestException('The sign-in link expired. Start again from the organization page.');
    const admin = await this.prisma.organizationMember.findFirst({
      where: { organization_id: s.org, user_id: s.user, role: { in: [OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN] } },
    });
    if (!admin) throw new BadRequestException('Only the owner or an admin of the organization can connect a drive');

    const { refreshToken, accessToken, email } = await this.google.exchangeCode(code);
    const rootId = await this.google.createFolder(accessToken, ROOT_FOLDER);
    const data = {
      provider: DriveProvider.GOOGLE_DRIVE,
      account_email: email,
      root_folder_id: rootId,
      refresh_token_enc: this.secrets.encrypt(refreshToken),
      status: DriveConnectionStatus.ACTIVE,
      last_error: null,
      connected_by: s.user,
      connected_at: new Date(),
    };
    // Reconnecting starts a fresh mirror in a new APTISO folder.
    await this.prisma.driveConnection.deleteMany({ where: { organization_id: s.org } });
    const connection = await this.prisma.driveConnection.create({ data: { ...data, organization_id: s.org } });
    await this.log(s.user, s.org, { action: 'drive_connected', provider: 'GOOGLE_DRIVE', account: email });
    void this.syncConnection(connection.id);
    return { orgId: s.org };
  }

  async disconnect(orgId: string, userId: string) {
    const connection = await this.prisma.driveConnection.findUnique({ where: { organization_id: orgId } });
    if (!connection) throw new NotFoundException('No drive is connected');
    await this.google.revoke(this.secrets.decrypt(connection.refresh_token_enc));
    await this.prisma.driveConnection.delete({ where: { id: connection.id } });
    await this.log(userId, orgId, { action: 'drive_disconnected', account: connection.account_email });
    return { message: 'Disconnected. Files already copied stay in the drive.' };
  }

  async status(orgId: string) {
    const connection = await this.prisma.driveConnection.findUnique({
      where: { organization_id: orgId },
      include: { connector: { select: { first_name: true, last_name: true } } },
    });
    if (!connection) return { google_available: this.googleAvailable, connection: null };
    const [counts, failures] = await Promise.all([
      this.prisma.driveSyncItem.groupBy({ by: ['status'], where: { connection_id: connection.id }, _count: true }),
      this.prisma.driveSyncItem.findMany({
        where: { connection_id: connection.id, status: DriveSyncStatus.FAILED },
        select: { id: true, attempts: true, last_error: true, version: { select: { version: true, document: { select: { title: true } } } } },
        take: 10,
      }),
    ]);
    const count = (s: DriveSyncStatus) => counts.find(c => c.status === s)?._count ?? 0;
    const { refresh_token_enc: _secret, ...safe } = connection;
    return {
      google_available: this.googleAvailable,
      connection: { ...safe, counts: { synced: count('SYNCED'), pending: count('PENDING'), failed: count('FAILED') } },
      failures: failures.map(f => ({ id: f.id, attempts: f.attempts, error: f.last_error, title: f.version.document.title, version: f.version.version })),
    };
  }

  // ─── Copying ─────────────────────────────────────────────────

  /** Called after a library version is published. */
  async versionPublished(versionId: string) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      select: { document: { select: { step: { select: { phase: { select: { project: { select: { organization_id: true } } } } } } } } },
    });
    const orgId = version?.document.step?.phase.project.organization_id;
    const connection = orgId && await this.prisma.driveConnection.findUnique({ where: { organization_id: orgId } });
    if (!connection || connection.status !== DriveConnectionStatus.ACTIVE) return;
    await this.prisma.driveSyncItem.createMany({ data: [{ connection_id: connection.id, document_version_id: versionId }], skipDuplicates: true });
    void this.syncConnection(connection.id);
  }

  /** "Sync now", and the hourly check: queue anything missing, then copy what is pending. */
  async syncOrganization(orgId: string) {
    const connection = await this.prisma.driveConnection.findUnique({ where: { organization_id: orgId } });
    if (!connection) throw new NotFoundException('No drive is connected');
    if (connection.status !== DriveConnectionStatus.ACTIVE) throw new BadRequestException('The drive must be reconnected first');
    // A manual sync gives failed copies a fresh set of attempts.
    await this.prisma.driveSyncItem.updateMany({ where: { connection_id: connection.id, status: DriveSyncStatus.FAILED }, data: { attempts: 0 } });
    return this.syncConnection(connection.id);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncAll() {
    const connections = await this.prisma.driveConnection.findMany({ where: { status: DriveConnectionStatus.ACTIVE }, select: { id: true } });
    for (const c of connections) await this.syncConnection(c.id);
  }

  /** Waits for a run already in progress, then copies whatever is still pending. */
  syncConnection(connectionId: string) {
    const previous = this.runs.get(connectionId) ?? Promise.resolve({ copied: 0, failed: 0 });
    const run = previous.then(() => this.copyPending(connectionId)).catch((e: Error) => {
      this.logger.error(`Drive sync failed for connection ${connectionId}: ${e.message}`);
      return { copied: 0, failed: 0 };
    });
    this.runs.set(connectionId, run);
    void run.finally(() => { if (this.runs.get(connectionId) === run) this.runs.delete(connectionId); });
    return run;
  }

  private async copyPending(connectionId: string) {
    const connection = await this.prisma.driveConnection.findUnique({ where: { id: connectionId } });
    if (!connection || connection.status !== DriveConnectionStatus.ACTIVE) return { copied: 0, failed: 0 };
    await this.queueMissing(connection.id, connection.organization_id);

    const items = await this.prisma.driveSyncItem.findMany({
      where: { connection_id: connectionId, OR: [{ status: DriveSyncStatus.PENDING }, { status: DriveSyncStatus.FAILED, attempts: { lt: MAX_ATTEMPTS } }] },
      orderBy: { created_at: 'asc' },
      take: BATCH,
      include: {
        version: {
          select: {
            version: true, pdf_data: true,
            document: { select: { id: true, title: true, step: { select: { phase: { select: { order: true, name: true, project: { select: { id: true, name: true, organization: { select: { name: true } } } } } } } } } },
          },
        },
      },
    });
    if (!items.length) return this.touch(connectionId, { copied: 0, failed: 0 });

    let accessToken: string;
    try {
      accessToken = await this.google.accessToken(this.secrets.decrypt(connection.refresh_token_enc));
    } catch (e) {
      return this.handleConnectionError(connectionId, e as Error);
    }

    let copied = 0;
    let failed = 0;
    for (const item of items) {
      const v = item.version;
      const phase = v.document.step?.phase;
      try {
        if (!phase || !v.pdf_data) throw new Error('This version has no PDF to copy');
        const folders: [string, string][] = [
          ['org', phase.project.organization.name],
          [`project:${phase.project.id}`, phase.project.name],
          [`phase:${phase.project.id}:${phase.order}`, `${phase.order} ${phase.name}`],
          [`document:${v.document.id}`, v.document.title],
        ];
        const parent = await this.ensureFolders(connection, accessToken, folders);
        const name = fileName(v.document.title, v.version, 'pdf');
        const fileId = await this.google.upload(accessToken, parent, name, 'application/pdf', Buffer.from(v.pdf_data));
        await this.prisma.driveSyncItem.update({
          where: { id: item.id },
          data: { status: DriveSyncStatus.SYNCED, remote_file_id: fileId, remote_path: [ROOT_FOLDER, ...folders.map(f => folderName(f[1])), name].join(' / '), synced_at: new Date(), last_error: null },
        });
        copied++;
      } catch (e) {
        if (e instanceof DriveAuthError) return this.handleConnectionError(connectionId, e, { copied, failed });
        await this.prisma.driveSyncItem.update({
          where: { id: item.id },
          data: { status: DriveSyncStatus.FAILED, attempts: { increment: 1 }, last_error: (e as Error).message.slice(0, 500) },
        });
        failed++;
      }
    }
    return this.touch(connectionId, { copied, failed });
  }

  /** Folders are created once; their ids are remembered by APTISO path so renames never duplicate them. */
  private async ensureFolders(connection: { id: string; root_folder_id: string }, accessToken: string, folders: [string, string][]) {
    let parent = connection.root_folder_id;
    for (const [path, name] of folders) {
      const known = await this.prisma.driveFolder.findUnique({ where: { connection_id_path: { connection_id: connection.id, path } } });
      if (known) {
        parent = known.remote_id;
        continue;
      }
      parent = await this.google.createFolder(accessToken, folderName(name), parent);
      await this.prisma.driveFolder.create({ data: { connection_id: connection.id, path, remote_id: parent } });
    }
    return parent;
  }

  /** Versions published before the drive was connected (or while it was disconnected). */
  private async queueMissing(connectionId: string, orgId: string) {
    const versions = await this.prisma.documentVersion.findMany({
      where: { document: { step: { phase: { project: { organization_id: orgId } } } }, drive_items: { none: { connection_id: connectionId } } },
      select: { id: true },
    });
    if (versions.length) {
      await this.prisma.driveSyncItem.createMany({ data: versions.map(v => ({ connection_id: connectionId, document_version_id: v.id })), skipDuplicates: true });
    }
  }

  private async handleConnectionError(connectionId: string, e: Error, result = { copied: 0, failed: 0 }) {
    await this.prisma.driveConnection.update({
      where: { id: connectionId },
      data: e instanceof DriveAuthError
        ? { status: DriveConnectionStatus.NEEDS_RECONNECT, last_error: e.message.slice(0, 500) }
        : { last_error: e.message.slice(0, 500) },
    });
    return result;
  }

  private async touch(connectionId: string, result: { copied: number; failed: number }) {
    await this.prisma.driveConnection.update({ where: { id: connectionId }, data: { last_sync_at: new Date(), ...(result.failed === 0 && { last_error: null }) } });
    return result;
  }

  private log(userId: string, orgId: string, details: Record<string, string>) {
    return this.auditLog.log({ userId, action: AuditAction.ORGANIZATION_UPDATED, entityType: 'drive_connection', entityId: orgId, details });
  }
}
