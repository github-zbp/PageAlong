import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const componentPath = fileURLToPath(new URL("../src/components/BlogPresentation.tsx", import.meta.url));

function loadBlogPresentationModule() {
  const source = fs.readFileSync(componentPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React
    }
  }).outputText;

  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require,
    React,
    console
  };

  vm.runInNewContext(`(function (exports, module, require) { ${compiled}\n})(exports, module, require);`, context, {
    filename: componentPath
  });

  return module.exports;
}

function testBlogCardRendersImageOnlyWhenCoverImageExists() {
  const { BlogCard } = loadBlogPresentationModule();

  const renderedWithImage = renderToStaticMarkup(
    React.createElement(BlogCard, {
      href: "/blog/reader-flow",
      title: "博客标题",
      summary: "让长文更好读。",
      coverImageUrl: "https://media.pagealong.test/blog-cover.jpg",
      metaLabel: "2026/08/28"
    })
  );
  assert.ok(renderedWithImage.includes("blog-cover.jpg"));
  assert.ok(renderedWithImage.includes("<img"));
  assert.ok(renderedWithImage.includes("让长文更好读。"));

  const renderedWithoutImage = renderToStaticMarkup(
    React.createElement(BlogCard, {
      href: "/blog/plain-entry",
      title: "纯文字博客",
      summary: "没有图片时应该保持干净的文字排版。",
      coverImageUrl: "",
      metaLabel: "2026/08/28"
    })
  );
  assert.ok(!renderedWithoutImage.includes("<img"));
  assert.ok(renderedWithoutImage.includes("纯文字博客"));
}

function testBlogArticleContentPreservesReadableArticleMarkup() {
  const { BlogArticleContent } = loadBlogPresentationModule();

  const rendered = renderToStaticMarkup(
    React.createElement(BlogArticleContent, {
      html: [
        "<h2>小标题</h2>",
        "<p>带有 <a href=\"https://example.com\">链接</a> 的正文。</p>",
        "<table><thead><tr><th>名称</th><th>值</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>",
        "<blockquote><p>引用块</p></blockquote>"
      ].join("")
    })
  );

  assert.ok(rendered.includes("pa-blog-content"));
  assert.ok(rendered.includes("<table"));
  assert.ok(rendered.includes("链接"));
  assert.ok(rendered.includes("引用块"));
}

testBlogCardRendersImageOnlyWhenCoverImageExists();
testBlogArticleContentPreservesReadableArticleMarkup();
console.log("blog presentation tests passed");
