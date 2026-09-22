import { useEffect, useState } from 'react';

/** <img> that disappears (leaving the container's background) when the image fails to load. */
export function SafeImg({ src, alt = '', ...rest }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (!src || failed) return null;
  return <img src={src} alt={alt} onError={() => setFailed(true)} {...rest} />;
}
