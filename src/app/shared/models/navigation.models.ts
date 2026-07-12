export type PageKey = 'dashboard' | 'board' | 'team' | 'profile';
export type BoardView = 'kanban' | 'list';

export interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
}
