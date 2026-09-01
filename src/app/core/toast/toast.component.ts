import { Component, inject } from '@angular/core';
import { ToastService, ToastTone } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  toneIcon(tone: ToastTone): string {
    switch (tone) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'ai':
        return 'auto_awesome';
      default:
        return 'info';
    }
  }

  dismiss(): void {
    this.toastService.dismiss();
  }
}
