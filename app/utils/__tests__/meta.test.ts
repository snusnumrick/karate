import { describe, it, expect } from 'vitest';
import type { MetaDescriptor } from '@remix-run/node';
import { mergeMeta } from '~/utils/meta';

describe('mergeMeta', () => {
  it('child overrides parent for same keys', () => {
    const parent: MetaDescriptor[] = [
      { title: 'Parent' },
      { name: 'description', content: 'parent' },
      { property: 'og:title', content: 'parent-og' },
      { tagName: 'link', rel: 'canonical', href: 'https://example.com/old' },
    ];
    const child: MetaDescriptor[] = [
      { title: 'Child' },
      { name: 'description', content: 'child' },
      { property: 'og:title', content: 'child-og' },
      { tagName: 'link', rel: 'canonical', href: 'https://example.com/new' },
    ];

    const merged = mergeMeta(parent, child);
    const title = merged.find((m) => 'title' in m) as any;
    const desc = merged.find((m) => 'name' in m && (m as any).name === 'description') as any;
    const og = merged.find((m) => 'property' in m && (m as any).property === 'og:title') as any;
    const canonical = merged.find((m) => 'tagName' in m && (m as any).rel === 'canonical') as any;

    expect(title.title).toBe('Child');
    expect(desc.content).toBe('child');
    expect(og.content).toBe('child-og');
    expect(canonical.href).toBe('https://example.com/new');
  });
});

