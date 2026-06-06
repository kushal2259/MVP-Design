import { RoomLayout } from './layoutSolver';

// Helper to generate a DXF file as a string
export function exportToDXF(rooms: RoomLayout[]): string {
  let dxf = '';

  // Header section
  dxf += `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n`;

  // Tables section for Layers
  dxf += `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n5\n`;
  const layers = ['WALLS', 'DOORS', 'WINDOWS', 'FURNITURE', 'LABELS'];
  const colors = [7, 1, 4, 8, 2]; // White, Red, Cyan, Dark Gray, Yellow
  layers.forEach((layer, i) => {
    dxf += `0\nLAYER\n2\n${layer}\n70\n0\n62\n${colors[i]}\n6\nCONTINUOUS\n`;
  });
  dxf += `0\nENDTAB\n0\nENDSEC\n`;

  // Entities section
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  rooms.forEach(r => {
    // Ignore garden/parking for core floor plan CAD layers
    if (r.type === 'garden') return;

    // Define room bounding box coordinates
    const x1 = r.x;
    const y1 = r.y;
    const x2 = r.x + r.w;
    const y2 = r.y + r.h;

    // 1. Draw Wall Lines (4 lines per room box)
    // Horizontal Top
    dxf += dxfLine(x1, y1, x2, y1, 'WALLS');
    // Vertical Left
    dxf += dxfLine(x1, y1, x1, y2, 'WALLS');
    // Vertical Right
    dxf += dxfLine(x2, y1, x2, y2, 'WALLS');
    // Horizontal Bottom
    dxf += dxfLine(x1, y2, x2, y2, 'WALLS');

    // 2. Draw Windows
    r.windows.forEach(w => {
      let wx1 = x1, wy1 = y1, wx2 = x1, wy2 = y1;
      if (w.side === 'front') {
        wx1 = x1 + w.offset; wy1 = y2; wx2 = wx1 + w.width; wy2 = y2;
      } else if (w.side === 'back') {
        wx1 = x1 + w.offset; wy1 = y1; wx2 = wx1 + w.width; wy2 = y1;
      } else if (w.side === 'left') {
        wx1 = x1; wy1 = y1 + w.offset; wx2 = x1; wy2 = wy1 + w.width;
      } else if (w.side === 'right') {
        wx1 = x2; wy1 = y1 + w.offset; wx2 = x2; wy2 = wy1 + w.width;
      }
      dxf += dxfLine(wx1, wy1, wx2, wy2, 'WINDOWS');
    });

    // 3. Draw Doors
    r.doors.forEach(d => {
      let dx1 = x1, dy1 = y1, dx2 = x1, dy2 = y1;
      if (d.side === 'front') {
        dx1 = x1 + d.offset; dy1 = y2; dx2 = dx1 + d.width; dy2 = y2;
      } else if (d.side === 'back') {
        dx1 = x1 + d.offset; dy1 = y1; dx2 = dx1 + d.width; dy2 = y1;
      } else if (d.side === 'left') {
        dx1 = x1; dy1 = y1 + d.offset; dx2 = x1; dy2 = dy1 + d.width;
      } else if (d.side === 'right') {
        dx1 = x2; dy1 = y1 + d.offset; dx2 = x2; dy2 = dy1 + d.width;
      }
      // Simple representation as a dashed line or standard line
      dxf += dxfLine(dx1, dy1, dx2, dy2, 'DOORS');
    });

    // 4. Room Label (Centered)
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    dxf += dxfText(r.name, cx, cy, 1.2, 'LABELS');
  });

  // End of Entities and EOF
  dxf += `0\nENDSEC\n0\nEOF\n`;

  return dxf;
}

// Generate DXF LINE entity
function dxfLine(x1: number, y1: number, x2: number, y2: number, layer: string): string {
  return `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(3)}\n20\n${y1.toFixed(3)}\n30\n0.0\n11\n${x2.toFixed(3)}\n21\n${y2.toFixed(3)}\n31\n0.0\n`;
}

// Generate DXF TEXT entity
function dxfText(text: string, x: number, y: number, height: number, layer: string): string {
  // DXF Text requires escaping spaces or keeping them clean.
  return `0\nTEXT\n8\n${layer}\n10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}\n30\n0.0\n40\n${height.toFixed(2)}\n1\n${text}\n50\n0.0\n`;
}
