import { Component, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Task } from '../../shared/models/task.models';
import { priorityClass } from '../../shared/lib/person-display';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [MatTooltipModule],
  templateUrl: './task-card.component.html',
  host: {
    class: 'task-card',
    '[class.selected]': 'selected()',
    '(click)': 'select.emit(task())',
  },
})
export class TaskCardComponent {
  readonly task = input.required<Task>();
  readonly selected = input(false);
  readonly memberColor = input.required<(name: string) => string>();
  readonly initials = input.required<(name: string) => string>();
  readonly select = output<Task>();

  priorityClass = priorityClass;
}
