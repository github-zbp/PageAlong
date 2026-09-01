import { clearAuthToken } from "@/lib/auth-storage";
import { clearSessionToken, getSessionToken } from "@/lib/session-store";

const DEFAULT_API_BASE_URL = "http://10.0.2.2:8070";
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  email_verified_at: string | null;
  must_change_password_at_next_login: boolean;
  last_login_at: string | null;
  last_dashboard_at?: string | null;
  last_dashboard_locale?: string;
  created_at: string;
};

export type LoginCapabilities = {
  email_password: boolean;
  email_code: boolean;
  wechat: boolean;
  one_tap: boolean;
};

export type EmailCodePurpose = "register" | "password_reset" | "login";

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type RequestEmailCodePayload = {
  email: string;
  purpose: EmailCodePurpose;
};

export type LoginWithPasswordPayload = {
  email: string;
  password: string;
};

export type RegisterWithEmailPayload = {
  email: string;
  password: string;
  code: string;
};

export type LoginWithEmailCodePayload = {
  email: string;
  code: string;
};

export type ExchangeWechatLoginPayload = {
  code: string;
  state?: string | null;
};

export type ExchangeOneTapLoginPayload = {
  credential: string;
  provider?: string | null;
};

export type TagRead = {
  id: string;
  name: string;
  color: string;
  usage_count: number;
  updated_at: string;
};

export type Sentence = {
  index: number;
  text: string;
  audio_start_seconds: number | null;
  audio_end_seconds: number | null;
};

export type CourseOutlineItem = {
  id: string;
  depth: 1 | 2 | 3 | 4;
  title: string;
};

export type CourseSource = {
  source_kind: string | null;
  locator: string | null;
  canonical_locator: string | null;
  final_url: string | null;
  source_domain: string | null;
  author: string | null;
  published_at: string | null;
  original_filename: string | null;
  relative_path: string | null;
  file_extension: string | null;
  content_type: string | null;
  byte_size: number | null;
  storage_backend: string | null;
  object_key: string | null;
};

export type CourseSection = {
  section_index: number;
  title: string;
  sentence_start_index: number;
  sentence_end_index: number;
  planned_duration_seconds: number;
  audio_start_seconds: number | null;
  audio_end_seconds: number | null;
  status: string;
};

export type CourseSeries = {
  id: string;
  title: string;
  article_count: number;
  tags: string[];
  is_starred: boolean;
  updated_at: string;
  last_read_at: string | null;
  last_read_course_id: string | null;
  latest_course_id: string | null;
};

export type CourseSeriesDetail = CourseSeries & {
  courses: Course[];
};

export type Course = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  word_count: number;
  word_count_unit?: "characters" | "words";
  estimated_reading_seconds?: number;
  duration_seconds: number;
  current_audio_url: string | null;
  last_playback_position_seconds: number;
  library_type: "fragmented" | "series";
  series_id: string | null;
  series_title: string | null;
  tags: TagRead[];
  is_starred: boolean;
  created_at: string;
  updated_at: string;
  last_read_at: string | null;
  content_markdown: string | null;
  source: CourseSource | null;
  sentences: Sentence[];
  sections: CourseSection[];
  outline: CourseOutlineItem[];
  import_status?: string | null;
  import_error_code?: string | null;
  import_error_message?: string | null;
  current_generation_job_id?: string | null;
  generation_status?: string | null;
  generation_error_code?: string | null;
  failed_reason?: string | null;
};

export type CourseSummary = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  word_count: number;
  word_count_unit?: "characters" | "words";
  estimated_reading_seconds?: number;
  duration_seconds: number;
  current_audio_url: string | null;
  last_playback_position_seconds: number;
  library_type: "fragmented" | "series";
  series_id?: string | null;
  series_title?: string | null;
  tags: TagRead[];
  is_starred: boolean;
  created_at: string;
  updated_at: string;
  last_read_at?: string | null;
  sentence_count?: number;
  import_status?: string | null;
  import_error_code?: string | null;
  import_error_message?: string | null;
  current_generation_job_id?: string | null;
  generation_status?: string | null;
  generation_error_code?: string | null;
  failed_reason?: string | null;
};

export type Pagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_previous: boolean;
  has_next: boolean;
};

export type PaginatedList<T> = {
  items: T[];
  pagination: Pagination;
};

export type LibrarySort = "recent" | "created_at" | "updated_at" | "title" | "starred";

export type FileImportUpload = {
  uri: string;
  name: string;
  type?: string | null;
  relativePath?: string | null;
};

export type FileImportItem = {
  id: string;
  batch_id: string;
  course_id: string | null;
  status: "pending" | "running" | "succeeded" | "failed" | string;
  original_filename: string;
  relative_path: string | null;
  file_extension: string;
  content_type: string;
  byte_size: number;
  storage_backend: string;
  bucket: string | null;
  object_key: string;
  object_path: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FileImportBatch = {
  id: string;
  status: "pending" | "running" | "succeeded" | "completed_with_failures" | "failed" | string;
  source_mode: "single_file" | "multiple_files" | "folder" | string;
  series_id: string | null;
  series_title: string | null;
  total_count: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
  items: FileImportItem[];
};

export type GenerationJob = {
  id: string;
  course_id: string;
  target_type?: string;
  target_id?: string;
  target_label?: string | null;
  job_type: string;
  status: "pending" | "running" | "succeeded" | "failed" | string;
  provider?: string | null;
  fallback_provider?: string | null;
  tier?: string | null;
  progress_current: number;
  progress_total: number;
  result_resource_id?: string | null;
  download_url?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DownloadRequest = {
  status: "ready" | "pending";
  job_id: string | null;
  job_type: string;
  resource_id: string | null;
  download_url: string | null;
  message: string | null;
};

export type CourseDownloadFormat = "markdown" | "docx" | "pdf" | "audio";

export type CreateTextCoursePayload = {
  title: string;
  text: string;
  seriesTitle?: string;
};

export type CreateUrlCoursePayload = {
  url: string;
  title?: string;
  seriesTitle?: string;
  autoGenerateAudio?: boolean;
};

export type CreateExtensionSyncCoursePayload = CreateUrlCoursePayload;

export type CreateFileImportBatchPayload = {
  files: FileImportUpload[];
  sourceMode: "single_file" | "multiple_files" | "folder";
  seriesTitle?: string;
  seriesId?: string;
};

type ErrorBody = {
  detail?: unknown;
};

type LegacyPaginatedResponse<T> = {
  items: T[];
  pagination?: Pagination;
};

function buildUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function resolveApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith("/")) {
    return buildUrl(pathOrUrl);
  }
  return buildUrl(`/${pathOrUrl}`);
}

export function mediaUrl(pathOrUrl: string): string {
  return resolveApiUrl(pathOrUrl);
}

export function courseAudioUrl(courseId: string): string {
  return resolveApiUrl(`/courses/${courseId}/audio`);
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

  return {
    items: body.items,
    pagination: synthesizePagination(page, pageSize, body.items.length)
  };
}

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody;
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    // Ignore parse failures and fall back to the generic message.
  }

  return fallback;
}

function jsonRequestInit(body: unknown, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return {
    ...init,
    headers,
    body: JSON.stringify(body)
  };
}

function jsonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json"
  };
}

export async function apiFetch(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const headers = new Headers(init.headers);

  if (auth) {
    const token = getSessionToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers
  });

  if (auth && response.status === 401) {
    clearSessionToken();
    await clearAuthToken();
  }

  return response;
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  fallback = "Request failed",
  auth = true
): Promise<T> {
  const response = await apiFetch(path, init, auth);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, fallback));
  }
  return (await response.json()) as T;
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

export async function apiNoContent(
  path: string,
  init: RequestInit = {},
  fallback = "Request failed",
  auth = true
): Promise<void> {
  const response = await apiFetch(path, init, auth);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, fallback));
  }
}

export async function getCurrentUser(): Promise<AuthUser> {
  return apiJson<AuthUser>("/auth/me", { cache: "no-store" }, "Failed to load account");
}

export async function searchCoursesByTitle(query: string): Promise<CourseSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const response = await apiJson<PaginatedList<CourseSummary>>(
    `/courses${queryString({ library_type: "all", query: trimmed, search_scope: "title", page: 1, page_size: 20 })}`,
    { cache: "no-store" },
    "Failed to search courses"
  );
  return response.items;
}

export type FeedbackCategory = "suggestion" | "bug" | "feature";

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

export async function logoutSession(): Promise<void> {
  await apiNoContent("/auth/logout", { method: "POST" }, "Failed to sign out");
}

export async function logoutAllSessions(): Promise<void> {
  await apiNoContent("/auth/logout-all", { method: "POST" }, "Failed to sign out");
}

export async function getLoginCapabilities(): Promise<LoginCapabilities> {
  return apiJson<LoginCapabilities>("/auth/capabilities", { cache: "no-store" }, "Failed to load login capabilities", false);
}

export async function recordDashboardActivity(locale: "zh" | "en" = "zh"): Promise<void> {
  await apiNoContent(
    "/auth/me/dashboard-activity",
    jsonRequestInit({ locale }, { method: "POST" }),
    "Failed to record dashboard activity"
  );
}

export async function requestEmailCode(payload: RequestEmailCodePayload): Promise<void> {
  await apiNoContent("/auth/email/code", jsonRequestInit(payload, { method: "POST" }), "Failed to request code", false);
}

export async function loginWithPassword(payload: LoginWithPasswordPayload): Promise<AuthResponse> {
  return apiJson<AuthResponse>(
    "/auth/login",
    jsonRequestInit(payload, { method: "POST" }),
    "Failed to sign in",
    false
  );
}

export async function registerWithEmail(payload: RegisterWithEmailPayload): Promise<AuthResponse> {
  return apiJson<AuthResponse>(
    "/auth/register",
    jsonRequestInit(payload, { method: "POST" }),
    "Failed to register",
    false
  );
}

export async function loginWithEmailCode(payload: LoginWithEmailCodePayload): Promise<AuthResponse> {
  return apiJson<AuthResponse>(
    "/auth/email/login",
    jsonRequestInit(payload, { method: "POST" }),
    "Failed to sign in",
    false
  );
}

export async function exchangeWechatLogin(payload: ExchangeWechatLoginPayload): Promise<AuthResponse> {
  return apiJson<AuthResponse>(
    "/auth/wechat/exchange",
    jsonRequestInit(payload, { method: "POST" }),
    "Failed to sign in",
    false
  );
}

export async function exchangeOneTapLogin(payload: ExchangeOneTapLoginPayload): Promise<AuthResponse> {
  return apiJson<AuthResponse>(
    "/auth/one-tap/exchange",
    jsonRequestInit(payload, { method: "POST" }),
    "Failed to sign in",
    false
  );
}

export async function createTextCourse(input: CreateTextCoursePayload): Promise<Course> {
  return apiJson<Course>(
    "/courses",
    jsonRequestInit(
      {
        title: input.title,
        text: input.text,
        source_type: "manual_text",
        series_title: input.seriesTitle || undefined
      },
      { method: "POST" }
    ),
    "Failed to create course"
  );
}

export async function createUrlCourse(input: CreateUrlCoursePayload): Promise<Course> {
  return apiJson<Course>(
    "/courses/import-url",
    jsonRequestInit(
      {
        url: input.url,
        title: input.title || undefined,
        series_title: input.seriesTitle || undefined,
        auto_generate_audio: input.autoGenerateAudio ?? undefined
      },
      { method: "POST" }
    ),
    "Failed to import URL"
  );
}

export async function createExtensionSyncCourse(input: CreateExtensionSyncCoursePayload): Promise<Course> {
  return apiJson<Course>(
    "/courses/import-url/extension-sync",
    jsonRequestInit(
      {
        url: input.url,
        title: input.title || undefined,
        series_title: input.seriesTitle || undefined,
        article_html: "",
        text_excerpt: "",
        images: [],
        client_metadata: {
          source: "mobile_web_entry"
        }
      },
      { method: "POST" }
    ),
    "Failed to sync URL"
  );
}

export async function createFileImportBatch(input: CreateFileImportBatchPayload): Promise<FileImportBatch> {
  const formData = new FormData();
  input.files.forEach((file) => {
    formData.append(
      "files",
      {
        uri: file.uri,
        name: file.name,
        type: file.type || "application/octet-stream"
      } as unknown as Blob
    );
  });
  formData.set("source_mode", input.sourceMode);
  formData.set("relative_paths_json", JSON.stringify(input.files.map((file) => file.relativePath ?? null)));
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

export async function listFileImportBatchesPage(input: {
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<FileImportBatch>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  return fetchPaginatedJson<FileImportBatch>(
    `/courses/file-import-batches${queryString({
      page,
      page_size: pageSize
    })}`,
    page,
    pageSize,
    "Failed to load file import batches"
  );
}

export async function listFileImportBatches(): Promise<FileImportBatch[]> {
  return fetchAllPages((page, pageSize) => listFileImportBatchesPage({ page, pageSize }));
}

export async function getFileImportBatch(batchId: string): Promise<FileImportBatch> {
  return apiJson<FileImportBatch>(
    `/courses/file-import-batches/${batchId}`,
    { cache: "no-store" },
    "Failed to load file import batch"
  );
}

export async function retryFileImportBatch(batchId: string): Promise<FileImportBatch> {
  return apiJson<FileImportBatch>(
    `/courses/file-import-batches/${batchId}/retry`,
    { method: "POST" },
    "Failed to retry file import batch"
  );
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
    "Failed to load generation jobs"
  );
}

export async function listGenerationJobs(input: { scope?: "resource" | "all" } = {}): Promise<GenerationJob[]> {
  return fetchAllPages((page, pageSize) => listGenerationJobsPage({ scope: input.scope, page, pageSize }));
}

export async function getGenerationJob(jobId: string): Promise<GenerationJob> {
  return apiJson<GenerationJob>(`/jobs/${jobId}`, { cache: "no-store" }, "Failed to load generation job");
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

export async function getCourseSeries(seriesId: string): Promise<CourseSeriesDetail> {
  return apiJson<CourseSeriesDetail>(`/courses/series/${seriesId}`, { cache: "no-store" }, "Failed to load course series");
}

export async function listCoursesPage(input: {
  libraryType?: "all" | "fragmented" | "series";
  query?: string;
  searchScope?: "all" | "title";
  tag?: string;
  starred?: boolean;
  sort?: LibrarySort;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<CourseSummary>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  return apiJson<PaginatedList<CourseSummary>>(
    `/courses${queryString({
      library_type: input.libraryType,
      query: input.query,
      search_scope: input.searchScope ?? (input.query ? "title" : undefined),
      tag: input.tag,
      starred: input.starred,
      sort: input.sort,
      page,
      page_size: pageSize
    })}`,
    { cache: "no-store" },
    "Failed to load courses"
  );
}

export async function listCourseSeriesPage(input: {
  query?: string;
  tag?: string;
  starred?: boolean;
  sort?: LibrarySort;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedList<CourseSeries>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  return apiJson<PaginatedList<CourseSeries>>(
    `/courses/series${queryString({
      query: input.query,
      tag: input.tag,
      starred: input.starred,
      sort: input.sort,
      page,
      page_size: pageSize
    })}`,
    { cache: "no-store" },
    "Failed to load course series"
  );
}

export async function getCourse(courseId: string): Promise<Course> {
  return apiJson<Course>(`/courses/${courseId}`, { cache: "no-store" }, "Failed to load course");
}

export async function requestCourseAudioGeneration(courseId: string): Promise<GenerationJob> {
  return apiJson<GenerationJob>(`/courses/${courseId}/audio-generation`, { method: "POST" }, "Failed to request audio generation");
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

export async function updateCourseLibrary(input: {
  courseId: string;
  libraryType?: "fragmented" | "series";
  seriesId?: string;
  seriesTitle?: string;
  tags?: string[];
  tagIds?: string[];
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
        tag_ids: input.tagIds,
        is_starred: input.isStarred
      })
    },
    "Failed to update course"
  );
}

export async function deleteCourse(courseId: string): Promise<void> {
  await apiNoContent(`/courses/${courseId}`, { method: "DELETE" }, "Failed to delete course");
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

export async function createCourseSeries(input: {
  title: string;
}): Promise<CourseSeries> {
  return apiJson<CourseSeries>(
    "/courses/series",
    jsonRequestInit(
      {
        title: input.title
      },
      { method: "POST" }
    ),
    "Failed to create series"
  );
}

export async function createCourseTag(input: {
  name: string;
  color?: string | null;
}): Promise<TagRead> {
  return apiJson<TagRead>(
    "/courses/tags",
    jsonRequestInit(
      {
        name: input.name,
        color: input.color
      },
      { method: "POST" }
    ),
    "Failed to create tag"
  );
}

export async function deleteCourseSeries(seriesId: string): Promise<void> {
  await apiNoContent(`/courses/series/${seriesId}`, { method: "DELETE" }, "Failed to delete series");
}
