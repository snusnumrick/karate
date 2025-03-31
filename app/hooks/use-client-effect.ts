"use client";

import { useEffect, useState } from "react";

export function useClientEffect(cb: () => void, deps?: any[]) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      cb();
    }
  }, [hasMounted, ...(deps || [])]);
}
