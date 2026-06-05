import React from 'react';

/**
 * Renders a clean, structured orthogonal connector (square arrow ↳)
 * showing information flowing down and to the right from a label.
 */
export const FlowConnector = ({ height = 28, width = 28, color = 'var(--accent-blue)' }) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`} 
      fill="none" 
      style={{ 
        minWidth: width, 
        flexShrink: 0, 
        alignSelf: 'flex-start',
        marginTop: '-2px'
      }}
      className="flow-connector-svg"
    >
      {/* Horizontal & Vertical lines forming a square corner */}
      <path 
        d={`M ${width * 0.25} 0 V ${height * 0.65} H ${width - 6}`} 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="flow-path-static"
        style={{
          opacity: 0.8
        }}
      />
      {/* Arrowhead pointing right */}
      <path 
        d={`M ${width - 10} ${height * 0.65 - 4} L ${width - 5} ${height * 0.65} L ${width - 10} ${height * 0.65 + 4}`} 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{
          opacity: 0.8
        }}
      />
    </svg>
  );
};

export default FlowConnector;
