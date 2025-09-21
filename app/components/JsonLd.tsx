import { useNonce } from '~/context/nonce';

type JsonLdProps = {
  data: unknown | string;
  nonce?: string;
};

export function JsonLd({ data, nonce }: JsonLdProps) {
  const contextNonce = useNonce();
  const finalNonce = nonce ?? contextNonce;
  const __html = typeof data === 'string' ? data : JSON.stringify(data);

  return (
    <script
      type="application/ld+json"
      nonce={finalNonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html }}
    />
  );
}

export default JsonLd;
