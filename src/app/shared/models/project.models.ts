export interface Project {
  id: string;
  name: string;
  team: string;
  progress: number;
  icon: string;
  accent: string;
  members: string[];
  description?: string;
  /** Who owns the project, and each member's role keyed by user id (for "My projects" vs "Shared"). */
  ownerId?: string;
  ownerName?: string;
  roles?: Record<string, string>;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  accent: string;
  projectNames: string[];
  description: string;
  ownerId?: string;
  ownerName?: string;
  roles?: Record<string, string>;
}
