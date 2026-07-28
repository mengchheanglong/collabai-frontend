export type PageKey = 'dashboard' | 'work' | 'board' | 'team' | 'profile';
export type BoardView = 'kanban' | 'list';

export interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
}
