import {
  OnDestroy,
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
import { ActivatedRoute, Router } from "@angular/router";
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
import { SocketService } from "../../core/realtime/socket.service";
import { MatRippleModule } from "@angular/material/core";
import { MatMenuModule } from "@angular/material/menu";
import { VIEW_ONLY_MESSAGE, apiErrorMessage } from "../../core/api/api-error";

@Component({
  selector: "app-docs-page",
  standalone: true,
  imports: [FormsModule, DatePipe, MatRippleModule, MatMenuModule],
  templateUrl: "./docs-page.component.html",
  styleUrl: "./docs-page.component.scss",
})
export class DocsPageComponent implements OnDestroy {
  readonly workspace = inject(WorkspaceContextService);
  private readonly api = inject(DocsApiService);
  private readonly projects = inject(ProjectApiService);
  private readonly auth = inject(AuthStoreService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly socket = inject(SocketService);
  readonly activeEditors = signal<Record<string, { userId: string; name: string }>>({});
  readonly activeEditorsLabel = computed(() => {
    const editors = Object.values(this.activeEditors());
    if (!editors.length) return "";
    const names = editors.map((e) => e.name || "A collaborator");
    return `${names.join(", ")} ${names.length === 1 ? "is" : "are"} currently editing this document`;
  });
  readonly remoteConflict = signal<boolean>(false);
  private docEditingTimer?: ReturnType<typeof setTimeout>;
  private editorClearTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  readonly id = computed(() => this.params()?.get("documentId") ?? null);
  readonly items = signal<DocumentSummary[]>([]);
  readonly document = signal<WorkspaceDocument | null>(null);
  readonly title = signal("");
  readonly content = signal("");
  readonly attachments = signal<DocumentAttachment[]>([]);
  readonly fileType = signal<string | null>(null);
  readonly activePreviewAttachment = signal<DocumentAttachment | null>(null);
  readonly activePreviewDoc = signal<DocumentSummary | null>(null);

  readonly canEdit = signal(false);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly success = signal("");
  readonly preview = signal(false);
  readonly isDraggingOver = signal(false);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly viewMode = signal<"grid" | "list">("grid");
  search = "";

  readonly html = computed(() => renderMarkdown(this.content()));
  readonly safePdfUrl = computed<SafeResourceUrl | null>(() => {
    let att = this.activePreviewAttachment();
    if (!att) {
      att =
        this.attachments().find(
          (a) => a.type === "application/pdf" || a.name.toLowerCase().endsWith(".pdf")
        ) ?? null;
    }
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
    this.socket.events$.subscribe(({ name, event }) => {
      const currentDoc = this.document();
      if (!currentDoc) return;
      const currentDocId = currentDoc._id;
      const myId = this.auth.currentUser()?._id;

      if (name === "doc:editing:started" && event.data["documentId"] === currentDocId) {
        if (event.actorId !== myId) {
          const editorName = String(event.data["userName"] || event.data["name"] || "A teammate");
          const key = event.actorId;
          clearTimeout(this.editorClearTimers.get(key));
          this.activeEditors.update((eds) => ({
            ...eds,
            [key]: { userId: event.actorId, name: editorName },
          }));
          this.editorClearTimers.set(
            key,
            setTimeout(() => {
              this.activeEditors.update((eds) => {
                const next = { ...eds };
                delete next[key];
                return next;
              });
              this.editorClearTimers.delete(key);
            }, 5000),
          );
        }
      } else if (name === "doc:editing:stopped" && event.data["documentId"] === currentDocId) {
        const key = event.actorId;
        clearTimeout(this.editorClearTimers.get(key));
        this.editorClearTimers.delete(key);
        this.activeEditors.update((eds) => {
          const next = { ...eds };
          delete next[key];
          return next;
        });
      } else if (name === "document:updated") {
        const docData = event.data["document"] as any;
        if ((docData?.id === currentDocId || docData?._id === currentDocId) && event.actorId !== myId) {
          this.remoteConflict.set(true);
        }
      }
    });
  }

  @HostListener("window:beforeunload", ["$event"]) beforeUnload(
    event: BeforeUnloadEvent,
  ) {
    if (this.dirty() || this.busy()) event.preventDefault();
  }
  ngOnDestroy() {
    clearTimeout(this.docEditingTimer);
    for (const t of this.editorClearTimers.values()) clearTimeout(t);
    this.editorClearTimers.clear();
    const doc = this.document();
    if (doc) this.socket.docEditing(doc._id, false);
  }

  onEditorInput() {
    const doc = this.document();
    if (!doc || !this.canEdit()) return;
    this.socket.docEditing(doc._id, true);
    clearTimeout(this.docEditingTimer);
    this.docEditingTimer = setTimeout(() => {
      this.socket.docEditing(doc._id, false);
    }, 2500);
  }

  reloadRemoteVersion() {
    this.remoteConflict.set(false);
    void this.load();
    this.success.set("Reloaded latest version from server.");
  }

  dismissRemoteConflict() {
    this.remoteConflict.set(false);
  }

  exportMarkdown() {
    const content = this.content();
    const rawTitle = this.title().trim() || "document";
    const filename = `${rawTitle.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}.md`;
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : "";
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body?.appendChild(a);
      a.click();
      document.body?.removeChild(a);
      if (typeof URL.revokeObjectURL === "function" && url) URL.revokeObjectURL(url);
    }
    this.success.set(`Exported "${filename}"`);
  }

  exportPdf() {
    this.preview.set(true);
    if (typeof window !== "undefined" && typeof window.print === "function") {
      setTimeout(() => {
        window.print();
      }, 200);
    }
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
        const atts = result.document.attachments ?? [];
        this.attachments.set(atts);
        this.fileType.set(result.document.fileType ?? null);
        this.canEdit.set(result.canEdit);
        if (!result.canEdit) this.preview.set(true);

        const pdfAtt = atts.find(
          (a) => a.type === "application/pdf" || a.name.toLowerCase().endsWith(".pdf"),
        );
        if (pdfAtt) {
          this.activePreviewAttachment.set(pdfAtt);
        }
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

  clearSearch() {
    this.search = "";
    this.searchDocs();
  }

  setViewMode(mode: "grid" | "list") {
    this.viewMode.set(mode);
  }

  changePage(delta: number) {
    this.page.update((p) => p + delta);
    void this.load();
  }

  async save() {
    if (this.busy() || this.blockViewer()) return;
    const project = this.editorProject;
    const doc = this.document();
    if (!doc && !project) return;
    const derivedTitle =
      this.title().trim() ||
      this.attachments()[0]?.name ||
      "Untitled document";
    this.busy.set(true);
    this.error.set("");
    this.success.set("");
    try {
      const input = {
        title: derivedTitle,
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
    if (!doc || this.busy() || this.blockViewer()) return;
    if (!window.confirm("Delete this document?")) return;
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

  downloadDoc(doc: DocumentSummary) {
    const att = doc.attachments?.[0];
    if (att?.dataUrl) {
      this.downloadAttachment(att);
      return;
    }
    this.busy.set(true);
    firstValueFrom(this.api.get(doc._id))
      .then((res) => {
        const fetchedAtt = res.document.attachments?.[0];
        if (fetchedAtt?.dataUrl) {
          this.downloadAttachment(fetchedAtt);
        } else if (res.document.content) {
          const blob = new Blob([res.document.content], { type: "text/markdown;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${(doc.title || "document").replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
          document.body?.appendChild(a);
          a.click();
          document.body?.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          this.error.set("No downloadable attachment found.");
        }
      })
      .catch((err) => {
        this.error.set(this.message(err));
      })
      .finally(() => {
        this.busy.set(false);
      });
  }

  async deleteDocument(doc: DocumentSummary) {
    if (this.busy() || !this.canEdit() || !window.confirm(`Delete "${doc.title}"?`)) return;
    this.busy.set(true);
    this.error.set("");
    try {
      await firstValueFrom(this.api.remove(doc._id));
      this.items.update((list) => list.filter((d) => d._id !== doc._id));
      if (this.activePreviewDoc()?._id === doc._id) {
        this.closePreview();
      }
      this.success.set(`Deleted "${doc.title}".`);
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }

  openDocument(doc: DocumentSummary) {
    const ext = this.getFileExtension(doc.title);
    const pdfAtt = doc.attachments?.find(
      (a) => a.type === "application/pdf" || a.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfAtt) {
      this.activePreviewDoc.set(doc);
      this.activePreviewAttachment.set(pdfAtt);
      return;
    }
    const imgAtt = doc.attachments?.find(
      (a) =>
        a.type?.startsWith("image/") ||
        ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(this.getFileExtension(a.name)),
    );
    if (imgAtt) {
      this.activePreviewDoc.set(doc);
      this.activePreviewAttachment.set(imgAtt);
      return;
    }
    if (["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "md", "markdown", "txt"].includes(ext)) {
      this.activePreviewDoc.set(doc);
      if (doc.attachments?.[0]) {
        this.activePreviewAttachment.set(doc.attachments[0]);
      }
      return;
    }
    this.downloadDoc(doc);
  }

  closePreview() {
    this.activePreviewDoc.set(null);
    this.activePreviewAttachment.set(null);
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

  getFileBadge(name: string, type?: string | null): { label: string; class: string; icon: string; matIcon: string } {
    const ext = this.getFileExtension(name);
    if (ext === "pdf" || type === "application/pdf") {
      return { label: "PDF", class: "badge-pdf", icon: "📕", matIcon: "picture_as_pdf" };
    }
    if (["doc", "docx"].includes(ext) || type?.includes("word") || type?.includes("officedocument")) {
      return { label: ext ? ext.toUpperCase() : "DOCX", class: "badge-doc", icon: "📘", matIcon: "description" };
    }
    if (["md", "markdown"].includes(ext)) {
      return { label: "MD", class: "badge-md", icon: "📑", matIcon: "article" };
    }
    if (["txt", "log", "json", "csv", "xml"].includes(ext)) {
      return {
        label: ext ? ext.toUpperCase() : "TXT",
        class: "badge-txt",
        icon: "📝",
        matIcon: ext === "csv" ? "table_chart" : "text_snippet",
      };
    }
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext) || type?.startsWith("image/")) {
      return { label: "IMG", class: "badge-img", icon: "🖼️", matIcon: "image" };
    }
    return { label: ext ? ext.toUpperCase() : "FILE", class: "badge-file", icon: "📎", matIcon: "draft" };
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  async processUploadedFiles(files: FileList | File[]) {
    if (this.busy() || this.blockViewer()) return;
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

  onMainFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      void this.processAndUploadFiles(event.dataTransfer.files);
    }
  }

  onFilesSelectedForNew(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.processAndUploadFiles(input.files);
    }
    input.value = "";
  }

  async processAndUploadFiles(files: FileList | File[]) {
    if (this.busy() || this.blockViewer()) return;
    const project = this.workspace.activeProjectId();
    if (!project) {
      this.error.set("Please select or create a project first.");
      return;
    }
    this.busy.set(true);
    this.error.set("");
    try {
      let created = 0;
      let lastDocId: string | null = null;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 20 * 1024 * 1024) {
          this.error.set(`File "${file.name}" exceeds the 20MB limit.`);
          continue;
        }
        const ext = this.getFileExtension(file.name);
        const title = this.cleanTitleFromFilename(file.name) || file.name;
        let content = "";
        let dataUrl = "";
        if (["md", "markdown", "txt"].includes(ext)) {
          try {
            content = await this.readFileAsText(file);
          } catch {
            content = "";
          }
          dataUrl = await this.readFileAsDataUrl(file);
        } else if (ext === "pdf") {
          dataUrl = await this.readFileAsDataUrl(file);
          content = `# ${title}\n\nUploaded PDF document: **${file.name}** (${this.formatBytes(file.size)}).`;
        } else if (["doc", "docx"].includes(ext)) {
          dataUrl = await this.readFileAsDataUrl(file);
          content = `# ${title}\n\nUploaded Word document: **${file.name}** (${this.formatBytes(file.size)}).`;
        } else {
          dataUrl = await this.readFileAsDataUrl(file);
          content = `# ${title}\n\nUploaded file: **${file.name}** (${this.formatBytes(file.size)}).`;
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
        created++;
        lastDocId = result.document._id;
      }

      if (this.id() === "new" && lastDocId) {
        await this.router.navigate(["/docs", lastDocId]);
      } else {
        await this.load();
      }
      if (created > 0) {
        this.success.set(`Uploaded ${created} file(s) successfully.`);
      }
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }

  async uploadNewDocumentFromFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.processAndUploadFiles(input.files);
    }
    input.value = "";
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
    if (this.blockViewer()) return;
    const atts = this.attachments();
    const removed = atts[index];
    if (this.activePreviewAttachment()?.id === removed?.id) {
      this.activePreviewAttachment.set(null);
    }
    this.attachments.set(atts.filter((_, i) => i !== index));
  }

  /** Viewers are read-only: explain instead of silently ignoring the action. */
  private blockViewer(): boolean {
    if (this.canEdit()) return false;
    this.error.set(VIEW_ONLY_MESSAGE);
    return true;
  }

  private message(e: unknown): string {
    return apiErrorMessage(e, "Could not complete the request. Please try again.");
  }
}
