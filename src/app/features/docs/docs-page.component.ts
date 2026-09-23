import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";
import {
  DocsApiService,
  DocumentSummary,
  WorkspaceDocument,
} from "../../core/api/docs-api.service";
import { WorkspaceContextService } from "../../core/workspace/workspace-context.service";
import { ProjectApiService } from "../../core/api/project-api.service";
import { AuthStoreService } from "../../core/state/auth-store.service";
import { renderMarkdown } from "./markdown";
@Component({
  selector: "app-docs-page",
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: "./docs-page.component.html",
  styleUrl: "./docs-page.component.scss",
})
export class DocsPageComponent {
  readonly workspace = inject(WorkspaceContextService);
  private readonly api = inject(DocsApiService);
  private readonly projects = inject(ProjectApiService);
  private readonly auth = inject(AuthStoreService);
  private readonly router = inject(Router);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  readonly id = computed(() => this.params()?.get("documentId") ?? null);
  readonly items = signal<DocumentSummary[]>([]);
  readonly document = signal<WorkspaceDocument | null>(null);
  readonly title = signal("");
  readonly content = signal("");
  readonly canEdit = signal(false);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly success = signal("");
  readonly preview = signal(false);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  search = "";
  readonly html = computed(() => renderMarkdown(this.content()));
  readonly dirty = computed(() =>
    this.document()
      ? this.title() !== this.document()!.title ||
        this.content() !== this.document()!.content
      : this.id() === "new" && !!(this.title() || this.content()),
  );
  private generation = 0;
  private editorProject: string | null = null;
  constructor() {
    effect(() => {
      const id = this.id();
      const project = id
        ? untracked(() => this.workspace.activeProjectId())
        : this.workspace.activeProjectId();
      untracked(() => {
        this.page.set(1);
        this.editorProject = project;
        void this.load(id, project);
      });
    });
  }
  @HostListener("window:beforeunload", ["$event"]) beforeUnload(
    event: BeforeUnloadEvent,
  ) {
    if (this.dirty() || this.busy()) event.preventDefault();
  }
  canLeave() {
    return (
      !this.busy() &&
      (!this.dirty() ||
        window.confirm("Discard your unsaved document changes?"))
    );
  }
  async load(id = this.id(), project = this.workspace.activeProjectId()) {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set("");
    this.success.set("");
    this.canEdit.set(false);
    try {
      if (id && id !== "new") {
        const result = await firstValueFrom(this.api.get(id));
        if (generation !== this.generation) return;
        this.document.set(result.document);
        this.title.set(result.document.title);
        this.content.set(result.document.content);
        this.canEdit.set(result.canEdit);
      } else {
        this.document.set(null);
        this.title.set("");
        this.content.set("");
        this.items.set([]);
        if (!project) return;
        const p = await firstValueFrom(this.projects.get(project));
        if (generation !== this.generation) return;
        const user = this.auth.currentUser();
        const role = p.members.find((m) => m.userId === user?._id)?.role;
        this.canEdit.set(["owner", "admin", "member"].includes(role ?? ""));
        if (!id) {
          const result = await firstValueFrom(
            this.api.list(project, this.page(), this.search),
          );
          if (generation !== this.generation) return;
          this.items.set(result.data);
          this.totalPages.set(result.meta?.totalPages ?? 0);
        }
      }
    } catch (e) {
      if (generation === this.generation) this.error.set(this.message(e));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  searchDocs() {
    this.page.set(1);
    void this.load();
  }
  changePage(delta: number) {
    this.page.update((p) => p + delta);
    void this.load();
  }
  async save() {
    if (this.busy() || !this.canEdit() || !this.title().trim()) return;
    const project = this.editorProject;
    const doc = this.document();
    if (!doc && !project) return;
    this.busy.set(true);
    this.error.set("");
    this.success.set("");
    try {
      const input = { title: this.title().trim(), content: this.content() };
      const result = await firstValueFrom(
        doc
          ? this.api.update(doc._id, { ...input, version: doc.version })
          : this.api.create(project!, input),
      );
      this.document.set(result.document);
      this.title.set(result.document.title);
      this.content.set(result.document.content);
      this.busy.set(false);
      if (!doc) await this.router.navigate(["/docs", result.document._id]);
      this.success.set("Document saved.");
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async remove() {
    const doc = this.document();
    if (!doc || this.busy() || !window.confirm("Delete this document?")) return;
    this.busy.set(true);
    this.error.set("");
    try {
      await firstValueFrom(this.api.remove(doc._id));
      this.title.set(doc.title);
      this.content.set(doc.content);
      this.busy.set(false);
      await this.router.navigate(["/docs"]);
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  private message(e: unknown): string {
    const error = e as { error?: { error?: { message?: string } } };
    return (
      error.error?.error?.message ??
      "Could not complete the request. Please try again."
    );
  }
}
