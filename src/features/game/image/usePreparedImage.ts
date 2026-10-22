import { useEffect, useState } from 'react';
import { prepareImage, type PreparedImage } from './prepareImage';

export function usePreparedImage(
  src: string,
  x: number,
  y: number,
  attempt = 0,
) {
  const key = JSON.stringify([src, x, y, attempt]);
  const [loaded, setLoaded] = useState<{
    key: string;
    url: string | null;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let resource: PreparedImage | undefined;
    void prepareImage(src, { x, y })
      .then((image) => {
        if (!active) {
          image.release();
          return;
        }
        resource = image;
        setLoaded({ key, url: image.url, error: false });
      })
      .catch(() => {
        if (active) setLoaded({ key, url: null, error: true });
      });
    return () => {
      active = false;
      resource?.release();
    };
  }, [key, src, x, y]);
  return loaded?.key === key ? loaded : { url: null, error: false };
}
