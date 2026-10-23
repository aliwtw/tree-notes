function SquareDottedIcon({
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
    >
      <path d="M10.5 21 L10.5 21" />
      <path d="M10.5 3 L10.5 3" />
      <path d="M13.5 21 L13.5 21" />
      <path d="M13.5 3 L13.5 3" />
      <path d="M17 21 L17 21" />
      <path d="M17 3 L17 3" />
      <path d="M20 3.278 A2 2 0 0 1 20.945 4.5" />
      <path d="M21 11 L21 11" />
      <path d="M21 14 L21 14" />
      <path d="M21 17 L21 17" />
      <path d="M21 19.502 A1.5 1.5 0 0 1 20.001 20.914" />
      <path d="M21 7.5 L21 7.5" />
      <path d="M3 11 L3 11" />
      <path d="M3 14 L3 14" />
      <path d="M3 17 L3 17" />
      <path d="M3 19.498 A1.5 1.5 0 0 0 4 20.914" />
      <path d="M3 7.5 L3 7.5" />
      <path d="M4 3.256 A2 2 0 0 0 3.06 4.5" />
      <path d="M7 21 L7 21" />
      <path d="M7 3 L7 3" />
    </svg>
  );
}

export default SquareDottedIcon;