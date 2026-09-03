"use client";

import type { ReactNode, SVGProps } from "react";
import { BrandMark } from "./BrandMark";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="1em"
      viewBox="0 0 24 24"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
    </BaseIcon>
  );
}

export function EllipsisVerticalIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M12 6.5v.01M12 12v.01M12 17.5v.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </BaseIcon>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M14 5h5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10 14 19 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M10.2 5.4 12 3l1.8 2.4 2.9.6 1.2 2.7 2.6 1.4-1 2.9 1 2.9-2.6 1.4-1.2 2.7-2.9.6L12 21l-1.8-2.4-2.9-.6-1.2-2.7-2.6-1.4 1-2.9-1-2.9 2.6-1.4 1.2-2.7z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
    </BaseIcon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M3.5 12.3V6.5A2.5 2.5 0 0 1 6 4h5.8a2.5 2.5 0 0 1 1.8.7l6.7 6.7a2.5 2.5 0 0 1 0 3.5l-5.8 5.8a2.5 2.5 0 0 1-3.5 0l-6.7-6.7a2.5 2.5 0 0 1-.7-1.7Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="8.2" cy="8.2" r="1.2" fill="currentColor" />
    </BaseIcon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </BaseIcon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M4.5 7h15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 7.5 7.2 19a2 2 0 0 0 2 1.8h5.6a2 2 0 0 0 2-1.8l.7-11.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="m12 4.5 2.5 5.1 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8L12 4.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </BaseIcon>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M9 6h6m-4-2h2a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 12h16.4M12 3.8c2.6 2.5 4 5.3 4 8.2s-1.4 5.7-4 8.2c-2.6-2.5-4-5.3-4-8.2s1.4-5.7 4-8.2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </BaseIcon>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M8 4h5l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M13 4v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8.4" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.4 19.4c1.5-3.1 4.2-4.8 6.6-4.8s5.1 1.7 6.6 4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M12 3.8 19 6.6v4.8c0 4.5-2.9 8.2-7 10.1-4.1-1.9-7-5.6-7-10.1V6.6L12 3.8Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M9.5 6.2H6.8A1.8 1.8 0 0 0 5 8v8a1.8 1.8 0 0 0 1.8 1.8h2.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M13 8.5 17 12l-4 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M17 12H9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}

export function PageAlongMarkIcon({ className }: { className?: string }) {
  return <BrandMark className={className} />;
}

export function DashboardIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4.5" y="4.5" width="6.2" height="6.2" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.3" y="4.5" width="6.2" height="6.2" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4.5" y="13.3" width="6.2" height="6.2" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.3" y="13.3" width="6.2" height="6.2" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
    </BaseIcon>
  );
}

export function SeriesIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="5" y="5" width="14" height="3.6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="5" y="10.2" width="14" height="3.6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="5" y="15.4" width="10.2" height="3.6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </BaseIcon>
  );
}

export function OutlineIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 6.5h3.2M11 6.5h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M7 12h2.4M12 12h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M9 17.5h2.2M14 17.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </BaseIcon>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M6 5.5h5.6a2 2 0 0 1 2 2V19H8a2 2 0 0 0-2 2V7.5a2 2 0 0 1 0-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M18 5.5h-5.6a2 2 0 0 0-2 2V19h5.6a2 2 0 0 1 2 2V7.5a2 2 0 0 0 0-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </BaseIcon>
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4.5v8.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m8.5 10.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M5.5 17h13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}

export function GuideIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M12 5.8v12.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 7.4c0-.9.7-1.6 1.6-1.6h4.1c.8 0 1.5.3 2 .9.4.4.6.9.6 1.4V19c-.6-.4-1.3-.7-2.1-.7H7.1a1.6 1.6 0 0 1-1.6-1.6V7.4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M18.5 7.4c0-.9-.7-1.6-1.6-1.6h-4.1c-.8 0-1.5.3-2 .9-.4.4-.6.9-.6 1.4V19c.6-.4 1.3-.7 2.1-.7h4.6a1.6 1.6 0 0 0 1.6-1.6V7.4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </BaseIcon>
  );
}

export function FeedbackIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M6.5 5.5h11A3 3 0 0 1 20.5 8.5v5A3 3 0 0 1 17.5 16.5H12.2l-3.5 2.7v-2.7H6.5A3 3 0 0 1 3.5 13.5v-5A3 3 0 0 1 6.5 5.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9 10.2h.01M12 10.2h.01M15 10.2h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.3"
      />
    </BaseIcon>
  );
}

export function FullscreenIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M20 20h-5v-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}

export function FullscreenExitIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M20 20v-5h-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </BaseIcon>
  );
}

export function ExtensionIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path
        d="M12 4.5v2.1a2.9 2.9 0 0 0 5.6 1.1l1.5-2.1 1.4 1.4-2.1 1.5a2.9 2.9 0 0 0 1.1 5.6H22v1.9h-2.5a2.9 2.9 0 0 0-1.1 5.6l2.1 1.5-1.4 1.4-1.5-2.1a2.9 2.9 0 0 0-5.6 1.1V19.5h-1.9v-2.1a2.9 2.9 0 0 0-5.6-1.1l-1.5 2.1-1.4-1.4 2.1-1.5a2.9 2.9 0 0 0-1.1-5.6H2v-1.9h2.5a2.9 2.9 0 0 0 1.1-5.6L3.5 5.4 4.9 4l1.5 2.1A2.9 2.9 0 0 0 12 5.1V4.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </BaseIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </BaseIcon>
  );
}
