if (typeof globalThis.Response !== "function") {
  class TestResponse {
    body: string;
    status: number;
    ok: boolean;

    constructor(body = "", init: { status?: number } = {}) {
      this.body = String(body);
      this.status = init.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
    }

    async json(): Promise<unknown> {
      return JSON.parse(this.body);
    }
  }

  globalThis.Response = TestResponse as typeof Response;
}

if (typeof globalThis.fetch !== "function") {
  globalThis.fetch = (async () => {
    throw new Error("fetch is not available in the Node 16 test runtime");
  }) as typeof fetch;
}
