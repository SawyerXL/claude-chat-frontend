import type { Project } from '../types';

const PROJECTS_KEY = 'claude_projects';

export function getProjects(): Project[] {
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    if (!data) return [];
    return JSON.parse(data) as Project[];
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function createProject(name: string, icon: string = '📁', color: string = '#6366f1'): Project {
  const now = Date.now();
  return {
    id: `project-${now}`,
    name,
    icon,
    color,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateProject(project: Project): void {
  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = { ...project, updatedAt: Date.now() };
    saveProjects(projects);
  }
}

export function deleteProject(projectId: string): void {
  const projects = getProjects().filter(p => p.id !== projectId);
  saveProjects(projects);
}

// Default projects
export function getDefaultProjects(): Project[] {
  const now = Date.now();
  return [
    {
      id: 'default-work',
      name: 'Work',
      icon: '💼',
      color: '#6366f1',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-personal',
      name: 'Personal',
      icon: '🏠',
      color: '#10b981',
      createdAt: now,
      updatedAt: now,
    },
  ];
}
