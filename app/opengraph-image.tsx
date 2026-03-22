import { ImageResponse } from 'next/og'

export const alt = 'Trade In Systems trading journal and backtesting platform'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px',
          background: 'linear-gradient(160deg, #07111f 0%, #0f172a 58%, #082f49 100%)',
          color: '#e2e8f0',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: 'rgba(125, 211, 252, 0.18)',
              border: '1px solid rgba(125, 211, 252, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#7dd3fc',
              fontSize: '28px',
            }}
          >
            /\
          </div>
          <div style={{ fontSize: '34px', fontWeight: 700 }}>Trade In Systems</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '860px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '68px', lineHeight: 1.05, fontWeight: 800, color: '#f8fafc' }}>
            <span>Journal Trades.</span>
            <span>Backtest Better.</span>
          </div>
          <div style={{ fontSize: '28px', lineHeight: 1.35, color: '#cbd5e1' }}>
            Track decisions, review R-multiple performance, and build a deliberate trading workflow in one platform.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '24px', color: '#bae6fd' }}>
          <div style={{ padding: '14px 20px', borderRadius: '999px', background: 'rgba(56, 189, 248, 0.12)' }}>Trading Journal</div>
          <div style={{ padding: '14px 20px', borderRadius: '999px', background: 'rgba(56, 189, 248, 0.12)' }}>Backtesting</div>
          <div style={{ padding: '14px 20px', borderRadius: '999px', background: 'rgba(56, 189, 248, 0.12)' }}>Trade Review</div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
