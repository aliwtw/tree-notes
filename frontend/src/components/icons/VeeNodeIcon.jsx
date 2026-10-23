function VeeNodeIcon({
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
      <path d="M12 19 L20 4" />
      <path d="M12 7 L3.5 4" />
      <path d="M20 4 L12 7" />
      <path d="M3.5 4 L12 19" />
    </svg>
  );
}

export default VeeNodeIcon;