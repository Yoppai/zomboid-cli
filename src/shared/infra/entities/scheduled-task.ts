import type { TaskId, ServerId, TaskType } from './enums.ts';

export interface ScheduledTask {
  readonly id: TaskId;
  readonly serverId: ServerId;
  readonly type: TaskType;
  readonly cronExpression: string;
  readonly payload: string | null;
  enabled: boolean;
  readonly createdAt: string;
}
