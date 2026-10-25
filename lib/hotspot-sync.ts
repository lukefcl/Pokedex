import type { CatchRecord } from './storage';
import { recordKind } from './fish';
import { validPosition } from './catch-location';
type LocationJob = { user: string; id: string; remove: boolean; version: string };
type Queue = { owners: Record<string, string>; jobs: LocationJob[] };
const KEY = 'findex-location-outbox-v1';
export function locationQueue(): Queue {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : { owners: {}, jobs: [] };
}
function write(queue: Queue) {
  localStorage.setItem(KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event('findex-outbox'));
}
export function queuePosition(user: string, record: CatchRecord) {
  const queue = locationQueue();
  if (queue.owners[record.id] && queue.owners[record.id] !== user) return;
  if (recordKind(record) !== 'catch' || !validPosition(record.position)) {
    if (queue.owners[record.id]) removePosition(record.id);
    return;
  }
  queue.owners[record.id] = user;
  queue.jobs = queue.jobs.filter((j) => j.id !== record.id);
  queue.jobs.push({ user, id: record.id, remove: false, version: `${Date.now()}-${Math.random()}` });
  write(queue);
}
export function removePosition(id: string) {
  const queue = locationQueue();
  const user = queue.owners[id];
  if (!user) return;
  queue.jobs = queue.jobs.filter((j) => j.id !== id);
  queue.jobs.push({ user, id, remove: true, version: `${Date.now()}-${Math.random()}` });
  write(queue);
}
export function finishPosition(job: LocationJob) {
  const queue = locationQueue();
  queue.jobs = queue.jobs.filter((j) => j.version !== job.version);
  localStorage.setItem(KEY, JSON.stringify(queue));
}
