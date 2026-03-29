import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Country name → approximate coordinates
const COUNTRY_COORDS = {
  'United States': [-95, 38],
  'China':         [104, 35],
  'Russia':        [90, 60],
  'Germany':       [10, 51],
  'India':         [78, 21],
  'Brazil':        [-51, -14],
  'United Kingdom':[  -2, 54],
  'France':        [  2, 46],
  'Internal':      null,   // skip private IPs
  'Unknown':       null,
}

export default function ThreatMap({ alerts }) {
  // Count alerts per country
  const countryCounts = alerts.reduce((acc, a) => {
    const c = a.ip_country
    if (!c || c === 'Internal' || c === 'Unknown') return acc
    acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})

  const markers = Object.entries(countryCounts)
    .filter(([c]) => COUNTRY_COORDS[c])
    .map(([country, count]) => ({
      country,
      count,
      coords: COUNTRY_COORDS[country],
    }))

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <h2 style={{ color: '#f8fafc', margin: '0 0 12px', fontSize: 16 }}>
        Threat Origin Map
      </h2>
      <ComposableMap
        style={{ width: '100%', height: 'auto' }}
        projectionConfig={{ scale: 140 }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1e3a5f"
                  stroke="#334155"
                  strokeWidth={0.5}
                  style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                />
              ))
            }
          </Geographies>
          {markers.map(({ country, count, coords }) => (
            <Marker key={country} coordinates={coords}>
              <circle
                r={Math.min(4 + count * 1.5, 20)}
                fill="#ef4444"
                fillOpacity={0.7}
                stroke="#f87171"
                strokeWidth={1}
              />
              <title>{country}: {count} alerts</title>
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
      {markers.length === 0 && (
        <div style={{ color: '#475569', textAlign: 'center', padding: 20, fontSize: 13 }}>
          No external IPs detected. Map shows real data with public IP addresses.
        </div>
      )}
    </div>
  )
}