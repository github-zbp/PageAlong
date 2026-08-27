import { expect, test } from '@playwright/test';

const apiHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Disposition',
  'Content-Type': 'application/json'
};

const authToken = 'tag-series-token';
const authUser = {
  id: 'user_1',
  email: 'reader@example.com',
  role: 'user',
  status: 'active',
  email_verified_at: '2026-08-02T00:00:00',
  must_change_password_at_next_login: false,
  last_login_at: '2026-08-02T00:00:00',
  created_at: '2026-08-02T00:00:00'
};

type MockCourse = {
  id: string;
  title: string;
  source_type: string;
  status: string;
  word_count: number;
  word_count_unit: 'characters' | 'words';
  estimated_reading_seconds: number;
  duration_seconds: number;
  current_audio_url: string | null;
  last_playback_position_seconds: number;
  library_type: string;
  series_id: string | null;
  series_title: string | null;
  tags: string[];
  is_starred: boolean;
  created_at: string;
  updated_at: string;
  last_read_at: string | null;
  sentence_count: number;
  content_markdown: string | null;
  source: null;
  import_status?: string | null;
  import_error_message?: string | null;
  generation_status?: string | null;
  generation_error_code?: string | null;
  failed_reason?: string | null;
  sentences: Array<{
    index: number;
    text: string;
    audio_start_seconds: number | null;
    audio_end_seconds: number | null;
  }>;
};

function mockCourse(overrides: Partial<MockCourse>): MockCourse {
  const course = {
    id: 'course_1',
    title: '测试课程',
    source_type: 'manual_text',
    status: 'text_ready',
    word_count: 4,
    word_count_unit: 'characters' as const,
    estimated_reading_seconds: 60,
    duration_seconds: 0,
    current_audio_url: null,
    last_playback_position_seconds: 0,
    library_type: 'fragmented',
    series_id: null,
    series_title: null,
    tags: [],
    is_starred: false,
    created_at: '2026-07-10T10:00:00',
    updated_at: '2026-07-10T10:00:00',
    last_read_at: null,
    sentence_count: 0,
    content_markdown: null,
    source: null,
    sentences: [],
    ...overrides
  };
  return {
    ...course,
    sentence_count: overrides.sentence_count ?? course.sentences.length
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    window.localStorage.setItem('pagealong_auth_token', token);
  }, authToken);

  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me$/, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    expect(request.headers().authorization).toBe(`Bearer ${authToken}`);
    await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(authUser) });
  });

  await page.route(/http:\/\/localhost:(8000|8070)\/auth\/me\/preferences$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({ theme_id: 'newspaper', background_color: 'white' })
    });
  });
});

test('tags page can create edit and delete tags', async ({ page }) => {
  let tags = [
    {
      id: 'tag_1',
      name: '英语',
      color: '#f97316',
      usage_count: 2,
      updated_at: '2026-08-20T10:00:00Z'
    }
  ];

  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/tags(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (request.method() === 'GET') {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: tags }) });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as { name: string; color?: string | null };
      const created = {
        id: 'tag_2',
        name: payload.name,
        color: payload.color ?? '#14b8a6',
        usage_count: 0,
        updated_at: '2026-08-21T10:00:00Z'
      };
      tags = [...tags, created];
      await route.fulfill({ status: 201, headers: apiHeaders, body: JSON.stringify(created) });
      return;
    }

    if (request.method() === 'PATCH' && url.pathname === '/courses/tags/tag_1') {
      const payload = request.postDataJSON() as { name?: string; color?: string };
      tags = tags.map((tag) =>
        tag.id === 'tag_1'
          ? {
              ...tag,
              name: payload.name ?? tag.name,
              color: payload.color ?? tag.color,
              updated_at: '2026-08-21T11:00:00Z'
            }
          : tag
      );
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify(tags[0]) });
      return;
    }

    if (request.method() === 'DELETE' && url.pathname === '/courses/tags/tag_1') {
      tags = tags.filter((tag) => tag.id !== 'tag_1');
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    await route.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ detail: 'not found' }) });
  });

  await page.goto('/zh/tags');

  await expect(page.getByRole('button', { name: '英语' })).toBeVisible();
  await expect(page.getByText('2 次使用')).toBeVisible();

  await page.getByRole('button', { name: '英语' }).click();
  await expect(page.getByRole('dialog', { name: '编辑标签' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '标签名称' })).toHaveValue('英语');

  await page.getByRole('textbox', { name: '标签名称' }).fill('英语强化');
  await page.getByRole('button', { name: '#14b8a6' }).click();
  await page.getByRole('button', { name: '保存标签' }).click();
  await expect(page.getByRole('button', { name: '英语强化' })).toBeVisible();
  await page.getByRole('dialog', { name: '编辑标签' }).getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('dialog', { name: '编辑标签' })).toHaveCount(0);

  await page.getByRole('button', { name: '新建标签' }).click();
  await page.getByRole('textbox', { name: '标签名称' }).fill('复盘');
  await page.getByRole('button', { name: '保存标签' }).click();
  await expect(page.getByRole('button', { name: '复盘' })).toBeVisible();
  await page.getByRole('dialog', { name: '编辑标签' }).getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('dialog', { name: '编辑标签' })).toHaveCount(0);

  await page.getByRole('button', { name: '英语强化' }).click();
  await page.getByRole('button', { name: '删除标签' }).click();
  await expect(page.getByRole('button', { name: '英语强化' })).toHaveCount(0);
});

test('series page can view series courses, rename, open the last-read course, and delete empty series', async ({ page }) => {
  let seriesItems = [
    {
      id: 'series_1',
      title: '英语精听',
      article_count: 2,
      tags: ['英语'],
      is_starred: false,
      updated_at: '2026-08-20T10:00:00Z',
      last_read_at: '2026-08-21T09:00:00Z',
      last_read_course_id: 'course_a',
      latest_course_id: 'course_b'
    },
    {
      id: 'series_2',
      title: '空系列',
      article_count: 0,
      tags: [],
      is_starred: false,
      updated_at: '2026-08-20T10:00:00Z',
      last_read_at: null,
      last_read_course_id: null,
      latest_course_id: null
    }
  ];

  const seriesCourses = [
    mockCourse({
      id: 'course_a',
      title: '第一课',
      library_type: 'series',
      series_id: 'series_1',
      series_title: '英语精听',
      current_audio_url: '/courses/course_a/audio',
      tags: ['英语'],
      status: 'ready'
    }),
    mockCourse({
      id: 'course_b',
      title: '第二课',
      library_type: 'series',
      series_id: 'series_1',
      series_title: '英语精听',
      current_audio_url: '/courses/course_b/audio',
      tags: ['英语'],
      status: 'ready'
    })
  ];

  await page.route(/http:\/\/localhost:(8000|8070)\/courses(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (url.pathname === '/courses/tags') {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: [] }) });
      return;
    }

    if (url.pathname === '/courses/series' && request.method() === 'GET') {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ items: seriesItems }) });
      return;
    }

    if (url.pathname === '/courses/series' && request.method() === 'POST') {
      const payload = request.postDataJSON() as { title: string };
      const created = {
        id: 'series_3',
        title: payload.title,
        article_count: 0,
        tags: [],
        is_starred: false,
        updated_at: '2026-08-21T12:00:00Z',
        last_read_at: null,
        last_read_course_id: null,
        latest_course_id: null
      };
      seriesItems = [created, ...seriesItems];
      await route.fulfill({ status: 201, headers: apiHeaders, body: JSON.stringify(created) });
      return;
    }

    if (url.pathname === '/courses/series/series_1' && request.method() === 'GET') {
      const series = seriesItems.find((item) => item.id === 'series_1');
      if (!series) {
        throw new Error('missing series_1');
      }
      await route.fulfill({
        status: 200,
        headers: apiHeaders,
        body: JSON.stringify({ ...series, courses: seriesCourses })
      });
      return;
    }

    if (url.pathname === '/courses/course_a' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: apiHeaders,
        body: JSON.stringify(seriesCourses[0])
      });
      return;
    }

    if (url.pathname === '/courses/course_a/audio' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { ...apiHeaders, 'Content-Type': 'audio/mpeg' },
        body: 'audio-bytes'
      });
      return;
    }

    if (url.pathname === '/courses/series/series_1' && request.method() === 'PATCH') {
      const payload = request.postDataJSON() as { title?: string };
      seriesItems = seriesItems.map((series) =>
        series.id === 'series_1' ? { ...series, title: payload.title ?? series.title } : series
      );
      const updatedSeries = seriesItems.find((series) => series.id === 'series_1');
      if (!updatedSeries) {
        throw new Error('missing series_1');
      }
      await route.fulfill({
        status: 200,
        headers: apiHeaders,
        body: JSON.stringify(updatedSeries)
      });
      return;
    }

    if (url.pathname === '/courses/series/series_2' && request.method() === 'DELETE') {
      seriesItems = seriesItems.filter((series) => series.id !== 'series_2');
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (url.pathname === '/courses/series/series_1/move-to-fragments' && request.method() === 'POST') {
      await route.fulfill({ status: 200, headers: apiHeaders, body: JSON.stringify({ moved_count: 2 }) });
      return;
    }

    await route.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ detail: 'not found' }) });
  });

  await page.goto('/zh/series');
  await expect(page.getByRole('button', { name: '新建系列' })).toBeVisible();
  await expect(page.getByRole('button', { name: '删除所选' })).toHaveCount(0);

  await page.getByRole('button', { name: '新建系列' }).click();
  await page.getByRole('textbox', { name: '系列标题' }).fill('英语听读');
  await page.getByRole('button', { name: '保存系列' }).click();
  await expect(page.getByRole('button', { name: '英语听读', exact: true })).toBeVisible();

  const firstSeriesRow = page.getByRole('article').filter({ hasText: '英语精听' });
  await expect(firstSeriesRow.getByRole('button', { name: '查看' })).toBeVisible();
  await expect(firstSeriesRow.getByRole('button', { name: '阅读' })).toBeVisible();
  await expect(firstSeriesRow.getByRole('button', { name: '清空课程' })).toHaveCount(0);
  await expect(firstSeriesRow.getByRole('button', { name: '删除系列' })).toHaveCount(0);
  await firstSeriesRow.getByRole('button', { name: '更多操作: 英语精听' }).click();
  await expect(page.getByRole('menuitem', { name: '清空课程' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '删除系列' })).toBeVisible();
  await page.keyboard.press('Escape');

  await firstSeriesRow.getByRole('button', { name: '查看' }).click();
  await expect(page).toHaveURL(/\/zh\/series\/series_1\/courses$/);
  await expect(page.getByRole('link', { name: /第一课/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /第二课/ })).toBeVisible();

  await page.getByRole('link', { name: /第一课/ }).click();
  await expect(page).toHaveURL(/\/zh\/series\/series_1\/courses\/course_a(?:\?autoplay=1)?$/);
  await expect(page.getByRole('button', { name: '退出阅读' })).toBeVisible();
  await page.getByRole('button', { name: '退出阅读' }).click();
  await expect(page).toHaveURL(/\/zh\/series\/series_1\/courses$/);

  await page.goto('/zh/series');
  const seriesRow = page.getByRole('article').filter({ hasText: '英语精听' });
  await seriesRow.getByRole('button', { name: '阅读' }).click();
  await expect(page).toHaveURL(/\/zh\/series\/series_1\/courses\/course_a(?:\?autoplay=1)?$/);
  await expect(page.getByRole('heading', { name: '第一课' })).toBeVisible();
  await expect(page.locator('[data-reading-sidebar]')).toBeVisible();
  await expect(page.locator('[data-reading-sidebar]').getByRole('button', { name: '第一课', exact: true })).toBeVisible();
  await expect(page.locator('[data-reading-sidebar]').getByRole('button', { name: '第二课', exact: true })).toBeVisible();

  await page.goto('/zh/series');
  const renameRow = page.getByRole('article').filter({ hasText: '英语精听' });
  await renameRow.getByRole('button', { name: '英语精听', exact: true }).click();
  await renameRow.getByRole('textbox').fill('英语精听升级版');
  await renameRow.getByRole('textbox').press('Enter');
  await expect(page.getByRole('button', { name: '英语精听升级版', exact: true })).toBeVisible();
  expect(seriesItems.find((series) => series.id === 'series_1')?.title).toBe('英语精听升级版');

  await page.getByRole('checkbox', { name: '选择 空系列' }).check();
  await page.getByRole('button', { name: '删除所选' }).click();
  await expect(page.getByRole('button', { name: '空系列' })).toHaveCount(0);
});

test('series page paginates and clears selection when changing page', async ({ page }) => {
  const requestedPages: number[] = [];
  const seriesItems = Array.from({ length: 21 }, (_, index) => ({
    id: `series_${index + 1}`,
    title: `系列 ${index + 1}`,
    article_count: index % 3 === 0 ? 0 : 2,
    tags: [],
    is_starred: false,
    updated_at: `2026-08-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
    last_read_at: null,
    last_read_course_id: null,
    latest_course_id: null
  }));

  await page.route(/http:\/\/localhost:(8000|8070)\/courses\/series(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (request.method() !== 'GET') {
      await route.fulfill({ status: 404, headers: apiHeaders, body: JSON.stringify({ detail: 'not found' }) });
      return;
    }

    const pageNumber = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');
    const total = seriesItems.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (pageNumber - 1) * pageSize;
    const items = seriesItems.slice(start, start + pageSize);
    requestedPages.push(pageNumber);

    await route.fulfill({
      status: 200,
      headers: apiHeaders,
      body: JSON.stringify({
        items,
        pagination: {
          page: pageNumber,
          page_size: pageSize,
          total,
          total_pages: totalPages,
          has_previous: pageNumber > 1,
          has_next: pageNumber < totalPages
        }
      })
    });
  });

  await page.goto('/zh/series');
  await expect(page.getByRole('button', { name: '系列 1', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: '选择 系列 1', exact: true }).check();
  await expect(page.getByRole('button', { name: '删除所选' })).toBeVisible();

  await page.getByRole('button', { name: '2', exact: true }).click();
  await expect(page.getByRole('button', { name: '系列 21', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '删除所选' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '系列 1', exact: true })).toHaveCount(0);
  await expect.poll(() => requestedPages.at(-1)).toBe(2);
});
