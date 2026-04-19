import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SelectList } from '@/presentation/components/SelectList.tsx';
import { TextInput } from '@/presentation/components/TextInput.tsx';
import { useServices } from '@/presentation/hooks/use-services.tsx';
import type { ServerRecord } from '@/domain/entities/server-record.ts';
import type { ScheduledTask } from '@/domain/entities/scheduled-task.ts';
import type { TaskType } from '@/domain/entities/enums.ts';

export interface SchedulerPanelProps {
  readonly server: ServerRecord;
}

export function SchedulerPanel({ server }: SchedulerPanelProps) {
  const { scheduler } = useServices();
  const [tasks, setTasks] = useState<readonly ScheduledTask[]>([]);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [newTaskType, setNewTaskType] = useState<TaskType>('auto_backup');
  const [newCron, setNewCron] = useState('');
  const [newPayload, setNewPayload] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);

  const maxFocus = newTaskType === 'broadcast' ? 3 : 2;

  useInput((_input, key) => {
    if (key.tab) {
      if (key.shift) {
        setFocusIndex(prev => (prev > 0 ? prev - 1 : maxFocus));
      } else {
        setFocusIndex(prev => (prev < maxFocus ? prev + 1 : 0));
      }
    }
  });

  useEffect(() => {
    scheduler.listTasks(server.id).then(setTasks).catch(console.error);
  }, [scheduler, server.id]);

  const handleCreate = async () => {
    if (!server.staticIp) return;
    try {
      await scheduler.addTask(server, {
        id: 'new-task',
        serverId: server.id,
        type: newTaskType,
        cronExpression: newCron,
        payload: newPayload || null,
        enabled: true,
        createdAt: new Date().toISOString(),
      });
      setMode('list');
      const list = await scheduler.listTasks(server.id);
      setTasks(list);
    } catch (e) {
      console.error(e);
    }
  };

  if (mode === 'create') {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Create Scheduled Task (Tab to switch fields)</Text>
        
        <Box flexDirection="column">
          <Text color={focusIndex === 0 ? 'cyan' : undefined}>
            {focusIndex === 0 ? '❯ ' : '  '}Task Type:
          </Text>
          <SelectList
            focused={focusIndex === 0}
            items={[
              { label: 'auto_backup' + (newTaskType === 'auto_backup' ? ' (Selected)' : ''), value: 'auto_backup' },
              { label: 'auto_restart' + (newTaskType === 'auto_restart' ? ' (Selected)' : ''), value: 'auto_restart' },
              { label: 'broadcast' + (newTaskType === 'broadcast' ? ' (Selected)' : ''), value: 'broadcast' },
            ]}
            onSelect={(val) => setNewTaskType(val as TaskType)}
          />
        </Box>
        
        <Box flexDirection="column">
          <Text color={focusIndex === 1 ? 'cyan' : undefined}>
            {focusIndex === 1 ? '❯ ' : '  '}Cron Expression:
          </Text>
          <TextInput focused={focusIndex === 1} label="(e.g. 0 4 * * *)" value={newCron} onChange={setNewCron} />
        </Box>
        
        {newTaskType === 'broadcast' && (
          <Box flexDirection="column">
            <Text color={focusIndex === 2 ? 'cyan' : undefined}>
              {focusIndex === 2 ? '❯ ' : '  '}Broadcast Message:
            </Text>
            <TextInput focused={focusIndex === 2} label="Message" value={newPayload} onChange={setNewPayload} />
          </Box>
        )}
        
        <Box flexDirection="column">
          <Text color={focusIndex === maxFocus ? 'cyan' : undefined}>
            {focusIndex === maxFocus ? '❯ ' : '  '}Actions:
          </Text>
          <SelectList
            focused={focusIndex === maxFocus}
            items={[
              { label: 'Save Task', value: 'save' },
              { label: 'Cancel', value: 'cancel' }
            ]}
            onSelect={(val) => {
              if (val === 'save') handleCreate();
              if (val === 'cancel') setMode('list');
            }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Scheduled Tasks</Text>
      
      {tasks.length === 0 ? (
        <Text>No tasks scheduled.</Text>
      ) : (
        <Box flexDirection="column">
          {tasks.map(t => (
            <Text key={t.id}>
              {t.type} | {t.cronExpression} | {t.enabled ? 'Active' : 'Disabled'}
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <SelectList
          focused={true}
          items={[{ label: 'Create New Task', value: 'create' }]}
          onSelect={() => {
            setMode('create');
            setFocusIndex(0);
          }}
        />
      </Box>
    </Box>
  );
}
