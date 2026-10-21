import type { Queue } from 'bullmq';

const STATES = ['waiting', 'active', 'delayed', 'failed', 'completed', 'prioritized', 'waiting-children'] as const;

/** Prometheus text exposition of job counts per queue and state. No client library needed. */
export async function renderMetrics(queues: Map<string, Queue>): Promise<string> {
  const lines = [
    '# HELP bullmq_jobs Number of jobs in each state per queue.',
    '# TYPE bullmq_jobs gauge',
  ];
  for (const [name, q] of queues) {
    const counts = await q.getJobCounts(...STATES);
    for (const state of STATES) lines.push(`bullmq_jobs{queue="${name}",state="${state}"} ${counts[state] ?? 0}`);
  }
  return `${lines.join('\n')}\n`;
}
