"use client";

import React, {useEffect, useState} from "react";

export function useClientEffect(cb: () => void, deps?: React.DependencyList) {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        if (hasMounted) {
            cb();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasMounted, cb, ...(deps ?? [])]);
}
