import React from 'react';
import { createElement as h } from 'react';
const MATRIX_CELLS = [[0, 0], [4, 0], [8, 0], [8, 4], [8, 8], [4, 8], [0, 8], [0, 4]];
    function StateDot({ state }) {
      const phaseRef = React.useRef(null);
      if (phaseRef.current === null) phaseRef.current = Date.now() % 1000;
      if (state === 'ongoing') return h('svg', { className: 'wcm-dotMatrix', 'data-state': 'ongoing', width: 10, height: 10, viewBox: '0 0 10 10', shapeRendering: 'crispEdges', 'aria-hidden': true }, MATRIX_CELLS.map(([x, y], index) => { const delay = (((0 - phaseRef.current - index * 125) % 1000) + 1000) % 1000 - 1000; return h('rect', { className: 'wcm-dotCell', key: `${x}-${y}`, x, y, width: '2', height: '2', style: { animationDelay: `${delay}ms` } }); }));
      return h('span', { className: 'wcm-dot', 'data-state': state, style: { width: 10, height: 10 }, 'aria-hidden': true });
    }
export { StateDot };
