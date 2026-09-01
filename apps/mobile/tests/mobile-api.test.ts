jest.mock("@/lib/session-store", () => ({
  clearSessionToken: jest.fn(),
  getSessionToken: jest.fn(() => "session-token")
}));

jest.mock("@/lib/auth-storage", () => ({
  clearAuthToken: jest.fn()
}));

import { searchCoursesByTitle } from "@/lib/api";

it("searches all courses by title scope", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      items: [],
      pagination: {
        page: 1,
        page_size: 20,
        total: 0,
        total_pages: 1,
        has_previous: false,
        has_next: false
      }
    })
  })) as jest.Mock;

  await searchCoursesByTitle("电池");

  const calledUrl = String((global.fetch as jest.Mock).mock.calls[0][0]);
  expect(calledUrl).toContain("/courses?");
  expect(calledUrl).toContain("library_type=all");
  expect(calledUrl).toContain("query=%E7%94%B5%E6%B1%A0");
  expect(calledUrl).toContain("search_scope=title");
});
