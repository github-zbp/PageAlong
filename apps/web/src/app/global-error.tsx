"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const digest = error.digest;
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          background: "#f5f6f8",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif"
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              maxWidth: 380,
              margin: 24,
              padding: "36px 24px",
              textAlign: "center",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 8px 30px rgba(0,0,0,.08)"
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1f2329" }}>
              页面加载遇到问题
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                lineHeight: 1.6,
                color: "#646a73",
                wordBreak: "break-all"
              }}
            >
              可能应用刚刚发布了新版本。请刷新页面后继续使用。
              {digest ? `（错误编号：${digest}）` : null}
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              style={{
                marginTop: 22,
                marginRight: 12,
                padding: "9px 30px",
                border: "none",
                borderRadius: 999,
                background: "#1668dc",
                color: "#fff",
                fontSize: 15,
                cursor: "pointer"
              }}
            >
              刷新页面
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 22,
                padding: "9px 24px",
                border: "1px solid #d0d3d9",
                borderRadius: 999,
                background: "#fff",
                color: "#1f2329",
                fontSize: 15,
                cursor: "pointer"
              }}
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
