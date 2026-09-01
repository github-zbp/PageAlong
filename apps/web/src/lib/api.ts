import type {
  AdminUser,
  AdminAnnouncementDetail,
  AdminAnnouncementListItem,
  AdminBlogDetail,
  AdminBlogListItem,
  AdminCourseDetail,
  AdminCourseListItem,
  AdminUserList,
  AuthResponse,
  AuthUser,
  Course,
  CourseSeries,
  CourseSeriesDetail,
  CourseSummary,
  DownloadRequest,
  FileImportBatch,
  GenerationJob,
  FeedbackCategory,
  PaginatedList,
  Pagination,
  TagRead
} from "./types";
import type { ThemePreferences } from "./theme-preferences";

const DEFAULT_PUBLIC_API_BASE_URL = "http://localhost:8000";
const DEFAULT_SERVER_API_BASE_URL = "http://127.0.0.1:8000";
const CONFIGURED_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const PUBLIC_API_BASE_URL = CONFIGURED_PUBLIC_API_BASE_URL || DEFAULT_PUBLIC_API_BASE_URL;
const AUTH_TOKEN_STORAGE_KEY = "pagealong_auth_token";
const FALLBACK_TAG_COLOR = "#cbd5e1";
const FALLBACK_TAG_UPDATED_AT = "1970-01-01T00:00:00.000Z";

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

function queryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
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

function normalizeTag(tag: TagRead | string): TagRead {
  if (typeof tag === "string") {
    return {
      id: tag,
      name: tag,
      color: FALLBACK_TAG_COLOR,
      usage_count: 0,
      updated_at: FALLBACK_TAG_UPDATED_AT
    };
  }
  return tag;
}

function normalizeTags(tags: Array<TagRead | string> | undefined | null): TagRead[] {
  return (tags ?? []).map(normalizeTag);
}

function normalizeCourse<T extends { tags?: Array<TagRead | string> }>(course: T): T & { tags: TagRead[] } {
  return {
    ...course,
    tags: normalizeTags(course.tags)
  };
}

function normalizeCourseSeriesDetail<T extends { courses?: Array<{ tags?: Array<TagRead | string> }> }>(
  series: T
): T {
  return {
    ...series,
    courses: (series.courses ?? []).map((course) => normalizeCourse(course))
  };
}

type LegacyPaginatedResponse<T> = {
  items: T[];
  pagination?: Pagination;
};

function synthesizePagination(page: number, pageSize: number, total: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
    has_previous: page > 1,
    has_next: false
  };
}

function normalizePaginatedResponse<T>(
  body: LegacyPaginatedResponse<T>,
  page: number,
  pageSize: number
): PaginatedList<T> {
  if (body.pagination) {
    return {
      items: body.items,
      pagination: body.pagination
    };
  }

  const pagination = synthesizePagination(page, pageSize, body.items.length);
  return {
    items: body.items,
    pagination
  };
}

async function fetchPaginatedJson<T>(
  path: string,
  page: number,
  pageSize: number,
  fallback: string,
  auth = true
): Promise<PaginatedList<T>> {
  const body = await apiJson<LegacyPaginatedResponse<T>>(path, { cache: "no-store" }, fallback, auth);
  return normalizePaginatedResponse(body, page, pageSize);
}

async function fetchAllPages<T>(loadPage: (page: number, pageSize: number) => Promise<PaginatedList<T>>): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const response = await loadPage(page, 100);
    items.push(...response.items);
    if (!response.pagination.has_next) {
      break;
    }
    page += 1;
  }

  return items;
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

export async function getCurrentThemePreferences(): Promise<ThemePreferences> {
  return apiJson<ThemePreferences>("/auth/me/preferences", { cache: "no-store" }, "Failed to load preferences");
}

export async function updateCurrentThemePreferences(input: ThemePreferences): Promise<ThemePreferences> {
  return apiJson<ThemePreferences>(
    "/auth/me/preferences",
    {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    "Failed to save preferences"
  );
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

export async function listReaderAdminUsers(input: {
  query?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<AdminUser>> {
  return apiJson<PaginatedList<AdminUser>>(
    `/admin/users${queryString({
      query: input.query,
      page: input.page ?? 1,
      page_size: input.pageSize ?? 20
    })}`,
    { cache: "no-store" },
    "Failed to load users"
  );
}

export async function recordDashboardActivity(locale: "zh" | "en"): Promise<void> {
  await apiNoContent(
    "/auth/me/dashboard-activity",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ locale })
    },
    "Failed to record dashboard activity"
  );
}

export async function createAdminImpersonation(targetUserId: string): Promise<{
  token: string;
  target_user: AdminUser;
  expires_at: string;
}> {
  return apiJson(
    "/admin/impersonation",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ target_user_id: targetUserId })
    },
    "Failed to enter user page"
  );
}

export async function listAdminBlogs(input: {
  query?: string;
  status?: string;
  language?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<AdminBlogListItem>> {
  return apiJson<PaginatedList<AdminBlogListItem>>(
    `/admin/blogs${queryString({
      query: input.query,
      status: input.status,
      language: input.language,
      page: input.page ?? 1,
      page_size: input.pageSize ?? 20
    })}`,
    { cache: "no-store" },
    "Failed to load blogs"
  );
}

export async function getAdminBlog(blogId: string): Promise<AdminBlogDetail> {
  return apiJson<AdminBlogDetail>(`/admin/blogs/${blogId}`, { cache: "no-store" }, "Failed to load blog");
}

export async function createAdminBlog(
  input: Partial<AdminBlogDetail> & {
    title: string;
    slug: string;
    language: "zh" | "en";
    body_markdown: string;
  }
): Promise<AdminBlogDetail> {
  return apiJson<AdminBlogDetail>(
    "/admin/blogs",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    "Failed to create blog"
  );
}

export async function updateAdminBlog(blogId: string, input: Partial<AdminBlogDetail>): Promise<AdminBlogDetail> {
  return apiJson<AdminBlogDetail>(
    `/admin/blogs/${blogId}`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    "Failed to save blog"
  );
}

export async function publishAdminBlog(blogId: string): Promise<AdminBlogDetail> {
  return apiJson<AdminBlogDetail>(`/admin/blogs/${blogId}/publish`, { method: "POST" }, "Failed to publish blog");
}

export async function offlineAdminBlog(blogId: string): Promise<AdminBlogDetail> {
  return apiJson<AdminBlogDetail>(`/admin/blogs/${blogId}/offline`, { method: "POST" }, "Failed to offline blog");
}

export async function deleteAdminBlog(blogId: string): Promise<void> {
  await apiNoContent(`/admin/blogs/${blogId}`, { method: "DELETE" }, "Failed to delete blog");
}

export async function bulkAdminBlogs(
  ids: string[],
  action: "publish" | "offline" | "delete"
): Promise<{ updated_count: number; failed_ids: string[] }> {
  return apiJson<{ updated_count: number; failed_ids: string[] }>(
    "/admin/blogs/bulk",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ids, action })
    },
    "Failed to update blogs"
  );
}

export async function listPublicBlogs(locale: "zh" | "en"): Promise<PaginatedList<AdminBlogListItem>> {
  return apiJson<PaginatedList<AdminBlogListItem>>(
    `/blogs${queryString({ lang: locale })}`,
    { cache: "no-store" },
    "Failed to load blogs",
    false
  );
}

export async function getPublicBlog(slug: string, locale: "zh" | "en"): Promise<AdminBlogDetail> {
  return apiJson<AdminBlogDetail>(
    `/blogs/${slug}${queryString({ lang: locale })}`,
    { cache: "no-store" },
    "Failed to load blog",
    false
  );
}

export async function listAdminCourses(input: {
  query?: string;
  email?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<AdminCourseListItem>> {
  return apiJson<PaginatedList<AdminCourseListItem>>(
    `/admin/courses${queryString({
      query: input.query,
      email: input.email,
      page: input.page ?? 1,
      page_size: input.pageSize ?? 20
    })}`,
    { cache: "no-store" },
    "Failed to load courses"
  );
}

export async function getAdminCourse(courseId: string): Promise<AdminCourseDetail> {
  return apiJson<AdminCourseDetail>(`/admin/courses/${courseId}`, { cache: "no-store" }, "Failed to load course");
}

export async function deleteAdminCourse(courseId: string): Promise<void> {
  await apiNoContent(`/admin/courses/${courseId}`, { method: "DELETE" }, "Failed to delete course");
}

export async function bulkDeleteAdminCourses(
  ids: string[]
): Promise<{ updated_count: number; failed_ids: string[] }> {
  return apiJson<{ updated_count: number; failed_ids: string[] }>(
    "/admin/courses/bulk-delete",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ids })
    },
    "Failed to delete courses"
  );
}

export async function listAdminAnnouncements(input: {
  query?: string;
  status?: string;
  language?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<AdminAnnouncementListItem>> {
  return apiJson<PaginatedList<AdminAnnouncementListItem>>(
    `/admin/announcements${queryString({
      query: input.query,
      status: input.status,
      language: input.language,
      page: input.page ?? 1,
      page_size: input.pageSize ?? 20
    })}`,
    { cache: "no-store" },
    "Failed to load announcements"
  );
}

export async function getAdminAnnouncement(announcementId: string): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    `/admin/announcements/${announcementId}`,
    { cache: "no-store" },
    "Failed to load announcement"
  );
}

export async function createAdminAnnouncement(input: {
  title: string;
  language: "zh" | "en";
  body_markdown: string;
  roadmap_status: "planned" | "in_progress" | "shipped";
  display_position: "dashboard" | "announcement_page" | "global_banner";
  sort_order: number;
  is_pinned: boolean;
}): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    "/admin/announcements",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    "Failed to create announcement"
  );
}

export async function updateAdminAnnouncement(
  announcementId: string,
  input: Partial<AdminAnnouncementDetail>
): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    `/admin/announcements/${announcementId}`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(input)
    },
    "Failed to save announcement"
  );
}

export async function publishAdminAnnouncement(announcementId: string): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    `/admin/announcements/${announcementId}/publish`,
    { method: "POST" },
    "Failed to publish announcement"
  );
}

export async function offlineAdminAnnouncement(announcementId: string): Promise<AdminAnnouncementDetail> {
  return apiJson<AdminAnnouncementDetail>(
    `/admin/announcements/${announcementId}/offline`,
    { method: "POST" },
    "Failed to offline announcement"
  );
}

export async function deleteAdminAnnouncement(announcementId: string): Promise<void> {
  await apiNoContent(
    `/admin/announcements/${announcementId}`,
    { method: "DELETE" },
    "Failed to delete announcement"
  );
}

export async function reorderAdminAnnouncements(items: Array<{ id: string; sort_order: number }>): Promise<void> {
  await apiNoContent(
    "/admin/announcements/reorder",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ items })
    },
    "Failed to reorder announcements"
  );
}

export async function listDashboardAnnouncements(locale: "zh" | "en"): Promise<PaginatedList<AdminAnnouncementListItem>> {
  return apiJson<PaginatedList<AdminAnnouncementListItem>>(
    `/announcements/dashboard${queryString({ lang: locale })}`,
    { cache: "no-store" },
    "Failed to load announcements",
    false
  );
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

export async function submitFeedback(input: {
  category: FeedbackCategory;
  summary: string;
  message: string;
  pagePath?: string;
}): Promise<void> {
  await apiNoContent(
    "/feedback",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        category: input.category,
        summary: input.summary,
        message: input.message,
        page_path: input.pagePath || undefined
      })
    },
    "Failed to send feedback"
  );
}

export async function listCourses(input: {
  libraryType?: "all" | "fragmented" | "series";
  query?: string;
  searchScope?: "all" | "title";
  tag?: string;
  starred?: boolean;
} = {}): Promise<CourseSummary[]> {
  return fetchAllPages(async (page, pageSize) => {
    const body = await listCoursesPage({
      libraryType: input.libraryType,
      query: input.query,
      searchScope: input.searchScope,
      tag: input.tag,
      starred: input.starred,
      page,
      pageSize
    });
    return body;
  });
}

export async function listCoursesPage(input: {
  libraryType?: "all" | "fragmented" | "series";
  query?: string;
  searchScope?: "all" | "title";
  tag?: string;
  starred?: boolean;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<CourseSummary>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const body = await fetchPaginatedJson<CourseSummary>(
    `/courses${queryString({
      library_type: input.libraryType,
      query: input.query,
      search_scope: input.searchScope ?? (input.query ? "title" : undefined),
      tag: input.tag,
      starred: input.starred,
      page,
      page_size: pageSize
    })}`,
    page,
    pageSize,
    "Failed to load courses"
  );
  return {
    ...body,
    items: body.items.map((course) => normalizeCourse(course))
  };
}

export async function listCourseSeries(input: {
  query?: string;
  tag?: string;
  starred?: boolean;
} = {}): Promise<CourseSeries[]> {
  return fetchAllPages(async (page, pageSize) => {
    const body = await listCourseSeriesPage({
      query: input.query,
      tag: input.tag,
      starred: input.starred,
      page,
      pageSize
    });
    return body;
  });
}

export async function listCourseSeriesPage(input: {
  query?: string;
  tag?: string;
  starred?: boolean;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<CourseSeries>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  return fetchPaginatedJson<CourseSeries>(
    `/courses/series${queryString({
      query: input.query,
      tag: input.tag,
      starred: input.starred,
      page,
      page_size: pageSize
    })}`,
    page,
    pageSize,
    "Failed to load course series"
  );
}

export async function createCourseSeries(input: {
  title: string;
  isStarred?: boolean;
}): Promise<CourseSeries> {
  return apiJson<CourseSeries>(
    "/courses/series",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: input.title,
        is_starred: input.isStarred ?? false
      })
    },
    "Failed to create series"
  );
}

export async function getCourseSeries(seriesId: string): Promise<CourseSeriesDetail> {
  const body = await apiJson<CourseSeriesDetail>(
    `/courses/series/${seriesId}`,
    { cache: "no-store" },
    "Failed to load course series"
  );
  return normalizeCourseSeriesDetail(body);
}

export async function listCourseTags(): Promise<TagRead[]> {
  const body = await apiJson<{ items: Array<TagRead | string> }>(
    "/courses/tags",
    { cache: "no-store" },
    "Failed to load course tags"
  );
  return normalizeTags(body.items);
}

export async function createCourseTag(input: { name: string; color?: string }): Promise<TagRead> {
  return apiJson<TagRead>(
    "/courses/tags",
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        name: input.name,
        color: input.color
      })
    },
    "Failed to create tag"
  );
}

export async function updateCourseTag(input: {
  tagId: string;
  name?: string;
  color?: string;
}): Promise<TagRead> {
  return apiJson<TagRead>(
    `/courses/tags/${input.tagId}`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({
        name: input.name,
        color: input.color
      })
    },
    "Failed to update tag"
  );
}

export async function deleteCourseTag(tagId: string): Promise<void> {
  await apiNoContent(`/courses/tags/${tagId}`, { method: "DELETE" }, "Failed to delete tag");
}

export async function createTextCourse(input: {
  title: string;
  text: string;
  seriesTitle?: string;
}): Promise<Course> {
  const body = await apiJson<Course>(
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
  return normalizeCourse(body);
}

export async function createUrlCourse(input: {
  url: string;
  title?: string;
  seriesTitle?: string;
}): Promise<Course> {
  const body = await apiJson<Course>(
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
  return normalizeCourse(body);
}

export async function createExtensionSyncCourse(input: {
  url: string;
  title?: string;
  seriesTitle?: string;
}): Promise<Course> {
  const body = await apiJson<Course>(
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
  return normalizeCourse(body);
}

export async function getCourse(courseId: string): Promise<Course> {
  const body = await apiJson<Course>(`/courses/${courseId}`, { cache: "no-store" }, "Failed to load course");
  return normalizeCourse(body);
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

export async function requestCourseDownload(
  courseId: string,
  format: CourseDownloadFormat
): Promise<DownloadRequest> {
  return apiJson<DownloadRequest>(
    `/courses/${courseId}/downloads/${format}`,
    { method: "POST" },
    "Failed to request course download"
  );
}

export async function listGenerationJobs(input: { scope?: "resource" | "all" } = {}): Promise<GenerationJob[]> {
  return fetchAllPages(async (page, pageSize) => {
    const body = await listGenerationJobsPage({
      scope: input.scope,
      page,
      pageSize
    });
    return body;
  });
}

export async function listGenerationJobsPage(input: {
  scope?: "resource" | "all";
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<GenerationJob>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  return fetchPaginatedJson<GenerationJob>(
    `/jobs${queryString({
      scope: input.scope,
      page,
      page_size: pageSize
    })}`,
    page,
    pageSize,
    "Failed to load download tasks"
  );
}

export async function getGenerationJob(jobId: string): Promise<GenerationJob> {
  return apiJson<GenerationJob>(`/jobs/${jobId}`, { cache: "no-store" }, "Failed to load download task");
}

export function openDownloadUrl(downloadUrl: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.location.assign(downloadUrl);
}

export async function downloadCourseToBrowser(courseId: string, format: CourseDownloadFormat): Promise<void> {
  const request = await requestCourseDownload(courseId, format);
  if (request.status === "ready" && request.download_url) {
    openDownloadUrl(request.download_url);
    return;
  }
  throw new Error(request.message || "Download is being prepared");
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
  tagIds?: string[];
  isStarred?: boolean;
}): Promise<Course> {
  const body = await apiJson<Course>(
    `/courses/${input.courseId}/library`,
    {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({
        library_type: input.libraryType,
        series_id: input.seriesId,
        series_title: input.seriesTitle,
        tags: input.tags,
        tag_ids: input.tagIds,
        is_starred: input.isStarred
      })
    },
    "Failed to update course"
  );
  return normalizeCourse(body);
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
