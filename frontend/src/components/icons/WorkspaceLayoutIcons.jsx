import React from "react";

function LayoutIconBase({
  size = 24,
  strokeWidth = 2,
  className,
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    />
  );
}

export function LayoutBalancedIcon(props) {
  return (
    <LayoutIconBase {...props}>
      <path d="M 3 4 A1 1 0 0 1 4 3" />
      <path d="M 3 9 L 3 4" />
      <path d="M 4 10 A1 1 0 0 1 3 9" />
      <path d="M10.5 4 L10.5 9" />
      <path d="M10.5 9 A1 1 0 0 1 9.5 10" />
      <path d="M13.5 4 A1 1 0 0 1 14.5 3" />
      <path d="M13.5 9 L13.5 4" />
      <path d="M14.5 10 A1 1 0 0 1 13.5 9" />
      <path d="M14.5 3 L20 3" />
      <path d="M20 10 L14.5 10" />
      <path d="M20 3 A1 1 0 0 1 21 4" />
      <path d="M21 4 L21 9" />
      <path d="M21 9 A1 1 0 0 1 20 10" />
      <path d="M4 3 L9.5 3" />
      <path d="M9.5 10 L4 10" />
      <path d="M9.5 3 A1 1 0 0 1 10.5 4" />
      <rect x="3" y="14" width="18" height="7" rx="1" />
    </LayoutIconBase>
  );
}

export function LayoutNotesPriorityIcon(props) {
  return (
    <LayoutIconBase {...props}>
      <rect x="15" y="3" width="6" height="7" rx="1" />
      <rect x="3" y="14" width="18" height="7" rx="1" />
      <rect x="3" y="3" width="9.5" height="7" rx="1" />
    </LayoutIconBase>
  );
}

export function LayoutGraphPriorityIcon(props) {
  return (
    <LayoutIconBase {...props}>
      <path d="M 3 4 A1 1 0 0 1 4 3" />
      <path d="M 3 9 L 3 4" />
      <path d="M 4 10 A1 1 0 0 1 3 9" />
      <path d="M11.5 4 A1 1 0 0 1 12.5 3" />
      <path d="M11.5 9 L11.5 4" />
      <path d="M12.5 10 A1 1 0 0 1 11.5 9" />
      <path d="M12.5 3 L20 3" />
      <path d="M15 14 L9.5 14" />
      <path d="M20 10 L12.5 10" />
      <path d="M20 3 A1 1 0 0 1 21 4" />
      <path d="M21 4 L21 9" />
      <path d="M21 9 A1 1 0 0 1 20 10" />
      <path d="M4 3 L8 3" />
      <path d="M8 10 L4 10" />
      <path d="M8 3 A1 1 0 0 1 9 4" />
      <path d="M9 4 L9 9" />
      <path d="M9 9 A1 1 0 0 1 8 10" />
      <rect x="3" y="14" width="18" height="7" rx="1" />
    </LayoutIconBase>
  );
}

export function LayoutSummaryPriorityIcon(props) {
  return (
    <LayoutIconBase {...props}>
      <path d="M 20 14 A1 1 0 0 1 21 15" />
      <path d="M 3 15 A1 1 0 0 1 4 14" />
      <path d="M 3 4 A1 1 0 0 1 4 3" />
      <path d="M 3 9 L 3 4" />
      <path d="M 4 10 A1 1 0 0 1 3 9" />
      <path d="M10.5 4 L10.5 9" />
      <path d="M10.5 9 A1 1 0 0 1 9.5 10" />
      <path d="M13.5 4 A1 1 0 0 1 14.5 3" />
      <path d="M13.5 9 L13.5 4" />
      <path d="M14.5 10 A1 1 0 0 1 13.5 9" />
      <path d="M20 10 L14.5 10" />
      <path d="M20 22.5 L4 22.5" />
      <path d="M20 3 A1 1 0 0 1 21 4" />
      <path d="M20 3 L14.5 3" />
      <path d="M21 15 L21 21.5" />
      <path d="M21 21.5 A1 1 0 0 1 20 22.5" />
      <path d="M21 4 L21 9" />
      <path d="M21 9 A1 1 0 0 1 20 10" />
      <path d="M3 21.5 L3 15" />
      <path d="M4 14 L20 14" />
      <path d="M4 22.5 A1 1 0 0 1 3 21.5" />
      <path d="M9.5 10 L4 10" />
      <path d="M9.5 3 A1 1 0 0 1 10.5 4" />
      <path d="M9.5 3 L4 3" />
    </LayoutIconBase>
  );
}
