"use client";

import Link from "next/link";
import type { SiteLink } from "@/lib/site";

type Props = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  links: SiteLink[];
  onChange: (checked: boolean) => void;
};

export function AuthConsentRow({ checked, disabled = false, label, links, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className={`flex items-start gap-2 text-sm text-[var(--pa-muted)] ${disabled ? "opacity-60" : ""}`}>
        <input
          checked={checked}
          className="mt-0.5 h-4 w-4 accent-[var(--pa-green)]"
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="leading-6">{label}</span>
      </label>
      <div className="flex flex-wrap gap-3 pl-6 text-xs">
        {links.map((link) => (
          <Link key={link.href} className="text-[var(--pa-green)]" href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AuthConsentRow;
