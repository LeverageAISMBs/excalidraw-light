import React from 'react';
export function EmptyStateIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(20, 20)">
        <rect
          x="50"
          y="50"
          width="300"
          height="200"
          rx="10"
          fill="hsl(var(--muted))"
        />
        <g className="animate-float" style={{ animationDuration: '4s' }}>
          <path
            d="M 100 150 C 120 120, 180 120, 200 150"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        <g className="animate-float" style={{ animationDuration: '5s' }}>
          <rect
            x="220"
            y="100"
            width="60"
            height="40"
            rx="5"
            fill="hsla(244, 48%, 67%, 0.5)"
            stroke="hsl(244, 48%, 67%)"
            strokeWidth="3"
            transform="rotate(-10 250 120)"
          />
        </g>
        <g className="animate-float" style={{ animationDuration: '3s' }}>
          <circle
            cx="120"
            cy="110"
            r="20"
            fill="hsla(32, 90%, 54%, 0.5)"
            stroke="hsl(32, 90%, 54%)"
            strokeWidth="3"
          />
        </g>
        <text
          x="195"
          y="220"
          fontFamily="Inter, sans-serif"
          fontSize="16"
          textAnchor="middle"
          fill="hsl(var(--muted-foreground))"
        >
          Your canvas is ready
        </text>
      </g>
    </svg>
  );
}