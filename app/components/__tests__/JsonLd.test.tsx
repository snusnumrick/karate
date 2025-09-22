import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsonLd } from '~/components/JsonLd';
import { NonceProvider } from '~/context/nonce';

describe('JsonLd component', () => {
  it('renders ld+json script with provided nonce and object data', () => {
    const data = { foo: 'bar', num: 1 };
    const html = renderToStaticMarkup(<JsonLd data={data} nonce="test-nonce" />);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('nonce="test-nonce"');
    expect(html).toContain(JSON.stringify(data));
  });

  it('falls back to NonceProvider context when nonce prop is omitted', () => {
    const data = { a: 1 };
    const html = renderToStaticMarkup(
      <NonceProvider value="ctx-nonce">
        <JsonLd data={data} />
      </NonceProvider>
    );
    expect(html).toContain('nonce="ctx-nonce"');
  });

  it('accepts pre-stringified data', () => {
    const str = '{"x":1}';
    const html = renderToStaticMarkup(<JsonLd data={str} nonce="n" />);
    expect(html).toContain(str);
  });
});

