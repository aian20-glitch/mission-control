// 1–3 star rating with a staggered pop-in.
export function Stars({ count, size = 44 }: { count: number; size?: number }) {
  const items = [0, 1, 2]
  return (
    <div className="rating" role="img" aria-label={count + ' of 3 stars'}>
      {items.map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={'rating-star' + (i < count ? ' is-on' : '')}
          style={{ animationDelay: 300 + i * 220 + 'ms' }}
        >
          <path d="M12 2.8l2.75 5.86 6.4.73-4.75 4.37 1.3 6.32L12 16.9l-5.7 3.18 1.3-6.32L2.85 9.4l6.4-.73L12 2.8z" />
        </svg>
      ))}
    </div>
  )
}
