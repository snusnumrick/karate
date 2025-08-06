import type { MetaDescriptor } from "@remix-run/node";

/**
 * Helper function to merge meta tags, giving precedence to child tags.
 * This function handles deduplication of meta tags by creating unique keys
 * for different types of meta descriptors.
 * 
 * @param parentMeta - Meta tags from parent routes
 * @param childMeta - Meta tags from child routes (takes precedence)
 * @returns Merged array of meta descriptors with child tags overriding parent tags
 */
export function mergeMeta(
    parentMeta: MetaDescriptor[],
    childMeta: MetaDescriptor[]
): MetaDescriptor[] {
    const merged: Record<string, MetaDescriptor> = {};
    
    const getKey = (tag: MetaDescriptor): string | null => {
        if ('title' in tag) return 'title';
        if ('name' in tag) return `name=${tag.name}`;
        if ('property' in tag) return `property=${tag.property}`;
        // Handle canonical link specifically
        if ('tagName' in tag && tag.tagName === 'link' && tag.rel === 'canonical') return 'canonical';
        // Key for JSON-LD script
        if ('script:ld+json' in tag) return 'script:ld+json';
        // Fallback for other potential tags (less common)
        try {
            return JSON.stringify(tag);
        } catch {
            return null; // Cannot stringify
        }
    };

    // Add parent meta tags first
    parentMeta.forEach(tag => {
        const key = getKey(tag);
        if (key) merged[key] = tag;
    });

    // Add child meta tags, overwriting parent tags with the same key
    childMeta.forEach(tag => {
        const key = getKey(tag);
        if (key) merged[key] = tag; // Child overwrites parent
    });

    return Object.values(merged);
}