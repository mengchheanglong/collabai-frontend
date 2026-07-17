export interface Activity {
  actor: string;
  text: string;
  time: string;
  type: 'task' | 'ai' | 'comment' | 'project';
}
