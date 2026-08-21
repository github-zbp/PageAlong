import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

const apiSourcePath = path.resolve("src/lib/api.ts");

function loadApiModule({ env, windowValue, fetchImpl }) {
  const previousEnv = {
    API_BASE_URL: process.env.API_BASE_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL
  };

  if ("API_BASE_URL" in env) {
    process.env.API_BASE_URL = env.API_BASE_URL;
  } else {
    delete process.env.API_BASE_URL;
  }

  if ("NEXT_PUBLIC_API_BASE_URL" in env) {
    process.env.NEXT_PUBLIC_API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  const source = fs.readFileSync(apiSourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;

  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    process,
    fetch: fetchImpl
  };
  if (windowValue !== undefined) {
    context.window = windowValue;
  }

  vm.runInNewContext(
    `(function (exports, module) { ${compiled}\n})(exports, module);`,
    context,
    { filename: apiSourcePath }
  );

  if (previousEnv.API_BASE_URL === undefined) {
    delete process.env.API_BASE_URL;
  } else {
    process.env.API_BASE_URL = previousEnv.API_BASE_URL;
  }

  if (previousEnv.NEXT_PUBLIC_API_BASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_API_BASE_URL = previousEnv.NEXT_PUBLIC_API_BASE_URL;
  }

  return module.exports;
}

async function testServerSideApiRequestsUseAbsoluteInternalApiBaseUrl() {
  let requestedUrl = "";
  const api = loadApiModule({
    env: {
      API_BASE_URL: "http://127.0.0.1:8000",
      NEXT_PUBLIC_API_BASE_URL: "/api"
    },
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          id: "course_1",
          title: "Course",
          source_type: "manual_text",
          status: "text_ready",
          word_count: 1,
          duration_seconds: 0,
          last_playback_position_seconds: 0,
          sentences: []
        })
      };
    }
  });

  await api.getCourse("course_1");

  assert.equal(requestedUrl, "http://127.0.0.1:8000/courses/course_1");
}

async function testServerSideApiRequestsFallbackToAbsolutePublicApiBaseUrl() {
  let requestedUrl = "";
  const api = loadApiModule({
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8070"
    },
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          id: "course_1",
          title: "Course",
          source_type: "manual_text",
          status: "text_ready",
          word_count: 1,
          duration_seconds: 0,
          last_playback_position_seconds: 0,
          sentences: []
        })
      };
    }
  });

  await api.getCourse("course_1");

  assert.equal(requestedUrl, "http://localhost:8070/courses/course_1");
}

async function testBrowserApiRequestsMayUsePublicSameOriginApiPath() {
  let requestedUrl = "";
  const api = loadApiModule({
    env: {
      API_BASE_URL: "http://127.0.0.1:8000",
      NEXT_PUBLIC_API_BASE_URL: "/api"
    },
    windowValue: {},
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          id: "course_1",
          title: "Course",
          source_type: "manual_text",
          status: "text_ready",
          word_count: 1,
          duration_seconds: 0,
          last_playback_position_seconds: 0,
          sentences: []
        })
      };
    }
  });

  await api.createTextCourse({ title: "Course", text: "Text" });

  assert.equal(requestedUrl, "/api/courses");
}

function testBrowserCourseAudioUrlUsesPublicApiBaseUrl() {
  const api = loadApiModule({
    env: {
      API_BASE_URL: "http://127.0.0.1:8000",
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8070"
    },
    windowValue: {},
    fetchImpl: async () => {
      throw new Error("courseAudioUrl should not fetch");
    }
  });

  assert.equal(
    api.courseAudioUrl("course_1"),
    "http://localhost:8070/courses/course_1/audio"
  );
}

await testServerSideApiRequestsUseAbsoluteInternalApiBaseUrl();
await testServerSideApiRequestsFallbackToAbsolutePublicApiBaseUrl();
await testBrowserApiRequestsMayUsePublicSameOriginApiPath();
testBrowserCourseAudioUrlUsesPublicApiBaseUrl();
console.log("api-url tests passed");
