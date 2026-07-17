export interface Project {
  id: string;
  name: string;
  team: string;
  progress: number;
  icon: string;
  accent: string;
  members: string[];
  description?: string;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  accent: string;
  projectNames: string[];
  description: string;
}
