function VeeIcon({
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
      <path d="M 10.537 20.688 L 4.037 4.688" />
      <path d="M10.5 11 L10.537 20.688" />
      <path d="M20.688 10.537 L10.5 11" />
      <path d="M4.037 4.688 L20.688 10.537" />
    </svg>
  );
}

export default VeeIcon;