import Script from "next/script";

const BAIDU_TRACKING_ID = "ae7a718178f28ccdfed036cc94f8ebf5";

const BAIDU_ANALYTICS_SNIPPET = `
var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?${BAIDU_TRACKING_ID}";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();
`;

export function BaiduAnalyticsScript() {
  return (
    <Script id="baidu-analytics" strategy="beforeInteractive">
      {BAIDU_ANALYTICS_SNIPPET}
    </Script>
  );
}
