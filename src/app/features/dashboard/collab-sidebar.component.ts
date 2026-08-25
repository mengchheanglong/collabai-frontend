import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { ActivityStoreService } from '../../core/state/activity-store.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { ToastService } from '../../core/toast/toast.service';
import type { Member } from '../../shared/models/member.models';
import type { Activity } from '../../shared/models/activity.models';

export type CollabTab = 'team' | 'activity';

export interface ChatMessage {
  id: string;
  sender: string;
  senderId: string;
  color: string;
  avatar: string;
  text: string;
  time: string;
  isAi?: boolean;
}

@Component({
  selector: 'app-collab-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatRippleModule,
    MatTooltipModule,
    DatePipe,
  ],
  templateUrl: './collab-sidebar.component.html',
  styleUrl: './collab-sidebar.component.scss',
})
export class CollabSidebarComponent {
  private readonly router = inject(Router);
  readonly members = inject(MemberDirectoryService);
  readonly activities = inject(ActivityStoreService);
  readonly tasks = inject(TaskStoreService);
  private readonly toast = inject(ToastService);

  @Input() isOpen = true;
  @Output() toggleSidebar = new EventEmitter<void>();

  readonly activeTab = signal<CollabTab>('team');
  readonly searchQuery = signal('');
  readonly activityFilter = signal<'all' | 'task' | 'comment' | 'ai' | 'project'>('all');
  readonly chatInput = signal('');

  // Mock chat state seeded with team greetings & workspace updates
  readonly chatMessages = signal<ChatMessage[]>([
    {
      id: 'c1',
      sender: 'Sarah Jenkins',
      senderId: 'm1',
      color: '#3b82f6',
      avatar: 'SJ',
      text: 'Hey team! Pushed the latest design updates for the Kanban board.',
      time: '10:15 AM',
    },
    {
      id: 'c2',
      sender: 'Alex Rivera',
      senderId: 'm2',
      color: '#06b6d4',
      avatar: 'AR',
      text: 'Great work @Sarah! Reviewing the subtasks API integration now.',
      time: '10:32 AM',
    },
    {
      id: 'c3',
      sender: 'AI Assistant',
      senderId: 'ai',
      color: '#8b5cf6',
      avatar: 'AI',
      text: '💡 High priority task "Fix OAuth Refresh Token" needs assignment.',
      time: '11:05 AM',
      isAi: true,
    },
  ]);

  // Computed team member presence with live statuses
  readonly memberPresence = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const list = this.members.members();
    
    // Default online statuses map for display richness
    const statusMap: Record<string, 'online' | 'away' | 'busy' | 'offline'> = {
      '0': 'online',
      '1': 'online',
      '2': 'away',
      '3': 'busy',
    };

    return list
      .map((m, i) => {
        const presence = statusMap[i % 4] ?? 'online';
        return {
          ...m,
          presence,
          statusLabel: presence === 'online' ? 'Online' : presence === 'away' ? 'Away' : presence === 'busy' ? 'In a meeting' : 'Offline',
          currentActivity: i % 2 === 0 ? 'Working on Tasks' : 'Reviewing PRs',
        };
      })
      .filter(m => !query || m.name.toLowerCase().includes(query) || m.role.toLowerCase().includes(query));
  });

  readonly onlineCount = computed(() => {
    return this.memberPresence().filter(m => m.presence === 'online' || m.presence === 'busy').length;
  });

  // Filtered activity feed
  readonly filteredActivities = computed(() => {
    const filter = this.activityFilter();
    const list = this.activities.activities();
    if (filter === 'all') return list;
    return list.filter(a => a.type === filter);
  });

  // AI insights & team pulse calculations
  readonly unassignedTasksCount = computed(() => {
    return this.tasks.tasks().filter(t => !t.assigneeId && t.status !== 'done').length;
  });

  readonly highPrioTasksCount = computed(() => {
    return this.tasks.tasks().filter(t => t.status !== 'done' && (t.priority === 'high' || t.priority === 'urgent')).length;
  });

  setTab(tab: CollabTab): void {
    this.activeTab.set(tab);
  }

  sendChatMessage(): void {
    const text = this.chatInput().trim();
    if (!text) return;

    const user = this.members.currentUser;
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: user.name || 'Current User',
      senderId: user.id || 'me',
      color: user.color || '#3b82f6',
      avatar: user.avatar || 'ME',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.chatMessages.update(msgs => [...msgs, newMessage]);
    this.chatInput.set('');
    this.toast.show('Message sent to team', 'success');
  }

  nudgeMember(member: Member): void {
    this.toast.show(`Sent collaboration ping to ${member.name}`, 'info');
  }

  openBoard(): void {
    void this.router.navigate(['/board']);
  }

  activityIcon(type: Activity['type']): string {
    const map: Record<string, string> = {
      ai: 'auto_awesome',
      comment: 'chat_bubble',
      project: 'folder',
      task: 'task_alt',
    };
    return map[type] ?? 'bolt';
  }
}
