import type {
  AdminUserList,
  AuthResponse,
  AuthUser,
  Course,
  CourseSeries,
  CourseSeriesDetail,
  CourseSummary,
  FileImportBatch,
  GenerationJob
} from "./types";

const DEFAULT_PUBLIC_API_BASE_URL = "http://localhost:8000";
const DEFAULT_SERVER_API_BASE_URL = "http://127.0.0.1:8000";
const CONFIGURED_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const PUBLIC_API_BASE_URL = CONFIGURED_PUBLIC_API_BASE_URL || DEFAULT_PUBLIC_API_BASE_URL;
const AUTH_TOKEN_STORAGE_KEY = "pagealong_auth_token";

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function resolveServerApiBaseUrl(): string {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  if (CONFIGURED_PUBLIC_API_BASE_URL && isAbsoluteHttpUrl(CONFIGURED_PUBLIC_API_BASE_URL)) {
    return CONFIGURED_PUBLIC_API_BASE_URL;
  }

  return DEFAULT_SERVER_API_BASE_URL;
}

const SERVER_API_BASE_URL = resolveServerApiBaseUrl();

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return trimTrailingSlash(SERVER_API_BASE_URL);
  }

  return trimTrailingSlash(PUBLIC_API_BASE_URL);
}

function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

function queryString(params: Record<string, string | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function getAuthToken(): string {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return "";
  }
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? "";
}

function headersToRecord(init?: HeadersInit): Record<string, string> {
  if (!init) {
    return {};
  }
  if (Array.isArray(init)) {
    return Object.fromEntries(init.map(([key, value]) => [key, value]));
  }
  if (typeof Headers !== "undefined" && init instanceof Headers) {
    return Object.fromEntries(init.entries());
  }
  return { ...(init as Record<string, string>) };
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

export function storeAuthToken(token: string): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

async function apiFetch(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const headers = headersToRecord(init.headers);
  if (auth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    cache: init.cache
  });
  if (auth && response.status === 401) {
    clearAuthToken();
  }
  return response;
}

function jsonHeaders(init?: HeadersInit): Record<string, string> {
  return {
    ...headersToRecord(init),
    "Content-Type": "application/json"
  };
}

async function apiJson<T>(path: string, init: RequestInit = {}, fallback = "Request failed", auth = true): Promise<T> {
  const response = await apiFetch(path, init, auth);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, fallback));
  }
  return (await response.json()) as T;
}

async function apiNoContent(path: string, init: RequestInit = {}, fallback = "Request failed", auth = true): Promise<void> {
  const response = await apiFetch(path, init, auth);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, fallback));
  }
}

export function courseAudioUrl(courseId: string): string {
  return apiUrl(`/courses/${courseId}/audio`);
}

export type CourseDownloadFormat = "markdown" | "docx" | "pdf" | "audio";

export function mediaUrl(value: string): string {
  if (isAbsoluteHttpUrl(value)) {
    return value;
  }
  if (value.startsWith("/")) {
    return apiUrl(value);
  }
  return value;
}

export async function requestEmailCode(input: {
  email: string;
  purpose: "register" | "password_reset";
}): Promise<void> {
  await apiNoContent(
    "/auth/email/code",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    "Failed to send verification code",
    false
  );
}

export async function registerWithEmail(input: {
  email: string;
  password: string;
  code: string;
}): Promise<AuthUser> {
  const body = await apiJson<AuthResponse>(
    "/auth/register",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    "Failed to register",
    false
  );
  storeAuthToken(body.token);
  return body.user;
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const body = await apiJson<AuthResponse>(
    "/auth/login",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    "Failed to sign in",
    false
  );
  storeAuthToken(body.token);
  return body.user;
}

export async function getCurrentUser(): Promise<AuthUser> {
  return apiJson<AuthUser>("/auth/me", { cache: "no-store" }, "Failed to load account");
}

export async function logoutCurrentSession(): Promise<void> {
  try {
    await apiNoContent("/auth/logout", { method: "POST" }, "Failed to sign out");
  } finally {
    clearAuthToken();
  }
}

export async function logoutAllSessions(): Promise<void> {
  try {
    await apiNoContent("/auth/logout-all", { method: "POST" }, "Failed to sign out all sessions");
  } finally {
    clearAuthToken();
  }
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiNoContent(
    "/auth/change-password",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        current_password: input.currentPassword,
        new_password: input.newPassword
      })
    },
    "Failed to change password"
  );
}

export async function requestPasswordResetCode(email: string): Promise<void> {
  await apiNoContent(
    "/auth/password-reset/code",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email })
    },
    "Failed to send reset code",
    false
  );
}

export async function confirmPasswordReset(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  await apiNoContent(
    "/auth/password-reset/confirm",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        email: input.email,
        code: input.code,
        new_password: input.newPassword
      })
    },
    "Failed to reset password",
    false
  );
}

export async function listAdminUsers(input: {
  query?: string;
  role?: "user" | "admin" | "";
  status?: "active" | "disabled" | "";
} = {}): Promise<AuthUser[]> {
  const body = await apiJson<AdminUserList>(
    `/admin/users${queryString({
      query: input.query,
      role: input.role,
      status: input.status
    })}`,
    { cache: "no-store" },
    "Failed to load users"
  );
  return body.items;
}

export async function updateAdminUserStatus(userId: string, action: "enable" | "disable"): Promise<AuthUser> {
  return apiJson<AuthUser>(
    `/admin/users/${userId}/${action}`,
    { method: "POST" },
    "Failed to update user"
  );
}

export async function updateAdminUserRole(userId: string, action: "promote" | "demote"): Promise<AuthUser> {
  return apiJson<AuthUser>(
    `/admin/users/${userId}/${action}`,
    { method: "POST" },
    "Failed to update role"
  );
}

export async function forceLogoutAdminUser(userId: string): Promise<void> {
  await apiNoContent(`/admin/users/${userId}/force-logout`, { method: "POST" }, "Failed to force logout");
}

export async function sendAdminPasswordReset(userId: string): Promise<void> {
  await apiNoContent(
    `/admin/users/${userId}/send-password-reset`,
    { method: "POST" },
    "Failed to send reset email"
  );
}

export async function listCourses(input: {
  libraryType?: "all" | "fragmented" | "series";
  query?: string;
  tag?: string;
  starred?: boolean;
} = {}): Promise<CourseSummary[]> {
  const body = await apiJson<{ items: CourseSummary[] }>(
    `/courses${queryString({
      library_type: input.libraryType,
      query: input.query,
      tag: input.tag,
      starred: input.starred
    })}`,
    { cache: "no-store" },
    "Failed to load courses"
  );
  return body.items;
}

export async function listCourseSeries(input: {
  query?: string;
  tag?: string;
  starred?: boolean;
} = {}): Promise<CourseSeries[]> {
  const body = await apiJson<{ items: CourseSeries[] }>(
    `/courses/series${queryString({
      query: input.query,
      tag: input.tag,
      starred: input.starred
    })}`,
    { cache: "no-store" },
    "Failed to load course series"
  );
  return body.items;
}

export async function getCourseSeries(seriesId: string): Promise<CourseSeriesDetail> {
  return apiJson<CourseSeriesDetail>(
    `/courses/series/${seriesId}`,
    { cache: "no-store" },
    "Failed to load course series"
  );
}

export async function listCourseTags(): Promise<string[]> {
  const body = await apiJson<{ items: string[] }>("/courses/tags", { cache: "no-store" }, "Failed to load course tags");
  return body.items;
}

export async function createTextCourse(input: {
  title: string;
  text: string;
  seriesTitle?: string;
}): Promise<Course> {
  return apiJson<Course>(
    "/courses",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: input.title,
        text: input.text,
        source_type: "manual_text",
        series_title: input.seriesTitle || undefined
      })
    },
    "Failed to create course"
  );
}

export async function createUrlCourse(input: {
  url: string;
  title?: string;
  seriesTitle?: string;
}): Promise<Course> {
  return apiJson<Course>(
    "/courses/import-url",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        url: input.url,
        title: input.title || undefined,
        series_title: input.seriesTitle || undefined
      })
    },
    "Failed to import URL"
  );
}

export async function createExtensionSyncCourse(input: {
  url: string;
  title?: string;
  seriesTitle?: string;
}): Promise<Course> {
  return apiJson<Course>(
    "/courses/import-url/extension-sync",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        url: input.url,
        title: input.title || undefined,
        series_title: input.seriesTitle || undefined,
        article_html: "",
        text_excerpt: "",
        images: [],
        client_metadata: {
          source: "mobile_web_entry"
        }
      })
    },
    "Failed to sync URL"
  );
}

export async function getCourse(courseId: string): Promise<Course> {
  return apiJson<Course>(`/courses/${courseId}`, { cache: "no-store" }, "Failed to load course");
}

export async function createFileImportBatch(input: {
  files: File[];
  relativePaths: string[];
  sourceMode: "single_file" | "multiple_files" | "folder";
  seriesTitle?: string;
  seriesId?: string;
}): Promise<FileImportBatch> {
  const formData = new FormData();
  input.files.forEach((file) => {
    formData.append("files", file);
  });
  formData.set("source_mode", input.sourceMode);
  formData.set("relative_paths_json", JSON.stringify(input.relativePaths));
  if (input.seriesTitle) {
    formData.set("series_title", input.seriesTitle);
  }
  if (input.seriesId) {
    formData.set("series_id", input.seriesId);
  }

  const response = await apiFetch("/courses/import-files", { method: "POST", body: formData });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to import files"));
  }
  return (await response.json()) as FileImportBatch;
}

export async function getFileImportBatch(batchId: string): Promise<FileImportBatch> {
  return apiJson<FileImportBatch>(`/courses/file-import-batches/${batchId}`, { cache: "no-store" }, "Failed to load file import batch");
}

export async function requestCourseAudioGeneration(courseId: string): Promise<GenerationJob> {
  return apiJson<GenerationJob>(
    `/courses/${courseId}/audio-generation`,
    { method: "POST" },
    "Failed to request audio generation"
  );
}

export async function retryFailedCourseJob(courseId: string): Promise<GenerationJob> {
  return apiJson<GenerationJob>(
    `/courses/${courseId}/retry-failed-job`,
    { method: "POST" },
    "Failed to retry failed task"
  );
}

export async function downloadCourseToBrowser(courseId: string, format: CourseDownloadFormat): Promise<void> {
  const path = format === "audio" ? `/courses/${courseId}/audio-download` : `/courses/${courseId}/exports/${format}`;
  const response = await apiFetch(path);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to download course"));
  }
  const blob = await response.blob();
  const filename = filenameFromContentDisposition(response.headers.get("content-disposition")) || fallbackDownloadFilename(format);
  triggerBrowserDownload(blob, filename);
}

function filenameFromContentDisposition(value: string | null): string {
  if (!value) {
    return "";
  }
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return encoded[1];
    }
  }
  const quoted = value.match(/filename="([^"]+)"/i);
  if (quoted) {
    return quoted[1];
  }
  const plain = value.match(/filename=([^;]+)/i);
  return plain?.[1]?.trim() ?? "";
}

function fallbackDownloadFilename(format: CourseDownloadFormat): string {
  if (format === "audio") {
    return "course-audio.mp3";
  }
  return `course.${format === "markdown" ? "md" : format}`;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
}

export async function savePlaybackProgress(input: {
  courseId: string;
  positionSeconds: number;
  sentenceIndex: number;
}): Promise<void> {
  await apiNoContent(
    `/courses/${input.courseId}/progress`,
    {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        position_seconds: Math.floor(input.positionSeconds),
        sentence_index: input.sentenceIndex
      })
    },
    "Failed to save progress"
  );
}

export async function deleteCourse(courseId: string): Promise<void> {
  await apiNoContent(`/courses/${courseId}`, { method: "DELETE" }, "Failed to delete course");
}

export async function updateCourseLibrary(input: {
  courseId: string;
  libraryType?: "fragmented" | "series";
  seriesId?: string;
  seriesTitle?: string;
  tags?: string[];
  isStarred?: boolean;
}): Promise<Course> {
  return apiJson<Course>(
    `/courses/${input.courseId}/library`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({
        library_type: input.libraryType,
        series_id: input.seriesId,
        series_title: input.seriesTitle,
        tags: input.tags,
        is_starred: input.isStarred
      })
    },
    "Failed to update course"
  );
}

export async function updateCourseSeries(input: {
  seriesId: string;
  title?: string;
  tags?: string[];
  isStarred?: boolean;
}): Promise<CourseSeries> {
  return apiJson<CourseSeries>(
    `/courses/series/${input.seriesId}`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: input.title,
        tags: input.tags,
        is_starred: input.isStarred
      })
    },
    "Failed to update series"
  );
}

export async function moveSeriesToFragments(seriesId: string): Promise<void> {
  await apiNoContent(`/courses/series/${seriesId}/move-to-fragments`, { method: "POST" }, "Failed to move series");
}

export async function deleteCourseSeries(seriesId: string): Promise<void> {
  await apiNoContent(`/courses/series/${seriesId}`, { method: "DELETE" }, "Failed to delete series");
}
