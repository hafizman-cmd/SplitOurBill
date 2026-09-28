export function BrandMark() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #005FCC 0%, #007AFF 55%, #47A3FF 100%)',
      }}
    >
      <svg viewBox="0 0 512 512" style={{ width: '100%', height: '100%' }}>
        <circle cx="256" cy="256" r="150" fill="none" stroke="#ffffff" strokeWidth="30" />
        <line
          x1="70"
          y1="256"
          x2="352"
          y2="256"
          stroke="#ffffff"
          strokeWidth="30"
          strokeLinecap="round"
        />
        <polyline
          points="352,180 440,256 352,332"
          fill="none"
          stroke="#ffffff"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
