"use client";

import React from "react";
import { motion } from "motion/react";
import { pageTransitionVariants } from "@/lib/motion";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full flex-1"
    >
      {children}
    </motion.div>
  );
}
