import { PlotSettings, RoomLayout } from './layoutSolver';

export function exportToPDF(
  settings: PlotSettings,
  rooms: RoomLayout[],
  compliance: any,
  optionName: string,
  totalCost: number
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up blocked! Please allow pop-ups to export reports.');
    return;
  }

  // Filter out parking and garden for building stats
  const buildRooms = rooms.filter(r => r.type !== 'parking' && r.type !== 'garden');
  const builtUpAreaPerFloor = buildRooms.filter(r => r.floor === 0).reduce((sum, r) => sum + r.w * r.h, 0);
  const totalArea = builtUpAreaPerFloor * settings.floors;

  // Format BOQ items
  const materials = [
    { name: 'Red Clay Bricks', qty: Math.round(totalArea * 18), unit: 'pieces' },
    { name: 'OPC/PPC Cement', qty: Math.round(totalArea * 0.42), unit: 'bags' },
    { name: 'Structural TMT Steel', qty: (totalArea * 0.0045).toFixed(2), unit: 'tons' },
    { name: 'Vitrified Floor Tiles', qty: Math.round(totalArea * 1.15), unit: 'sq ft' },
    { name: 'Coarse Sand & Aggregate', qty: Math.round(totalArea * 1.85), unit: 'cu ft' },
  ];

  const disclaimerText = `
    ⚠️ AI-GENERATED PRELIMINARY DRAFT. 
    This report is intended for concept development only. 
    Structural, electrical, plumbing, HVAC, fire safety, and municipal compliance 
    must be reviewed and approved by licensed professionals before construction or submission to authorities.
  `;

  // Write high-quality print HTML layout
  printWindow.document.write(`
    <html>
      <head>
        <title>AI Architectural Copilot - Design Presentation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 40px;
            font-size: 13px;
            line-height: 1.5;
          }
          header {
            border-bottom: 2px solid #10b981;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logo {
            font-size: 20px;
            font-weight: bold;
            font-family: monospace;
            color: #0f172a;
          }
          .tag {
            font-size: 9px;
            background: #10b981;
            color: #ffffff;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
          }
          h2 {
            font-size: 16px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            color: #0f172a;
            margin-top: 30px;
          }
          .grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          .card {
            border: 1px solid #e2e8f0;
            padding: 15px;
            border-radius: 6px;
            background: #f8fafc;
          }
          .card-title {
            font-size: 11px;
            font-weight: bold;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .card-value {
            font-size: 18px;
            font-weight: bold;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th, td {
            text-align: left;
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            background: #f1f5f9;
            font-weight: bold;
          }
          .disclaimer {
            background: #fef2f2;
            border: 1px solid #fee2e2;
            color: #991b1b;
            padding: 15px;
            border-radius: 6px;
            font-size: 11px;
            margin-top: 40px;
            font-family: monospace;
            line-height: 1.4;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <div class="logo">📐 AI ARCHITECTURAL COPILOT</div>
            <div style="font-size: 10px; color: #64748b;">Residential Conceptual Draft Report</div>
          </div>
          <div>
            <span class="tag">CONCEPT APPROVED</span>
          </div>
        </header>

        <div class="grid">
          <div class="card">
            <div class="card-title">Project Parameters</div>
            <div style="font-size: 13px;">
              <strong>Plot Area:</strong> ${settings.width}ft x ${settings.depth}ft (${settings.width * settings.depth} sq ft)<br>
              <strong>Location City:</strong> ${settings.location}<br>
              <strong>Bylaw Compliance Score:</strong> ${compliance.score}% (${compliance.passed ? 'PASSED' : 'ACTION REQUIRED'})<br>
              <strong>Elevation Theme:</strong> ${settings.style.toUpperCase()}<br>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Construction Sizing & Estimate</div>
            <div class="card-value">${totalArea} sq ft</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              Built-up Footprint: ${builtUpAreaPerFloor} sq ft | Stories: G+${settings.floors - 1}
            </div>
            <div class="card-value" style="color: #10b981; font-size: 20px; margin-top: 10px;">
              ₹${(totalCost / 100000).toFixed(2)} Lakhs (Est)
            </div>
          </div>
        </div>

        <h2>Selected Alternative: ${optionName}</h2>
        <table style="font-size: 12px;">
          <thead>
            <tr>
              <th>Room Name</th>
              <th>Dimensions (ft)</th>
              <th>Area (sq ft)</th>
              <th>Floor</th>
            </tr>
          </thead>
          <tbody>
            ${rooms
              .filter(r => r.type !== 'parking' && r.type !== 'garden')
              .map(
                r => `
              <tr>
                <td><strong>${r.name}</strong></td>
                <td>${r.w}' x ${r.h}'</td>
                <td>${r.w * r.h} sq ft</td>
                <td>Floor ${r.floor === 0 ? 'Ground' : r.floor === 1 ? 'First' : 'Terrace'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <h2>Bill of Materials (BOQ)</h2>
        <table>
          <thead>
            <tr>
              <th>Material Element Name</th>
              <th>Estimated Quantity</th>
              <th>Unit Measure</th>
            </tr>
          </thead>
          <tbody>
            ${materials
              .map(
                m => `
              <tr>
                <td><strong>${m.name}</strong></td>
                <td>${m.qty.toLocaleString()}</td>
                <td>${m.unit}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="disclaimer">
          ${disclaimerText}
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
