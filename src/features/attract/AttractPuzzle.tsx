import { useCallback, useEffect, useRef } from 'react';
import { asset } from '../../brand/brand';
import { useBrand } from '../../brand/BrandProvider';
import type { BrandConfig } from '../../brand/schema';
import { usePreparedImage } from '../game/image/usePreparedImage';

export type AttractImage = BrandConfig['game']['images'][number];
interface Props {
  image: AttractImage;
  size: 3 | 4;
  visible: boolean;
  reducedMotion: boolean;
  prepared?: { url: string | null };
}
export function AttractPuzzle(props: Props) {
  return props.prepared ? (
    <PuzzleArtwork {...props} prepared={props.prepared} />
  ) : (
    <LoadAttractPuzzle {...props} />
  );
}
function LoadAttractPuzzle(props: Props) {
  const { image } = props;
  const prepared = usePreparedImage(
    asset(image.src),
    image.focalPoint.x,
    image.focalPoint.y,
  );
  return <PuzzleArtwork {...props} prepared={prepared} />;
}

/** One shared square bitmap; the GPU only animates transforms and opacity. */
function PuzzleArtwork({
  image,
  size,
  visible,
  reducedMotion,
  prepared,
}: Props & { prepared: { url: string | null } }) {
  const { attract } = useBrand();
  const root = useRef<HTMLDivElement>(null);
  const motions = useRef<Animation[]>([]);
  const pageVisible = useRef(visible);
  const inView = useRef(true);
  const updateVisibility = useCallback(() => {
    motions.current.forEach((animation) =>
      pageVisible.current && inView.current
        ? animation.play()
        : animation.pause(),
    );
  }, []);
  useEffect(() => {
    pageVisible.current = visible;
    updateVisibility();
  }, [visible, updateVisibility]);
  const animated = attract.animation === 'puzzle-assemble' && !reducedMotion;
  useEffect(() => {
    const element = root.current;
    if (!element || !prepared.url || !animated || !element.animate) return;
    const options: KeyframeAnimationOptions = {
      duration: attract.animationCycleMs,
      iterations: Infinity,
      fill: 'both',
      easing: 'ease-in-out',
    };
    const animations: Animation[] = [];
    const count = size * size;
    element
      .querySelectorAll<HTMLElement>('[data-attract-tile]')
      .forEach((tile, id) => {
        const slot = (id * 5 + 3) % count;
        const x =
          ((slot % size) - (id % size)) * 100 +
          ((slot % size) - (size - 1) / 2) * 14;
        const y =
          (Math.floor(slot / size) - Math.floor(id / size)) * 100 +
          (Math.floor(slot / size) - (size - 1) / 2) * 14;
        const angle = ((id % 3) - 1) * 7;
        const scattered = `translate3d(${x}%, ${y}%, 0) rotate(${angle}deg) scale(.9)`;
        const floating = `translate3d(${x + (id % 2 ? 4 : -4)}%, ${y - 5}%, 0) rotate(${angle + 2}deg) scale(.9)`;
        const begin = 0.18 + id * 0.022;
        animations.push(
          tile.animate(
            [
              { offset: 0, transform: scattered, opacity: 0.85 },
              { offset: 0.09, transform: floating, opacity: 1 },
              { offset: begin, transform: scattered, opacity: 1 },
              {
                offset: begin + 0.1,
                transform: 'translate3d(0, 0, 0) rotate(0) scale(1)',
                opacity: 1,
              },
              {
                offset: 0.82,
                transform: 'translate3d(0, 0, 0) rotate(0) scale(1)',
                opacity: 1,
              },
              { offset: 0.95, transform: floating, opacity: 0.85 },
              { offset: 1, transform: scattered, opacity: 0.85 },
            ],
            options,
          ),
        );
      });
    const complete = element.querySelector<HTMLElement>(
      '[data-attract-complete]',
    )!;
    animations.push(
      complete.animate(
        [
          { offset: 0, opacity: 0 },
          { offset: 0.63, opacity: 0 },
          { offset: 0.67, opacity: 1 },
          { offset: 0.8, opacity: 1 },
          { offset: 0.85, opacity: 0 },
          { offset: 1, opacity: 0 },
        ],
        options,
      ),
    );
    const shine = element.querySelector<HTMLElement>('[data-attract-shine]')!;
    animations.push(
      shine.animate(
        [
          {
            offset: 0,
            transform: 'translate3d(-150%, 0, 0) skewX(-20deg)',
            opacity: 0,
          },
          {
            offset: 0.67,
            transform: 'translate3d(-150%, 0, 0) skewX(-20deg)',
            opacity: 0,
          },
          {
            offset: 0.69,
            transform: 'translate3d(-120%, 0, 0) skewX(-20deg)',
            opacity: 0.7,
          },
          {
            offset: 0.8,
            transform: 'translate3d(150%, 0, 0) skewX(-20deg)',
            opacity: 0,
          },
          {
            offset: 1,
            transform: 'translate3d(150%, 0, 0) skewX(-20deg)',
            opacity: 0,
          },
        ],
        options,
      ),
    );
    motions.current = animations;
    inView.current = true;
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            inView.current = entry.isIntersecting;
            updateVisibility();
          });
    observer?.observe(element);
    updateVisibility();
    return () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      motions.current = [];
    };
  }, [
    prepared.url,
    animated,
    size,
    attract.animationCycleMs,
    updateVisibility,
  ]);

  return (
    <div
      ref={root}
      className="attract-puzzle"
      data-motion={animated ? 'animated' : 'static'}
      role="img"
      aria-label="Imagen del puzzle de la marca"
    >
      {prepared.url ? (
        <>
          {Array.from({ length: size * size }, (_, id) => (
            <span
              key={id}
              data-attract-tile
              className="attract-puzzle-tile"
              style={{
                width: `${100 / size}%`,
                height: `${100 / size}%`,
                left: `${((id % size) * 100) / size}%`,
                top: `${(Math.floor(id / size) * 100) / size}%`,
                backgroundImage: `url(${JSON.stringify(prepared.url)})`,
                backgroundSize: `${size * 100}% ${size * 100}%`,
                backgroundPosition: `${((id % size) / (size - 1)) * 100}% ${(Math.floor(id / size) / (size - 1)) * 100}%`,
              }}
            />
          ))}
          <img
            data-attract-complete
            src={prepared.url}
            alt=""
            draggable={false}
            className="attract-puzzle-complete"
          />
          <span className="attract-shine-clip">
            <span data-attract-shine className="attract-shine" />
          </span>
        </>
      ) : (
        <img
          src={asset(image.src)}
          alt=""
          draggable={false}
          className="attract-puzzle-complete"
          style={{
            objectFit: 'cover',
            objectPosition: `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%`,
          }}
        />
      )}
    </div>
  );
}
