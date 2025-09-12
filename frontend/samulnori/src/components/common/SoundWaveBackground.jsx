import React from 'react';

// Sound Wave Background Component with CSS animations
const SoundWaveBackground = React.memo(() => {
  const waveColors = [
    '#E53E3E', '#3182CE', '#D69E2E', '#9F7AEA', '#38A169', '#ED8936', '#4FD1C7'
  ];

  return (
    <div 
      className="sound-wave-bg" 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        overflow: 'hidden', 
        pointerEvents: 'none', 
        zIndex: 1,
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        perspective: 1000
      }}
    >
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="wave-element"
          style={{
            position: 'absolute',
            borderRadius: '50%',
            opacity: 0.1,
            background: `radial-gradient(circle, ${waveColors[i % waveColors.length]}40, transparent)`,
            width: `${150 + i * 40}px`,
            height: `${150 + i * 40}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `waveFloat ${12 + i * 3}s ease-in-out infinite`
          }}
        />
      ))}
      
      {[...Array(5)].map((_, i) => (
        <div
          key={`geo-${i}`}
          className="geo-element"
          style={{
            position: 'absolute',
            opacity: 0.05,
            background: waveColors[i % waveColors.length],
            width: `${80 + i * 20}px`,
            height: `${80 + i * 20}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            clipPath: i % 3 === 0 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 
                     i % 3 === 1 ? 'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)' : 
                     'circle(50%)',
            animation: `geoRotate ${18 + i * 4}s linear infinite ${i % 2 === 0 ? '' : 'reverse'}`
          }}
        />
      ))}
    </div>
  );
});

export default SoundWaveBackground; 