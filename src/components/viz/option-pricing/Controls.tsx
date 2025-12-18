import React from 'react';

interface ControlsProps {
  sigma: number;
  setSigma: (val: number) => void;
  mu: number;
  setMu: (val: number) => void;
  T: number;
  setT: (val: number) => void;
  S0: number;
  setS0: (val: number) => void;
  K: number;
  setK: (val: number) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  sigma, setSigma,
  mu, setMu,
  T, setT,
  S0, setS0,
  K, setK
}) => {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '2rem',
      padding: '1rem',
      background: '#1e1e1e',
      borderRadius: '8px',
      border: '1px solid #333',
      color: '#eee',
      marginTop: '1rem'
    }}>
      <div className="control-group">
        <label>Volatility (σ): {(sigma * 100).toFixed(1)}%</label>
        <input
          type="range"
          min="0.01"
          max="1.0"
          step="0.01"
          value={sigma}
          onChange={(e) => setSigma(parseFloat(e.target.value))}
        />
      </div>

      <div className="control-group">
        <label>Drift (μ): {(mu * 100).toFixed(1)}%</label>
        <input
          type="range"
          min="-0.2"
          max="0.5"
          step="0.01"
          value={mu}
          onChange={(e) => setMu(parseFloat(e.target.value))}
        />
      </div>

      <div className="control-group">
        <label>Time (T): {T} Years</label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={T}
          onChange={(e) => setT(parseFloat(e.target.value))}
        />
      </div>

      <div className="control-group">
        <label>Start Price (S0): ${S0}</label>
        <input
          type="range"
          min="50"
          max="200"
          step="1"
          value={S0}
          onChange={(e) => setS0(parseFloat(e.target.value))}
        />
      </div>

      <div className="control-group">
        <label>Strike Price (K): ${K.toFixed(2)}</label>
        <input
          type="range"
          min="50"
          max="200"
          step="1"
          value={K}
          onChange={(e) => setK(parseFloat(e.target.value))}
        />
        <small style={{display: 'block', color: '#888'}}>Or drag the line on chart</small>
      </div>

      <style>{`
        .control-group {
          display: flex;
          flex-direction: column;
          min-width: 200px;
        }
        input[type=range] {
          width: 100%;
          margin-top: 0.5rem;
          accent-color: var(--accent, #883aea);
        }
      `}</style>
    </div>
  );
};
