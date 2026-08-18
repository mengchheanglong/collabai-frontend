import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ThemeService } from '../../core/theme/theme.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, ThemeToggleComponent, DragDropModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent implements OnDestroy {
  readonly theme = inject(ThemeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  activeDemoPage: 'dashboard' | 'board' | 'team' | 'profile' | 'settings' = 'board';
  demoRunning = false;
  demoSecondsLeft = 10;
  demoMoveNotice = false;
  navScrolled = false;
  heroPointerX = 0;
  heroPointerY = 0;
  heroPointerXPct = 50;
  heroPointerYPct = 50;
  heroTiltX = 0;
  heroTiltY = 0;
  private demoPageTimer?: number;
  private demoCountdownTimer?: number;
  private demoMoveTimer?: number;
  private demoNoticeTimer?: number;
  aiDemoQuestion = '';
  detailPage?: {
    title: string;
    intro: string;
    sections: { title: string; body: string }[];
  };
  aiDemoResponse =
    "I see you're starting the Q4 Roadmap. Would you like me to draft core milestones based on your team's velocity data?";

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.navScrolled = window.scrollY > 16;
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent): void {
    const normalizedX = (event.clientX / window.innerWidth) - 0.5;
    const normalizedY = (event.clientY / window.innerHeight) - 0.5;
    this.heroPointerX = normalizedX * 24;
    this.heroPointerY = normalizedY * 18;
    this.heroPointerXPct = event.clientX / window.innerWidth * 100;
    this.heroPointerYPct = event.clientY / window.innerHeight * 100;
    this.heroTiltX = normalizedY * -3;
    this.heroTiltY = normalizedX * 3;
  }

  @HostListener('window:mouseout', ['$event'])
  onWindowMouseOut(event: MouseEvent): void {
    if (!event.relatedTarget) {
      this.heroPointerX = 0;
      this.heroPointerY = 0;
      this.heroPointerXPct = 50;
      this.heroPointerYPct = 50;
      this.heroTiltX = 0;
      this.heroTiltY = 0;
    }
  }

  private readonly footerDescriptions: Record<string, string> = {
    Security: 'CollabAI protects workspace data with role-based access, encrypted connections, activity history, and secure team controls.',
    Integrations: 'Connect calendars, file storage, messaging, source control, and automation tools to the CollabAI workflow.',
    'About Us': 'CollabAI is building a clearer way for modern teams to plan, collaborate, and deliver work with practical AI assistance.',
    Careers: 'Join a thoughtful, ambitious team working across product, design, engineering, and customer experience.',
    Press: 'Find company news, product context, brand resources, and contact information for media requests.',
    Documentation: 'Explore setup guidance, workspace concepts, project workflows, task management, collaboration, and Copilot practices.',
    Blog: 'Read product updates, workflow advice, AI collaboration ideas, and stories from modern teams.',
    'Help Center': 'Find answers about accounts, workspaces, boards, permissions, notifications, and troubleshooting.',
    Community: 'Meet other builders and operators, exchange workflow ideas, share feedback, and help shape CollabAI.',
    Privacy: 'Learn what information CollabAI uses, why it is needed, how it is protected, and the choices available to you.',
    Terms: 'Review the shared expectations for responsible use of CollabAI, workspace content, and service access.',
    Cookies: 'Understand how essential and optional cookies support sessions, preferences, security, and product improvement.',
    Developers: 'Build connected workflows with CollabAI APIs, webhooks, integration patterns, and workspace events.',
    Status: 'Review the current health of the CollabAI web application, AI services, and supporting systems.',
  };

  private readonly footerSlugs: Record<string, string> = {
    Security: 'security', Integrations: 'integrations', 'About Us': 'about',
    Careers: 'careers', Press: 'press', Documentation: 'documentation',
    Blog: 'blog', 'Help Center': 'help', Community: 'community',
    Privacy: 'privacy', Terms: 'terms', Cookies: 'cookies',
    Developers: 'developers', Status: 'status',
  };

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('page');
      const title = Object.keys(this.footerSlugs).find((key) => this.footerSlugs[key] === slug);
      if (!slug || !title) {
        this.detailPage = undefined;
        return;
      }

      const intro = this.footerDescriptions[title];
      this.detailPage = {
        title,
        intro,
        sections: [
          {
            title: 'The essentials',
            body: `${intro} We keep the experience straightforward, transparent, and useful for both individual contributors and workspace administrators.`,
          },
          {
            title: 'Designed for real teams',
            body: `Our approach to ${title.toLowerCase()} supports day-to-day work across product, design, engineering, and operations. Information is organized clearly so teams can understand responsibilities and take action without unnecessary complexity.`,
          },
          {
            title: 'Guidance and support',
            body: `Need more detail about ${title.toLowerCase()}? Contact hello@collabai.dev. Our team can answer specific questions, clarify requirements, and help you choose the right next step for your workspace.`,
          },
        ],
      };
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    });
  }

  readonly demoColumns = [
    {
      id: 'demo-todo',
      title: 'To Do',
      color: '#71717a',
      tasks: [
        { title: 'Design landing page UI', tag: 'Frontend', tone: 'blue' },
        { title: 'Write API documentation', tag: 'Docs', tone: 'amber' },
        { title: 'Test AI summaries', tag: 'Testing', tone: 'gray' },
      ],
    },
    {
      id: 'demo-progress',
      title: 'In Progress',
      color: '#3b82f6',
      tasks: [
        { title: 'Build auth module', tag: 'Backend', tone: 'cyan' },
        { title: 'Project management API', tag: 'Backend', tone: 'cyan' },
        { title: 'Task drag and drop', tag: 'Frontend', tone: 'blue' },
      ],
    },
    {
      id: 'demo-done',
      title: 'Done',
      color: '#22c55e',
      tasks: [
        { title: 'Initialize project', tag: 'Setup', tone: 'green' },
        { title: 'Setup MongoDB schema', tag: 'Database', tone: 'green' },
      ],
    },
  ];

  readonly demoDropListIds = this.demoColumns.map((column) => column.id);

  showDemoPage(page: typeof this.activeDemoPage): void {
    this.activeDemoPage = page;
  }

  startDashboardDemo(): void {
    this.stopDashboardDemo();
    const movedTaskColumn = this.demoColumns.findIndex((column) =>
      column.tasks.some((task) => task.title === 'Design landing page UI'),
    );
    if (movedTaskColumn > 0) {
      const taskIndex = this.demoColumns[movedTaskColumn].tasks.findIndex(
        (task) => task.title === 'Design landing page UI',
      );
      transferArrayItem(
        this.demoColumns[movedTaskColumn].tasks,
        this.demoColumns[0].tasks,
        taskIndex,
        0,
      );
    }
    this.demoRunning = true;
    this.demoSecondsLeft = 10;

    const pages: (typeof this.activeDemoPage)[] = [
      'dashboard',
      'board',
      'team',
      'settings',
      'board',
    ];
    let pageIndex = 0;
    this.activeDemoPage = pages[pageIndex];

    document.getElementById('dashboard-demo')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    this.demoPageTimer = window.setInterval(() => {
      pageIndex += 1;
      if (pageIndex < pages.length) this.activeDemoPage = pages[pageIndex];
    }, 2000);

    this.demoMoveTimer = window.setTimeout(() => {
      const todoTasks = this.demoColumns[0].tasks;
      const taskIndex = todoTasks.findIndex((task) => task.title === 'Design landing page UI');
      if (taskIndex >= 0) {
        transferArrayItem(todoTasks, this.demoColumns[1].tasks, taskIndex, 0);
        this.demoMoveNotice = true;
        this.demoNoticeTimer = window.setTimeout(() => {
          this.demoMoveNotice = false;
        }, 1800);
      }
    }, 3000);

    this.demoCountdownTimer = window.setInterval(() => {
      this.demoSecondsLeft -= 1;
      if (this.demoSecondsLeft <= 0) this.stopDashboardDemo();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.stopDashboardDemo();
  }

  private stopDashboardDemo(): void {
    if (this.demoPageTimer) window.clearInterval(this.demoPageTimer);
    if (this.demoCountdownTimer) window.clearInterval(this.demoCountdownTimer);
    if (this.demoMoveTimer) window.clearTimeout(this.demoMoveTimer);
    if (this.demoNoticeTimer) window.clearTimeout(this.demoNoticeTimer);
    this.demoPageTimer = undefined;
    this.demoCountdownTimer = undefined;
    this.demoMoveTimer = undefined;
    this.demoNoticeTimer = undefined;
    this.demoMoveNotice = false;
    this.demoRunning = false;
  }

  scrollToLandingSection(sectionId: string, event: Event): void {
    event.preventDefault();
    if (this.detailPage) {
      void this.router.navigate(['/landing']).then(() => {
        window.setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  askDemoAi(input: HTMLInputElement): void {
    const question = input.value.trim();
    if (!question) return;

    this.answerDemoAi(question);
    input.value = '';
  }

  askDemoAiPreset(question: string): void {
    this.answerDemoAi(question);
  }

  openFooterInfo(title: string): void {
    const slug = this.footerSlugs[title];
    if (slug) {
      void this.router.navigate(['/landing', slug]).then(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    }
  }

  private answerDemoAi(question: string): void {
    this.aiDemoQuestion = question;
    const normalized = question.toLowerCase();

    if (normalized.includes('blocker') || normalized.includes('risk')) {
      this.aiDemoResponse =
        'I found two likely blockers: the authentication review is waiting on approval, and the API documentation task has no owner. I recommend assigning both today.';
    } else if (normalized.includes('roadmap') || normalized.includes('milestone')) {
      this.aiDemoResponse =
        'I drafted four milestones: Discovery, Core Build, Team Review, and Launch. Based on current velocity, the roadmap is achievable in six weeks.';
    } else if (normalized.includes('team') || normalized.includes('workload')) {
      this.aiDemoResponse =
        'The team is at 82% capacity. Sam has room for one small task, while Dara and Ben are near their weekly limits.';
    } else {
      this.aiDemoResponse =
        `I can help with “${question}”. For this demo, I would review your workspace tasks, owners, deadlines, and recent activity before suggesting the next best action.`;
    }
  }

  dropDemoTask(event: CdkDragDrop<(typeof this.demoColumns)[number]['tasks']>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
  }
}
