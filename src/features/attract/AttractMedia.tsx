import { useEffect, useMemo, useRef, useState } from 'react';
import { asset } from '../../brand/brand';
import { useBrand } from '../../brand/BrandProvider';
import { t } from '../../brand/t';

export function AttractMedia({ active = true }: { active?: boolean }) {
  const brand = useBrand();
  const [videoFailed, setVideoFailed] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const videoSrc =
    brand.attract.mode === 'video'
      ? brand.attract.media.find((src) => src.endsWith('.mp4'))
      : undefined;
  const images = useMemo(
    () =>
      brand.attract.media.filter(
        (src) => !src.endsWith('.mp4') && !failedImages.includes(src),
      ),
    [brand.attract.media, failedImages],
  );
  const showingVideo = Boolean(videoSrc && !videoFailed);
  useEffect(() => {
    if (!showingVideo) return;
    const element = video.current;
    let mounted = true;
    if (element) {
      element.muted = true;
      if (!active) {
        element.pause();
        return;
      }
      void element.play()?.catch(() => {
        if (mounted) setVideoFailed(true);
      });
    }
    return () => {
      mounted = false;
      element?.pause();
    };
  }, [showingVideo, active]);
  useEffect(() => {
    if (!active || showingVideo || images.length < 2) return;
    const id = window.setInterval(
      () => setIndex((index) => (index + 1) % images.length),
      brand.attract.slideIntervalMs,
    );
    return () => window.clearInterval(id);
  }, [active, showingVideo, images.length, brand.attract.slideIntervalMs]);
  if (showingVideo)
    return (
      <video
        ref={video}
        className="aspect-square w-full rounded-brand object-cover"
        src={asset(videoSrc!)}
        muted
        playsInline
        loop
        autoPlay={active}
        preload="auto"
        aria-label={t('attract.mediaAlt')}
        onError={() => setVideoFailed(true)}
        draggable={false}
      />
    );
  const src = images[index % images.length] ?? brand.brand.logo;
  if (failedImages.includes(src))
    return (
      <p className="grid aspect-square place-items-center font-heading text-4xl">
        {brand.brand.name}
      </p>
    );
  return (
    <img
      src={asset(src)}
      alt={t('attract.mediaAlt')}
      className={`aspect-square w-full rounded-brand ${images.length ? 'object-cover' : 'object-contain p-8'}`}
      draggable={false}
      onError={() => setFailedImages((previous) => [...previous, src])}
    />
  );
}
