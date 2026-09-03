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

export type TagRead = {
  id: string;
  name: string;
  color: string;
  usage_count: number;
  updated_at: string;
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

export type StoryComment = {
  id: string;
  content: string;
  author_email: string;
  created_at: string;
};

export type CourseBase = {
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
  import_status?: string | null;
  import_error_code?: string | null;
  import_error_message?: string | null;
  current_generation_job_id?: string | null;
  generation_status?: string | null;
  generation_error_code?: string | null;
  failed_reason?: string | null;
};

export type CourseSummary = CourseBase & {
  sentence_count: number;
};

export type Course = CourseBase & {
  content_markdown: string | null;
  outline?: CourseOutlineItem[];
  source: CourseSource | null;
  sentences: Sentence[];
};

export type GenerationJob = {
  id: string;
  course_id: string;
  target_type: string;
  target_id: string;
  target_label: string | null;
  job_type: string;
  status: string;
  provider?: string | null;
  fallback_provider?: string | null;
  tier?: string | null;
  progress_current?: number;
  progress_total?: number;
  result_resource_id?: string | null;
  download_url?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type DownloadRequest = {
  status: "ready" | "pending";
  job_id: string | null;
  job_type: string;
  resource_id: string | null;
  download_url: string | null;
  message: string | null;
};

export type FileImportItem = {
  id: string;
  batch_id: string;
  course_id: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
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
  status: "pending" | "running" | "succeeded" | "completed_with_failures" | "failed";
  source_mode: "single_file" | "multiple_files" | "folder";
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

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  email_verified_at: string | null;
  must_change_password_at_next_login: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type AdminUser = AuthUser & {
  last_dashboard_at: string | null;
  last_dashboard_locale: "zh" | "en" | "";
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type AdminUserList = PaginatedList<AdminUser>;

export type AdminResourceCounts = {
  image: number;
  audio: number;
  pdf: number;
  docx: number;
  markdown: number;
};

export type AdminCourseListItem = {
  id: string;
  title: string;
  user_email: string;
  source_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  resource_counts: AdminResourceCounts;
  audio_download_url: string | null;
  pdf_download_url: string | null;
  docx_download_url: string | null;
  markdown_download_url: string | null;
};

export type AdminCourseDetail = AdminCourseListItem & {
  content_markdown: string | null;
};

export type AdminBlogListItem = {
  id: string;
  title: string;
  slug: string;
  language: "zh" | "en";
  author_email: string;
  summary: string;
  cover_image_url: string;
  status: "draft" | "published" | "offline" | "deleted";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminBlogDetail = AdminBlogListItem & {
  body_markdown: string;
  body_html: string;
  seo_title: string;
  seo_description: string;
};

export type AdminAnnouncementListItem = {
  id: string;
  title: string;
  language: "zh" | "en";
  status: "draft" | "published" | "offline" | "deleted";
  roadmap_status: "planned" | "in_progress" | "shipped";
  display_position: "dashboard" | "announcement_page" | "global_banner";
  sort_order: number;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminAnnouncementDetail = AdminAnnouncementListItem & {
  body_markdown: string;
  body_html: string;
};

export type FeedbackCategory = "suggestion" | "bug" | "feature";
