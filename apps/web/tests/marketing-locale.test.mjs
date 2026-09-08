import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sitePath = fileURLToPath(new URL("../src/lib/site.ts", import.meta.url));

function loadSiteModule() {
  const source = fs.readFileSync(sitePath, "utf8");
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
    require,
    console
  };

  vm.runInNewContext(`(function (exports, module, require) { ${compiled}\n})(exports, module, require);`, context, {
    filename: sitePath
  });

  return module.exports;
}

function testMarketingLocaleComesFromLangQuery() {
  const { resolveMarketingLocale } = loadSiteModule();

  assert.equal(resolveMarketingLocale({ lang: "en" }), "en");
  assert.equal(resolveMarketingLocale({ lang: ["en", "zh"] }), "en");
  assert.equal(resolveMarketingLocale({ lang: "zh" }), "zh");
  assert.equal(resolveMarketingLocale({ lang: undefined }), "zh");
  assert.equal(resolveMarketingLocale(undefined), "zh");
}

function testMarketingEnglishHrefUsesPathPrefix() {
  const { marketingHref } = loadSiteModule();

  assert.equal(marketingHref("/", "en"), "/en");
  assert.equal(marketingHref("/story", "en"), "/en/story");
  assert.equal(marketingHref("/blog/reader-flow", "en"), "/en/blog/reader-flow");
  assert.equal(marketingHref("/", "zh"), "/");
  assert.equal(marketingHref("/story", "zh"), "/story");
}

testMarketingLocaleComesFromLangQuery();
testMarketingEnglishHrefUsesPathPrefix();
console.log("marketing locale tests passed");
