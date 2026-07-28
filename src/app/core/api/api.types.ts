// src/app/core/api/api.types.ts
//
// Backend contract types (from docs/TYPESCRIPT-TYPES.md). These mirror exactly what the
// API returns — `_id`, `assigneeId`, contract enums — and are kept SEPARATE from the app's
// component models (which use `id`, names, etc.). Services map contract DTOs -> component
// models so the rest of the app is unaffected.

export type ObjectIdString = string;
export type ISODateString = string;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserDto {
  _id: ObjectIdString;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface ProjectMemberDto {
  userId: ObjectIdString;
  role: ProjectRole;
  name: string;
  email: string;
  avatarUrl?: string | null;
  joinedAt?: ISODateString | null;
}

export interface ProjectDto {
  _id: ObjectIdString;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  ownerId: ObjectIdString;
  isArchived?: boolean;
  members: ProjectMemberDto[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface BoardColumnDto {
  key: string;
  title: string;
  position: number;
}

export interface BoardDto {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  name: string;
  description?: string | null;
  columns: BoardColumnDto[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SubtaskDto {
  _id: ObjectIdString;
  title: string;
  done: boolean;
}

export interface TaskDto {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  boardId?: ObjectIdString | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  position: number;
  assigneeId?: ObjectIdString | null;
  createdById: ObjectIdString;
  dueDate?: ISODateString | null;
  labels: string[];
  subtasks: SubtaskDto[];
  commentCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface BoardWithTasksDto extends BoardDto {
  tasks: TaskDto[];
}

export interface CommentDto {
  _id: ObjectIdString;
  taskId: ObjectIdString;
  projectId: ObjectIdString;
  authorId: ObjectIdString;
  author: {
    _id: ObjectIdString;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  body: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
