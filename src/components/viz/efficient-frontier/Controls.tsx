
import React from 'react';

interface ControlsProps {
  assets: { id: string; name: string }[];
  correlations: number[][];
  onCorrelationChange: (i: number, j: number, value: number) => void;
}

export const Controls: React.FC<ControlsProps> = ({ assets, correlations, onCorrelationChange }) => {
  return (
    <div style={{
      padding: '20px',
      background: '#2a2a2a',
      borderRadius: '8px',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>Correlation Controls</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {assets.map((asset1, i) =>
          assets.map((asset2, j) => {
            if (i >= j) return null; // Only show upper triangle, exclude diagonal
            return (
              <div key={`${i}-${j}`} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.9em' }}>
                  {asset1.name} vs {asset2.name}: {correlations[i][j].toFixed(2)}
                </label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={correlations[i][j]}
                  onChange={(e) => onCorrelationChange(i, j, parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#4f46e5' }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
