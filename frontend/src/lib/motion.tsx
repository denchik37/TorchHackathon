'use client';

import React, { useState, useEffect } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const fn = () => setReduce(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);
  return reduce;
}

/**
 * Card entrance: subtle fade + slight translate. Respects prefers-reduced-motion.
 */
export const cardEntrance = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: 'easeOut' },
};

/**
 * Modal entrance: scale + fade.
 */
export const modalEntrance = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

/**
 * Tab content: fade only (no slide to avoid layout jump).
 */
export const tabContentTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

export interface MotionCardProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'transition'> {
  reduceMotion?: boolean;
  children: React.ReactNode;
}

/**
 * Wrapper that applies subtle card entrance. Skips animation when reduceMotion is true or user prefers reduced motion.
 */
export function MotionCard({ reduceMotion, children, className, ...rest }: MotionCardProps) {
  const userPrefersReduce = useReducedMotion();
  const shouldReduce = reduceMotion ?? userPrefersReduce;
  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={cardEntrance.initial}
      animate={cardEntrance.animate}
      transition={cardEntrance.transition}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
