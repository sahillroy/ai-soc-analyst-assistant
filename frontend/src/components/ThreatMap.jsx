import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_COORDS = {
  'United States': [-95, 38],
  'China': [104, 35],
  'Russia': [90, 60],
  'Germany': [10, 51],
  'India': [78, 21],
  'Brazil': [-51, -14],
  'United Kingdom': [-2, 54],
  'France': [2, 46],
};

export default function ThreatMap({ alerts = [] }) {
  const markers = useMemo(() => {
    const counts = alerts.reduce((acc, alert) => {
      const country = alert.ip_country;
      if (country && country !== 'Internal' && country !== 'Unknown' && COUNTRY_COORDS[country]) {
        acc[country] = (acc[country] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(counts).map(([country, count]) => ({
      name: country,
      coordinates: COUNTRY_COORDS[country],
      count,
    }));
  }, [alerts]);

  return (
    <div style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 20, marginBottom: 24, flex: 1, minHeight: '300px' }}>
      <h2 style={{ color: '#f8fafc', fontSize: 16, margin: '0 0 16px 0', fontWeight: 600 }}>Threat Origin Map</h2>
      {markers.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 14 }}>No external IPs detected. Map shows real data with public IP addresses.</p>
      ) : (
        <ComposableMap projectionConfig={{ scale: 140 }} style={{ width: '100%', height: 'calc(100% - 40px)' }}>
          <ZoomableGroup center={[0, 0]} zoom={1}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#1e3a5f"
                    stroke="#334155"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>
            {markers.map(({ name, coordinates, count }) => {
              const r = Math.min(4 + count * 1.5, 20);
              return (
                <Marker key={name} coordinates={coordinates}>
                  <circle 
                    r={r} 
                    fill="#ef4444" 
                    fillOpacity={0.7} 
                    stroke="#f87171" 
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
      )}
    </div>
  );
}