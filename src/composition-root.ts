import { SqliteLocalDb } from './infrastructure/database/sqlite-local-db.ts';
import { SshPool } from './infrastructure/ssh/ssh-pool.ts';
import { Ssh2Gateway } from './infrastructure/ssh/ssh2-gateway.ts';
import { Ssh2SftpGateway } from './infrastructure/ssh/ssh2-sftp-gateway.ts';
import { TcpRconGateway } from './infrastructure/rcon/tcp-rcon-gateway.ts';
import { CdktfCloudProvider } from './infrastructure/cdktf/cdktf-cloud-provider.ts';
import { SystemFilePicker } from './infrastructure/system/file-picker.ts';
import { HttpLatencyPinger } from './infrastructure/networking/http-latency-pinger.ts';

import { InventoryService } from './application/services/inventory-service.ts';
import { LatencyService } from './application/services/latency-service.ts';
import { RconService } from './application/services/rcon-service.ts';
import { StatsService } from './application/services/stats-service.ts';
import { DeployService } from './application/services/deploy-service.ts';
import { BackupService } from './application/services/backup-service.ts';
import { UpdateFlowService } from './application/services/update-flow-service.ts';
import { SchedulerService } from './application/services/scheduler-service.ts';
import { ArchiveService } from './application/services/archive-service.ts';

export interface AppContextConfig {
  dbPath?: string;
}

export interface AppContextOverrides {
  repositories?: {
    localDb?: any;
    sshPool?: any;
    sshGateway?: any;
    sftpGateway?: any;
    rconGateway?: any;
    cloudProvider?: any;
    filePicker?: any;
    pinger?: any;
  };
  services?: {
    inventory?: any;
    latency?: any;
    rcon?: any;
    stats?: any;
    deploy?: any;
    backup?: any;
    updateFlow?: any;
    scheduler?: any;
    archive?: any;
  };
}

export async function createAppContext(config: AppContextConfig = {}, overrides?: AppContextOverrides) {
  // Repositories & Gateways — use overrides if provided
  const localDb = overrides?.repositories?.localDb
    ?? new SqliteLocalDb(config.dbPath);
  const sshPool = overrides?.repositories?.sshPool
    ?? new SshPool();
  const sshGateway = overrides?.repositories?.sshGateway
    ?? new Ssh2Gateway(sshPool);
  const sftpGateway = overrides?.repositories?.sftpGateway
    ?? new Ssh2SftpGateway(sshPool);
  const rconGateway = overrides?.repositories?.rconGateway
    ?? new TcpRconGateway();
  const cloudProvider = overrides?.repositories?.cloudProvider
    ?? new CdktfCloudProvider();
  const filePicker = overrides?.repositories?.filePicker
    ?? new SystemFilePicker();
  const pinger = overrides?.repositories?.pinger
    ?? new HttpLatencyPinger();

  // Application Services — use overrides if provided
  const inventory = overrides?.services?.inventory
    ?? new InventoryService(localDb);
  const latency = overrides?.services?.latency
    ?? new LatencyService(pinger);
  const rcon = overrides?.services?.rcon
    ?? new RconService(rconGateway, sshGateway);
  const stats = overrides?.services?.stats
    ?? new StatsService(sshGateway);
  const deploy = overrides?.services?.deploy
    ?? new DeployService(cloudProvider, sshGateway, localDb);
  const backup = overrides?.services?.backup
    ?? new BackupService(sshGateway, sftpGateway, localDb);
  const updateFlow = overrides?.services?.updateFlow
    ?? new UpdateFlowService(rcon, sshGateway, localDb, backup);
  const scheduler = overrides?.services?.scheduler
    ?? new SchedulerService(sshGateway, localDb);
  const archive = overrides?.services?.archive
    ?? new ArchiveService(backup, cloudProvider, localDb);

  return {
    repositories: {
      localDb,
      sshPool,
      sshGateway,
      sftpGateway,
      rconGateway,
      cloudProvider,
      filePicker,
      pinger,
    },
    services: {
      inventory,
      latency,
      rcon,
      stats,
      deploy,
      backup,
      updateFlow,
      scheduler,
      archive,
    }
  };
}

export async function destroyAppContext(context: any) {
  if (context?.repositories?.localDb) {
    context.repositories.localDb.close();
  }
  if (context?.repositories?.sshPool) {
    await context.repositories.sshPool.releaseAll();
  }
}
