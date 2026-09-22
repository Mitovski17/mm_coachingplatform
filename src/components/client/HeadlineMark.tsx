/**
 * The 3D mark that sits at the LEFT end of a client page headline, before the
 * title text.
 *
 * Shared rather than inlined per page so the headlines that carry it stay
 * consistent — they'd drift apart the moment one page's title changed size.
 *
 * `size` is the side of a square box the artwork is fitted into with `contain`,
 * and it is tuned per icon rather than shared. The artworks have very different
 * aspect ratios (the dumbbell is half again as wide as it is tall; the figure is
 * taller than it is wide), so one box for all of them would leave the wide icons
 * reading much lighter than the square ones. The numbers below are set so each
 * icon covers roughly the same ink area — measured from the artwork's alpha
 * bounds, anchored on the apple. Nudge a single number if one still looks off.
 *
 * No frame, tint or filter: the artwork is meant to read at full strength.
 */

const MARKS = {
  /**
   * Dumbbell. Equal-ink-area alone put this at 39, but it is a dark grey object
   * on a near-black ground, so at that size it visibly receded next to the
   * saturated apple and the lit figure. 46 holds its own; past ~50 it starts to
   * outweigh the title.
   */
  train: { src: '/icons/nav/train.png', size: 46 },
  /** Apple. */
  nutrition: { src: '/icons/nav/food.png', size: 34 },
  /** The brand figure. */
  profile: { src: '/icons/mm.png', size: 36 },
  progress: { src: '/icons/mm.png', size: 36 },
} as const

export type HeadlineMarkName = keyof typeof MARKS

export default function HeadlineMark({ name }: { name: HeadlineMarkName }) {
  const { src, size } = MARKS[name]
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
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
