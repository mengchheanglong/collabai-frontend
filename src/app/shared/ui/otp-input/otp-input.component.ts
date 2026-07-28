import { Component, ElementRef, EventEmitter, Output, QueryList, ViewChildren, signal } from '@angular/core';

@Component({
  selector: 'app-otp-input',
  standalone: true,
  templateUrl: './otp-input.component.html',
})
export class OtpInputComponent {
  @Output() valueChange = new EventEmitter<string>();

  @ViewChildren('digitInput') private inputs!: QueryList<ElementRef<HTMLInputElement>>;

  readonly length = 6;
  readonly digits = signal<string[]>(Array(6).fill(''));
  readonly boxes = Array.from({ length: 6 }, (_, i) => i);

  onInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...this.digits()];
    next[index] = value;
    this.digits.set(next);

    if (value && index < this.length - 1) {
      this.focusBox(index + 1);
    }
    this.valueChange.emit(next.join(''));
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      this.focusBox(index - 1);
    }
  }

  onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text').replace(/[^0-9]/g, '') ?? '';
    if (!pasted) return;
    event.preventDefault();
    const next = Array(this.length).fill('');
    for (let i = 0; i < Math.min(pasted.length, this.length); i++) {
      next[i] = pasted[i];
    }
    this.digits.set(next);
    const lastIndex = Math.min(pasted.length, this.length) - 1;
    if (lastIndex >= 0) this.focusBox(lastIndex);
    this.valueChange.emit(next.join(''));
  }

  clear(): void {
    this.digits.set(Array(this.length).fill(''));
    this.focusBox(0);
  }

  private focusBox(index: number): void {
    setTimeout(() => this.inputs.get(index)?.nativeElement.focus());
  }
}
