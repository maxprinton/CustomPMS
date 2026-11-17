export const METHODS = ["predictive", "agile", "hybrid"] as const;
export const PHASES = ["initiation", "planning", "execution", "monitoring", "closing"] as const;
export const PROJECT_STATUSES = ["active", "on_hold", "done", "cancelled"] as const;
export const TASK_STATUSES = ["todo", "doing", "done", "blocked"] as const;

export function pick<T extends string>(list: readonly T[], value: string, fallback: T): T {
  return (list as readonly string[]).includes(value) ? (value as T) : fallback;
}
