/**
 * The brand figure that sits at the right end of a client page headline.
 *
 * Shared rather than inlined per page so the three headlines that carry it stay
 * the same size — they'd drift apart the moment one page's title changed size.
 * Sized by a square box with `contain`: the artwork is taller than it is wide,
 * so a plain width/height pair would squash it. No frame, tint or filter — the
 * artwork is meant to read at full strength.
 */
export default function HeadlineMark() {
  return (
    <img
      src="/icons/mm.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        width: 52,
        height: 52,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        userSelect: 'none',
      }}
    />
  )
}
