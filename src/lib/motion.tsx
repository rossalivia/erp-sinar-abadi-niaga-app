import { useReducedMotion } from "motion/react";
import React, { useEffect, useState } from "react";

/**
 * Enterprise Micro-Motion Design Tokens & Presets
 * Inspired by refined, state-of-the-art native desktop & enterprise interfaces.
 */

// Timing tokens
export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  smooth: 0.4,
  slow: 0.6,
} as const;

// Smooth cubic-bezier curve (macOS / iOS native feel)
export const EASING = {
  standard: [0.22, 1, 0.36, 1] as const,
  gentle: [0.16, 1, 0.3, 1] as const,
  sharp: [0.4, 0, 0.2, 1] as const,
};

// Physics-based spring presets
export const SPRING = {
  snappy: { stiffness: 400, damping: 30, mass: 0.8 },
  gentle: { stiffness: 260, damping: 26, mass: 1 },
  bouncy: { stiffness: 380, damping: 20 },
};

// Animation Variants
export const pageTransitionVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.normal,
      ease: EASING.standard,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: DURATION.fast,
      ease: EASING.sharp,
    },
  },
};

export const containerStaggerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
};

export const itemFadeUpVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.normal,
      ease: EASING.standard,
    },
  },
};

export const modalScaleVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: DURATION.normal,
      ease: EASING.standard,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: {
      duration: DURATION.fast,
      ease: EASING.sharp,
    },
  },
};

export const drawerSlideVariants = {
  closed: { x: "100%", opacity: 0.6 },
  open: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      ...SPRING.snappy,
    },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: {
      duration: DURATION.fast,
      ease: EASING.sharp,
    },
  },
};

/**
 * Animated Count-up for Numbers/Metrics (800ms smooth tabular numbers)
 */
export function CountUpNumber({
  value,
  duration = 800,
  formatter = (n: number) => n.toLocaleString("id-ID"),
  className = "",
}: {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(0);
  const currentValRef = React.useRef(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = currentValRef.current;
    const targetValue = value;
    const diff = targetValue - startValue;

    if (diff === 0) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + diff * easeProgress);
      currentValRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        currentValRef.current = targetValue;
        setDisplayValue(targetValue);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration, shouldReduceMotion]);

  const outputValue = shouldReduceMotion ? value : displayValue;

  return (
    <span className={`tabular-nums transition-colors duration-150 ${className}`}>
      {formatter(outputValue)}
    </span>
  );
}
