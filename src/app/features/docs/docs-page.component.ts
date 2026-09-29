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
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";
import {
  DocsApiService,
  DocumentAttachment,
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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  readonly id = computed(() => this.params()?.get("documentId") ?? null);
  readonly items = signal<DocumentSummary[]>([]);
  readonly document = signal<WorkspaceDocument | null>(null);
  readonly title = signal("");
  readonly content = signal("");
  readonly attachments = signal<DocumentAttachment[]>([]);
  readonly fileType = signal<string | null>(null);
  readonly activePreviewAttachment = signal<DocumentAttachment | null>(null);

  readonly canEdit = signal(false);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly success = signal("");
  readonly preview = signal(false);
  readonly isDraggingOver = signal(false);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  search = "";

  readonly html = computed(() => renderMarkdown(this.content()));
  readonly safePdfUrl = computed<SafeResourceUrl | null>(() => {
    const att = this.activePreviewAttachment();
    if (!att?.dataUrl) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(att.dataUrl);
  });

  readonly dirty = computed(() => {
    const doc = this.document();
    if (doc) {
      const attsA = JSON.stringify(this.attachments());
      const attsB = JSON.stringify(doc.attachments ?? []);
      return (
        this.title() !== doc.title ||
        this.content() !== doc.content ||
        attsA !== attsB
      );
    }
    return (
      this.id() === "new" &&
      !!(this.title() || this.content() || this.attachments().length > 0)
    );
  });

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
    this.activePreviewAttachment.set(null);
    try {
      if (id && id !== "new") {
        const result = await firstValueFrom(this.api.get(id));
        if (generation !== this.generation) return;
        this.document.set(result.document);
        this.title.set(result.document.title);
        this.content.set(result.document.content);
        this.attachments.set(result.document.attachments ?? []);
        this.fileType.set(result.document.fileType ?? null);
        this.canEdit.set(result.canEdit);
      } else {
        this.document.set(null);
        this.title.set("");
        this.content.set("");
        this.attachments.set([]);
        this.fileType.set(null);
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
      const input = {
        title: this.title().trim(),
        content: this.content(),
        attachments: this.attachments(),
        fileType: this.fileType(),
      };
      const result = await firstValueFrom(
        doc
          ? this.api.update(doc._id, { ...input, version: doc.version })
          : this.api.create(project!, input),
      );
      this.document.set(result.document);
      this.title.set(result.document.title);
      this.content.set(result.document.content);
      this.attachments.set(result.document.attachments ?? []);
      this.fileType.set(result.document.fileType ?? null);
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
      this.attachments.set([]);
      this.busy.set(false);
      await this.router.navigate(["/docs"]);
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }

  // ============ FILE UPLOAD & ATTACHMENT HANDLING ============

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read text file ${file.name}`));
      reader.readAsText(file);
    });
  }

  cleanTitleFromFilename(name: string): string {
    const lastDot = name.lastIndexOf(".");
    const base = lastDot > 0 ? name.substring(0, lastDot) : name;
    return base.replace(/[_-]+/g, " ").trim();
  }

  getFileExtension(name: string): string {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  }

  getFileBadge(name: string, type?: string | null): { label: string; class: string; icon: string } {
    const ext = this.getFileExtension(name);
    if (ext === "pdf" || type === "application/pdf") {
      return { label: "PDF", class: "badge-pdf", icon: "📕" };
    }
    if (["doc", "docx"].includes(ext) || type?.includes("word") || type?.includes("officedocument")) {
      return { label: ext ? ext.toUpperCase() : "DOCX", class: "badge-doc", icon: "📘" };
    }
    if (["md", "markdown"].includes(ext)) {
      return { label: "MD", class: "badge-md", icon: "📑" };
    }
    if (["txt", "log", "json", "csv", "xml"].includes(ext)) {
      return { label: ext ? ext.toUpperCase() : "TXT", class: "badge-txt", icon: "📝" };
    }
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext) || type?.startsWith("image/")) {
      return { label: "IMG", class: "badge-img", icon: "🖼️" };
    }
    return { label: ext ? ext.toUpperCase() : "FILE", class: "badge-file", icon: "📎" };
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  async processUploadedFiles(files: FileList | File[]) {
    if (this.busy() || !this.canEdit()) return;
    this.busy.set(true);
    this.error.set("");
    try {
      const newAttachments: DocumentAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 20 * 1024 * 1024) {
          this.error.set(`File "${file.name}" exceeds the 20MB limit.`);
          continue;
        }
        const dataUrl = await this.readFileAsDataUrl(file);
        const ext = this.getFileExtension(file.name);
        newAttachments.push({
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : "att_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
          name: file.name,
          size: file.size,
          type:
            file.type ||
            (ext === "pdf"
              ? "application/pdf"
              : ext === "docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "application/octet-stream"),
          dataUrl,
          uploadedAt: new Date().toISOString(),
        });
      }
      if (newAttachments.length > 0) {
        this.attachments.update((list) => [...list, ...newAttachments]);
        this.success.set(`Attached ${newAttachments.length} file(s).`);
      }
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.processUploadedFiles(input.files);
    }
    input.value = "";
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      void this.processUploadedFiles(event.dataTransfer.files);
    }
  }

  async uploadNewDocumentFromFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const project = this.workspace.activeProjectId();
    if (!project) {
      this.error.set("Please select or create a project first.");
      input.value = "";
      return;
    }
    this.busy.set(true);
    this.error.set("");
    try {
      const ext = this.getFileExtension(file.name);
      const title = this.cleanTitleFromFilename(file.name) || file.name;
      let content = "";
      let dataUrl = "";
      if (file.size > 20 * 1024 * 1024) {
        throw new Error(`File "${file.name}" exceeds the 20MB limit.`);
      }

      if (["md", "markdown", "txt"].includes(ext)) {
        content = await this.readFileAsText(file);
        dataUrl = await this.readFileAsDataUrl(file);
      } else if (ext === "pdf") {
        dataUrl = await this.readFileAsDataUrl(file);
        content = `# ${title}\n\nUploaded PDF document: **${file.name}** (${this.formatBytes(file.size)}).\n\nUse the preview or download buttons below to view this file.`;
      } else if (["doc", "docx"].includes(ext)) {
        dataUrl = await this.readFileAsDataUrl(file);
        content = `# ${title}\n\nUploaded Word document: **${file.name}** (${this.formatBytes(file.size)}).\n\nClick below to download or view the attached document.`;
      } else {
        dataUrl = await this.readFileAsDataUrl(file);
        content = `# ${title}\n\nAttached file: **${file.name}** (${this.formatBytes(file.size)}).`;
      }

      const attachment: DocumentAttachment = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "att_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
        name: file.name,
        size: file.size,
        type:
          file.type ||
          (ext === "pdf"
            ? "application/pdf"
            : ext === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/octet-stream"),
        dataUrl,
        uploadedAt: new Date().toISOString(),
      };

      const result = await firstValueFrom(
        this.api.create(project, {
          title,
          content,
          fileType: ext,
          attachments: [attachment],
        }),
      );

      this.busy.set(false);
      await this.router.navigate(["/docs", result.document._id]);
      this.success.set(`Created document from ${file.name}`);
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
      input.value = "";
    }
  }

  async importMarkdownOrText(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (
        this.content().trim() &&
        !window.confirm("Replace editor content with this file?")
      ) {
        input.value = "";
        return;
      }
      const text = await this.readFileAsText(file);
      this.content.set(text);
      if (!this.title().trim() || this.title() === "Untitled document") {
        this.title.set(this.cleanTitleFromFilename(file.name));
      }
      const ext = this.getFileExtension(file.name);
      if (["md", "markdown"].includes(ext)) {
        this.fileType.set("md");
      }
      this.success.set(`Imported ${file.name}`);
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      input.value = "";
    }
  }

  downloadAttachment(att: DocumentAttachment) {
    if (!att.dataUrl) return;
    const a = document.createElement("a");
    a.href = att.dataUrl;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  togglePdfPreview(att: DocumentAttachment) {
    if (this.activePreviewAttachment()?.id === att.id) {
      this.activePreviewAttachment.set(null);
    } else {
      this.activePreviewAttachment.set(att);
    }
  }

  insertAttachmentMarkdown(att: DocumentAttachment) {
    const badge = this.getFileBadge(att.name, att.type);
    const linkText = `${badge.icon} ${att.name}`;
    const md = `\n\n[${linkText}](${att.dataUrl ?? "#"})\n\n`;
    this.content.update((c) => c + md);
    this.success.set(`Inserted link for ${att.name}`);
  }

  removeAttachment(index: number) {
    if (!this.canEdit()) return;
    const atts = this.attachments();
    const removed = atts[index];
    if (this.activePreviewAttachment()?.id === removed?.id) {
      this.activePreviewAttachment.set(null);
    }
    this.attachments.set(atts.filter((_, i) => i !== index));
  }

  private message(e: unknown): string {
    const error = e as { error?: { error?: { message?: string } } };
    return (
      error.error?.error?.message ??
      "Could not complete the request. Please try again."
    );
  }
}
