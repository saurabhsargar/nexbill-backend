import { Injectable, Logger } from '@nestjs/common';
import { BackupStatus } from '@prisma/client';
import { spawn } from 'child_process';
import { statSync } from 'fs';
import { join } from 'path';
import { PrismaService } from 'src/database/prisma.service';

const STORAGE_DIR = join(process.cwd(), 'storage', 'backups');

interface DbConnectionInfo {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

function parseDatabaseUrl(databaseUrl: string): DbConnectionInfo {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

/**
 * Isolates all child_process interaction with pg_dump/pg_restore. Binary
 * paths are configurable via env vars since they aren't guaranteed to be on
 * PATH (they aren't on this dev machine, for instance).
 * INCREMENTAL performs the same full logical dump as FULL under the hood --
 * true WAL-based incremental backup needs pg_basebackup/WAL archiving
 * infrastructure, out of scope here.
 */
@Injectable()
export class BackupRunnerService {
  private readonly logger = new Logger(BackupRunnerService.name);

  constructor(private prisma: PrismaService) {}

  private get connectionInfo(): DbConnectionInfo {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is not configured');
    return parseDatabaseUrl(databaseUrl);
  }

  /**
   * Detached from the HTTP request that triggered it (the caller does not
   * await this) -- updates the Backup row's status as it progresses instead
   * of throwing to a caller that has already responded.
   */
  async run(backupId: string): Promise<void> {
    const conn = this.connectionInfo;
    const filePath = join(STORAGE_DIR, `${backupId}.dump`);
    const pgDumpPath = process.env.PG_DUMP_PATH ?? 'pg_dump';

    await this.prisma.backup.update({
      where: { id: backupId },
      data: { status: BackupStatus.RUNNING },
    });

    try {
      await this.spawnAndWait(
        pgDumpPath,
        [
          '-h',
          conn.host,
          '-p',
          conn.port,
          '-U',
          conn.user,
          '-F',
          'c',
          '-f',
          filePath,
          conn.database,
        ],
        conn.password,
      );

      const { size } = statSync(filePath);
      await this.prisma.backup.update({
        where: { id: backupId },
        data: {
          status: BackupStatus.COMPLETED,
          filePath,
          sizeBytes: BigInt(size),
          completedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Backup ${backupId} failed: ${message}`);
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { status: BackupStatus.FAILED, errorMessage: message },
      });
    }
  }

  /**
   * Restore is awaited by its caller -- destructive enough that the API must
   * give a definitive success/failure signal, unlike backup creation.
   */
  async restore(filePath: string): Promise<void> {
    const conn = this.connectionInfo;
    const pgRestorePath = process.env.PG_RESTORE_PATH ?? 'pg_restore';

    await this.spawnAndWait(
      pgRestorePath,
      [
        '-h',
        conn.host,
        '-p',
        conn.port,
        '-U',
        conn.user,
        '-d',
        conn.database,
        '--clean',
        '--if-exists',
        filePath,
      ],
      conn.password,
    );
  }

  private spawnAndWait(
    command: string,
    args: string[],
    password: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        env: { ...process.env, PGPASSWORD: password },
      });

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start ${command}: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(stderr.trim() || `${command} exited with code ${code}`),
          );
        }
      });
    });
  }
}
