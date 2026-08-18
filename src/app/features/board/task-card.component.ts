import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Task } from '../../shared/models/task.models';
import { priorityClass } from '../../shared/lib/person-display';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [MatTooltipModule, DatePipe],
  templateUrl: './task-card.component.html',
  host: {
    class: 'task-card',
    tabindex: '0',
    role: 'button',
    '[attr.aria-pressed]': 'selected()',
    '[class.selected]': 'selected()',
    '(click)': 'select.emit(task())',
    '(keydown.enter)': 'select.emit(task())',
    '(keydown.space)': 'select.emit(task()); $event.preventDefault()',
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
