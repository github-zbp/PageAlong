import { expect, test } from "@playwright/test";
import { dictionaries } from "../src/lib/i18n";

function collectFunctionPaths(value: unknown, path = "root", seen = new WeakSet<object>()): string[] {
  if (typeof value === "function") {
    return [path];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  if (seen.has(value as object)) {
    return [];
  }

  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectFunctionPaths(entry, `${path}[${index}]`, seen));
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
    collectFunctionPaths(entry, `${path}.${key}`, seen)
  );
}

test("i18n dictionaries do not contain functions", () => {
  expect(collectFunctionPaths(dictionaries)).toEqual([]);
});
