import { Injectable } from '@nestjs/common';
import * as si from 'systeminformation';
import { PrismaService } from 'src/database/prisma.service';

const ASSUMED_INTERFACE_MBPS = 100;

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService) {}

  async getHealth() {
    const [load, mem, fsSize, networkStats, networkInterfaces] =
      await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.networkInterfaces(),
      ]);

    const cpuPercent = Math.round(load.currentLoad * 100) / 100;
    const memoryPercent = Math.round((mem.used / mem.total) * 10000) / 100;

    const primaryFs =
      fsSize.find((fs) => process.cwd().startsWith(fs.mount)) ?? fsSize[0];
    const storagePercent = primaryFs
      ? Math.round((primaryFs.used / primaryFs.size) * 10000) / 100
      : 0;

    // networkStats() returns -1 for rx_sec/tx_sec on the very first sample
    // after boot (needs a previous reading to compute a delta) -- clamp to 0.
    const primaryNet = networkStats[0];
    const rxSec = Math.max(primaryNet?.rx_sec ?? 0, 0);
    const txSec = Math.max(primaryNet?.tx_sec ?? 0, 0);

    // Interface `speed` (Mbps) is frequently unreported in VMs/containers --
    // fall back to an assumed value so the percentage is at least indicative.
    const iface = networkInterfaces.find((i) => i.iface === primaryNet?.iface);
    const speedMbps = iface?.speed ? iface.speed : ASSUMED_INTERFACE_MBPS;
    const throughputMbps = ((rxSec + txSec) * 8) / 1_000_000;
    const networkPercent = Math.min(
      Math.round((throughputMbps / speedMbps) * 10000) / 100,
      100,
    );

    return { cpuPercent, memoryPercent, storagePercent, networkPercent };
  }

  async optimizeDb() {
    await this.prisma.$executeRawUnsafe('VACUUM ANALYZE');
    return { message: 'Database optimization (VACUUM ANALYZE) completed' };
  }

  clearCache() {
    // No application-level cache layer is wired in (no Redis client, no
    // in-memory cache module) -- an honest acknowledgement, not a fake clear.
    return {
      message: 'No cache layer is currently configured; nothing to clear.',
    };
  }
}
