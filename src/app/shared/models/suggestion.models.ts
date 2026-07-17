export interface Suggestion {
  id: string;
  title: string;
  body: string;
  category: 'Timeline' | 'Workload' | 'Tasks' | 'Risk' | 'Team';
  impact: 'High' | 'Medium' | 'Low';
  action: string;
}
