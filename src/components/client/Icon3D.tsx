/**
 * One of the 3D artwork icons from `public/icons`, rendered bare.
 *
 * No plate, frame, tint or filter — the artwork carries itself, and wrapping it
 * in a coloured square is what made the old lucide glyphs need one.
 *
 * `size` is the side of a square box the artwork is fitted into with `contain`,
 * so it is a bound rather than the rendered size: a wide icon renders shorter
 * than `size`, a tall one narrower. It is tuned per icon at each call site
 * because the artworks have very different aspect ratios — a single number for
 * all of them leaves the wide ones reading lighter than the square ones.
 *
 * Decorative by default: these always sit next to a text label, so repeating it
 * in alt text would just make a screen reader say everything twice.
 */
export default function Icon3D({
  src,
  size,
  className,
  alt = '',
}: {
  src: string
  size: number
  className?: string
  alt?: string
}) {
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      draggable={false}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        userSelect: 'none',
      }}
    />
  )
}
