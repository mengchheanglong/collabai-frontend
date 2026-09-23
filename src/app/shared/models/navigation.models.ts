export type PageKey = 'dashboard' | 'work' | 'board' | 'team' | 'profile' | 'docs';
export type BoardView = 'kanban' | 'list';

export interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
}
