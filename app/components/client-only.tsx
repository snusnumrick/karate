import { useState, useEffect } from "react";

export function ClientOnly({ children, fallback }: { children: () => React.ReactNode, fallback: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? children() : fallback;
}