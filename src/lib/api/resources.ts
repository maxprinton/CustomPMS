import type { ResourceConfig } from "@/lib/api/http";

const archived = { type: "boolean" } as const;

export const clients: ResourceConfig = {
  table: "clients", name: "client", select: "id, name, kind, notes, archived, created_at, updated_at", hasUpdatedAt: true,
  fields: {
    name: { type: "string", required: true, max: 200 },
    kind: { type: "enum", values: ["external", "internal"] },
    notes: { type: "string", nullable: true },
    archived,
  },
  filters: ["kind", "archived"],
  events: { created: "client.created", updated: "client.updated" },
};

export const projects: ResourceConfig = {
  table: "projects", name: "project", hasUpdatedAt: true,
  select: "id, client_id, name, code, method, phase, status, objective, sponsor, start_date, end_date, budget, archived, created_at, updated_at",
  fields: {
    name: { type: "string", required: true, max: 200 },
    code: { type: "string", max: 40, nullable: true },
    client_id: { type: "uuid", nullable: true },
    method: { type: "enum", values: ["predictive", "agile", "hybrid"] },
    phase: { type: "enum", values: ["initiation", "planning", "execution", "monitoring", "closing"] },
    status: { type: "enum", values: ["active", "on_hold", "done", "cancelled"] },
    objective: { type: "string", nullable: true },
    sponsor: { type: "string", max: 200, nullable: true },
    start_date: { type: "date", nullable: true },
    end_date: { type: "date", nullable: true },
    budget: { type: "number", min: 0, nullable: true },
    archived,
  },
  filters: ["client_id", "method", "phase", "status", "archived"],
  events: { created: "project.created", updated: "project.updated" },
};

export const tasks: ResourceConfig = {
  table: "tasks", name: "task", hasUpdatedAt: true,
  select: "id, project_id, title, status, due_date, notes, created_at, updated_at",
  fields: {
    project_id: { type: "uuid", required: true },
    title: { type: "string", required: true, max: 300 },
    status: { type: "enum", values: ["todo", "doing", "done", "blocked"] },
    due_date: { type: "date", nullable: true },
    notes: { type: "string", nullable: true },
  },
  filters: ["project_id", "status"],
  events: { created: "task.created", updated: "task.updated" },
};

export const backlog: ResourceConfig = {
  table: "backlog_items", name: "backlog item", hasUpdatedAt: true, notDeleted: true, defaults: { source: "api" },
  select: "id, number, project_id, title, type, status, size, area, spec_link, notes, parked_reason, value, effort, reopened_count, created_at, updated_at, status_changed_at, done_at",
  fields: {
    title: { type: "string", required: true, max: 200 },
    type: { type: "enum", values: ["feature", "improvement", "bug", "big_idea"] },
    status: { type: "enum", values: ["inbox", "later", "next", "now", "verifying", "done", "parked"] },
    project_id: { type: "uuid", nullable: true },
    size: { type: "enum", values: ["S", "M", "L"] },
    area: { type: "string", max: 60, nullable: true },
    spec_link: { type: "string", max: 300, nullable: true },
    notes: { type: "string", max: 4000, nullable: true },
    parked_reason: { type: "string", max: 300, nullable: true },
    value: { type: "number", min: 1, max: 3, nullable: true },
    effort: { type: "number", min: 1, max: 3, nullable: true },
  },
  filters: ["project_id", "status", "type", "number"],
  order: "number",
  events: { created: "backlog.created", updated: "backlog.moved" },
};
