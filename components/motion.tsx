"use client";

import { motion, cubicBezier } from "framer-motion";

const ease = cubicBezier(0.16, 1, 0.3, 1);

export function MotionIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
