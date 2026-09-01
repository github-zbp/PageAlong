"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { storeAuthToken } from "@/lib/api";

const RETURN_STORAGE_KEY = "pagealong_impersonation_return";
const ADMIN_TOKEN_STORAGE_KEY = "pagealong_admin_auth_token";

export function ImpersonationBanner() {
  const router = useRouter();
  const [returnPath, setReturnPath] = useState("");

  useEffect(() => {
    setReturnPath(window.localStorage.getItem(RETURN_STORAGE_KEY) ?? "");
  }, []);

  if (!returnPath) {
    return null;
  }

  function exitImpersonation() {
    const adminToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (adminToken) {
      storeAuthToken(adminToken);
    }
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(RETURN_STORAGE_KEY);
    router.replace(returnPath);
  }

  return (
    <div className="border-b border-[#ead8a8] bg-[#fff7df] px-4 py-2 text-sm text-[#6d5413]">
      正在以用户身份查看。
      <button
        className="pa-focus ml-3 underline underline-offset-2"
        onClick={exitImpersonation}
        type="button"
      >
        返回后台
      </button>
    </div>
  );
}
