export type Sentence = {
  index: number;
  text: string;
  audio_start_seconds: number | null;
  audio_end_seconds: number | null;
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
  tags: string[];
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
  source: CourseSource | null;
  sentences: Sentence[];
};

export type GenerationJob = {
  id: string;
  course_id: string;
  job_type: string;
  status: string;
  provider?: string | null;
  fallback_provider?: string | null;
  tier?: string | null;
  progress_current?: number;
  progress_total?: number;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
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

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type AdminUserList = {
  items: AuthUser[];
};
