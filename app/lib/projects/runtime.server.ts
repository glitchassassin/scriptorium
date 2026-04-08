import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import {
  createStoredProject,
  deleteStoredProject,
  getStoredProject,
  listStoredProjects,
} from "~/lib/projects/store.server";
import { validateFileSelection } from "~/lib/projects/files.server";
import type { ProjectRecord } from "~/lib/projects/types";

type ProjectRuntimeEvent =
  | { type: "project.changed"; project: ProjectRecord }
  | { type: "project.removed"; projectId: string };

type ProjectRuntimeSubscriber = (event: ProjectRuntimeEvent) => void;

class ProjectRuntime {
  private readonly subscribers = new Set<ProjectRuntimeSubscriber>();

  private publish(event: ProjectRuntimeEvent) {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  listProjects() {
    return listStoredProjects();
  }

  getProject(id: string) {
    return getStoredProject(id);
  }

  subscribe(subscriber: ProjectRuntimeSubscriber) {
    this.subscribers.add(subscriber);

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  async createProject(input: { directory: string; name?: string | null }) {
    const selection = validateFileSelection(input.directory, "directory");
    const projectId = randomUUID();
    const name = input.name?.trim() || basename(selection.path);
    const stored = createStoredProject({
      id: projectId,
      name,
      directory: selection.path,
    });

    if (!stored) {
      throw new Error("Failed to create the project record.");
    }

    this.publish({ type: "project.changed", project: stored });

    return this.getProjectOrThrow(projectId);
  }

  async removeProject(id: string) {
    this.getProjectOrThrow(id);

    deleteStoredProject(id);
    this.publish({ type: "project.removed", projectId: id });
  }

  getProjectOrThrow(id: string) {
    const project = this.getProject(id);

    if (!project) {
      throw new Response("Project not found.", { status: 404 });
    }

    return project;
  }
}

type RuntimeGlobal = typeof globalThis & {
  __scriptoriumProjectRuntime?: ProjectRuntime;
};

const runtimeGlobal = globalThis as RuntimeGlobal;

function getRuntimeSingleton() {
  if (!runtimeGlobal.__scriptoriumProjectRuntime) {
    runtimeGlobal.__scriptoriumProjectRuntime = new ProjectRuntime();
  }

  return runtimeGlobal.__scriptoriumProjectRuntime;
}

function getRuntime() {
  return getRuntimeSingleton();
}

export async function ensureStarted() {
  getRuntime();
}

export async function listProjects() {
  return getRuntime().listProjects();
}

export async function getProject(id: string) {
  return getRuntime().getProject(id);
}

export async function getProjectOrThrow(id: string) {
  return getRuntime().getProjectOrThrow(id);
}

export async function createProject(input: { directory: string; name?: string | null }) {
  return getRuntime().createProject(input);
}

export async function removeProject(id: string) {
  return getRuntime().removeProject(id);
}

export function subscribeToProjectRuntimeEvents(subscriber: ProjectRuntimeSubscriber) {
  return getRuntimeSingleton().subscribe(subscriber);
}

export type { ProjectRuntimeEvent };
