import {type ReactNode, useEffect, useState} from "react";

interface ClientOnlyProps {
    children: () => ReactNode;
    fallback?: ReactNode;
}

/**
 * Renders children only after the component has mounted on the client.
 * Useful for preventing SSR issues with components that rely on browser APIs
 * or cause hydration mismatches (e.g., due to useLayoutEffect).
 * @param children A function that returns the ReactNode to render on the client.
 * @param fallback Optional ReactNode to render on the server and before hydration.
 */
export function ClientOnly({children, fallback = null}: ClientOnlyProps) {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    if (!hasMounted) {
        return fallback;
    }

    // We need to call the children function to render the actual content
    return <>{children()}</>;
}

export default ClientOnly;
