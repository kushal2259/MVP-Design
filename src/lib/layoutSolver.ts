// New deterministic planner pipeline (LLM never produces geometry).
import { generatePlanFromSettings } from './planner';

export interface WindowConfig {
  id: string;
  side: 'front' | 'back' | 'left' | 'right';
  offset: number; // offset in feet from start of wall
  width: number; // width in feet
}

export interface DoorConfig {
  id: string;
  side: 'front' | 'back' | 'left' | 'right';
  offset: number;
  width: number;
  openDirection: 'in-left' | 'in-right' | 'out-left' | 'out-right';
}

export interface FurnitureConfig {
  id: string;
  type: 
    | 'sofa' | 'sofa-sectional' | 'sofa-3seater' | 'armchair' | 'coffee-table' | 'tv-unit' | 'bookshelf' | 'fireplace'
    | 'bed' | 'bed-king' | 'bed-queen' | 'bed-single' | 'nightstand' | 'wardrobe' | 'wardrobe-sliding' | 'wardrobe-hinged' | 'dresser' | 'study-desk'
    | 'kitchen-counter' | 'kitchen-island' | 'kitchen-counter-l' | 'kitchen-counter-straight' | 'dining-table' | 'dining-table-4seater' | 'dining-table-6seater' | 'refrigerator' | 'microwave-oven'
    | 'wc' | 'basin' | 'basin-single' | 'basin-double' | 'bathtub' | 'shower' | 'shower-enclosure'
    | 'car' | 'car-sedan' | 'car-suv' | 'bike-motorcycle' | 'plant' | 'plant-potted' | 'plant-fiddle' | 'washing-machine' | 'office-chair' | 'piano' | 'pool-table' | 'gym-treadmill' | 'dining-chair' | 'chair'
    | 'bunk-bed' | 'bed-canopy' | 'crib' | 'jacuzzi' | 'bbq-grill' | 'outdoor-umbrella' | 'gaming-desk' | 'gaming-chair' | 'aquarium' | 'bar-counter' | 'bar-stool' | 'credenza' | 'vanity-makeup' | 'gym-bench' | 'gym-rack' | 'laundry-hamper' | 'pet-bed' | 'sun-lounger' | 'recliner' | 'beanbag' | 'accent-chair' | 'indoor-swing' | 'bidet' | 'conference-table';
  x: number; // center x relative to room origin
  y: number; // center y relative to room origin
  w: number;
  h: number;
  rotation: number; // in degrees
}

export interface RoomLayout {
  id: string;
  name: string;
  type: 'living' | 'kitchen' | 'bedroom' | 'toilet' | 'balcony' | 'staircase' | 'corridor' | 'dining' | 'lobby' | 'parking' | 'garden';
  x: number; // relative to building top-left in feet
  y: number; // relative to building top-left in feet
  w: number; // width in feet
  h: number; // height/depth in feet
  floor: number; // 0 = ground, 1 = first, 2 = terrace
  isLocked?: boolean;
  color?: string;
  windows: WindowConfig[];
  doors: DoorConfig[];
  furniture: FurnitureConfig[];
  gridColStart?: number;
  gridColSpan?: number;
  gridRowStart?: number;
  gridRowSpan?: number;
}

export interface CustomOverride {
  type: 'add-door' | 'add-window' | 'resize-room' | 'rename-room';
  roomId: string;
  side?: 'front' | 'back' | 'left' | 'right';
  offset?: number;
  width?: number;
  targetRoomId?: string; // used as new name for rename-room
}

export interface PlotSettings {
  width: number; // ft
  depth: number; // ft
  location: string;
  floors: number;
  style: 'modern' | 'contemporary' | 'traditional' | 'luxury';
  budgetLakhs: number;
  bedrooms: number;
  kitchenStyle: 'large' | 'compact' | 'open';
  balconyRequired: boolean;
  customOverrides?: CustomOverride[];
}

export interface LayoutOption {
  id: 'option-a' | 'option-b' | 'option-c';
  name: string;
  tagline: string;
  description: string;
  rooms: RoomLayout[];
  costMultiplier: number;
}

export const DEFAULT_PLOT: PlotSettings = {
  width: 50,
  depth: 45,
  location: 'Ahmedabad',
  floors: 2,
  style: 'modern',
  budgetLakhs: 60,
  bedrooms: 4,
  kitchenStyle: 'large',
  balconyRequired: true,
  customOverrides: [],
};

// Local parser fallback
export function parseRequirementsText(text: string): Partial<PlotSettings> {
  const settings: Partial<PlotSettings> = {};
  const lower = text.toLowerCase();

  const bhkMatch = lower.match(/(\d)\s*bhk/);
  if (bhkMatch) settings.bedrooms = parseInt(bhkMatch[1]);

  const budgetMatch = lower.match(/(?:budget|rs\.?|₹)\s*(\d+)\s*(lakh|lacs|l)/);
  if (budgetMatch) settings.budgetLakhs = parseInt(budgetMatch[1]);

  if (lower.includes('g+1') || lower.includes('2 floor') || lower.includes('two floor') || lower.includes('double floor')) {
    settings.floors = 2;
  } else if (lower.includes('g+2') || lower.includes('3 floor') || lower.includes('three floor')) {
    settings.floors = 3;
  } else if (lower.includes('g+0') || lower.includes('single floor') || lower.includes('1 floor')) {
    settings.floors = 1;
  }

  const plotDimMatch = lower.match(/(\d+)\s*(?:x|\*|by)\s*(\d+)/);
  if (plotDimMatch) {
    settings.width = parseInt(plotDimMatch[1]);
    settings.depth = parseInt(plotDimMatch[2]);
  }

  if (lower.includes('modern')) settings.style = 'modern';
  else if (lower.includes('luxury') || lower.includes('premium')) settings.style = 'luxury';
  else if (lower.includes('traditional') || lower.includes('classic')) settings.style = 'traditional';
  else if (lower.includes('contemporary')) settings.style = 'contemporary';

  if (lower.includes('large kitchen')) settings.kitchenStyle = 'large';
  if (lower.includes('open kitchen')) settings.kitchenStyle = 'open';

  if (lower.includes('balcony') || lower.includes('terrace')) {
    settings.balconyRequired = true;
  }

  return settings;
}

// Resilient Gemini call. Prefers the server-side /api/ai proxy (so the key
// never touches the browser + caching); falls back to a direct, retrying call
// using the client-supplied key (e.g. for offline/script use).
async function geminiGenerate(apiKey: string, prompt: string, retries = 3): Promise<string> {
  // 1) Try the server proxy first (browser only — relative URL).
  if (typeof window !== 'undefined') {
    try {
      const r = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (r.ok) { const d = await r.json(); if (d?.text) return d.text as string; }
      // 501 = server key not configured → fall through to direct client call.
    } catch { /* fall through */ }
  }
  if (!apiKey) throw new Error('No AI key available (configure GEMINI_API_KEY on the server, or paste a key).');

  // 2) Direct call with retry/backoff.
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (response.ok) {
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      // Retry only on transient server/rate errors
      if (![429, 500, 502, 503].includes(response.status) || attempt === retries) {
        throw new Error(`API error ${response.status}`);
      }
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    }
    // exponential backoff with jitter: 0.6s, 1.4s, 2.6s …
    await new Promise(r => setTimeout(r, 600 * (attempt + 1) + Math.random() * 400));
  }
  throw lastErr || new Error('Gemini request failed');
}

// Active Gemini API parser
export async function parseRequirementsWithGemini(promptText: string, apiKey: string): Promise<Partial<PlotSettings>> {
  try {
    const promptInstructions = `
      You are an expert AI Architectural Assistant. Parse the following user request and extract design parameters.
      Return ONLY a raw JSON object matching the schema below. Do not include markdown code block formatting (no \`\`\`json).
      
      Schema:
      {
        "bedrooms": number,
        "floors": number,
        "width": number,
        "depth": number,
        "budgetLakhs": number,
        "style": "modern" | "contemporary" | "traditional" | "luxury",
        "kitchenStyle": "large" | "compact" | "open",
        "balconyRequired": boolean,
        "location": string
      }

      User Request: "${promptText}"
    `;

    const rawText = await geminiGenerate(apiKey, promptInstructions);
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('Failed to parse with Gemini, falling back to local regex: ', err);
    return parseRequirementsText(promptText);
  }
}

// Chatbot integration parser supporting customOverrides
export async function parseChatEditWithGemini(
  userMessage: string,
  currentSettings: PlotSettings,
  apiKey: string
): Promise<{ updatedSettings: PlotSettings; message: string }> {
  // Local guard to return immediately on simple greetings or empty queries
  const cleanMsg = userMessage.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const greetings = ['hi', 'hello', 'hey', 'yo', 'good morning', 'good afternoon', 'good evening', 'greetings', 'help', 'hi copilot', 'hello copilot', 'hey copilot', 'sup', 'whats up'];
  if (greetings.includes(cleanMsg) || cleanMsg.length < 3) {
    return {
      updatedSettings: currentSettings,
      message: "Hello! I am your AI Architectural Copilot. Tell me how you'd like to adjust your floor plan (e.g., 'Make it 3 BHK', 'Add a door from living room to kitchen', or 'Change style to luxury') and I will update it for you instantly!"
    };
  }

  try {
    const promptInstructions = `
      You are an expert AI Architectural Copilot. The user is requesting modifications to their active plan.
      Analyze the user request and their current project settings. Return updated settings including customOverrides.
      Return ONLY a raw JSON object matching the schema below. Do not include markdown formatting (no \`\`\`json).
      
      CRITICAL INSTRUCTION:
      If the user message is a greeting or does not specify any plan modifications, you MUST:
      1. Return "updatedSettings" exactly identical to the "Current Settings" (do not change any values, do not add any new customOverrides).
      2. Set "message" to a friendly greeting welcoming the user.
      
      Current Settings: ${JSON.stringify(currentSettings)}
      User Message: "${userMessage}"
      
      Expected Response Schema:
      {
        "updatedSettings": {
          "bedrooms": number,
          "floors": number,
          "width": number,
          "depth": number,
          "budgetLakhs": number,
          "style": "modern" | "contemporary" | "traditional" | "luxury",
          "kitchenStyle": "large" | "compact" | "open",
          "balconyRequired": boolean,
          "location": string,
          "customOverrides": [
            {
              "type": "add-door" | "add-window" | "resize-room" | "rename-room",
              "roomId": string (e.g., 'living-0', 'kitchen-0', 'stair-0', 'bedroom-1-0', 'toilet-com-0'),
              "side": "front" | "back" | "left" | "right",
              "offset": number (offset in feet along wall),
              "width": number (width in feet),
              "targetRoomId": string (optional, e.g. for rename-room it is the new name)
            }
          ]
        },
        "message": "A brief explanation of what changes you applied (e.g. 'Added a connecting door from the living room to the kitchen')"
      }
    `;

    const rawText = await geminiGenerate(apiKey, promptInstructions);
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('Failed to parse chat edit with Gemini: ', err);
    return {
      updatedSettings: currentSettings,
      message: "The AI is busy right now (the model may be momentarily overloaded). Please try again in a few seconds."
    };
  }
}

export function calculateSetbacks(width: number, depth: number, location: string) {
  let front = 8;
  let rear = 5;
  let left = 4;
  let right = 4;

  if (depth > 60) {
    front = 12;
    rear = 8;
  } else if (depth < 30) {
    front = 5;
    rear = 3;
  }

  if (width > 60) {
    left = 6;
    right = 6;
  } else if (width < 25) {
    left = 0;
    right = 3;
  }

  return { front, rear, left, right };
}

/**
 * Generate layout options.
 * Primary path: the new deterministic planner pipeline
 *   (Requirements → Rules → Constraints → Adjacency → Optimizer → Geometry).
 * The previous Vastu-grid generator is retained as a safe fallback only.
 */
export function generateLayouts(settings: PlotSettings): LayoutOption[] {
  try {
    const options = generatePlanFromSettings(settings);
    if (options && options.length) return options as unknown as LayoutOption[];
    return generateLayoutsLegacy(settings);
  } catch (err) {
    console.error('Planner pipeline failed, falling back to legacy Vastu grid:', err);
    return generateLayoutsLegacy(settings);
  }
}

function generateLayoutsLegacy(settings: PlotSettings): LayoutOption[] {
  const { width, depth, floors, bedrooms, location } = settings;
  const setbacks = calculateSetbacks(width, depth, location);

  const buildWidth = width - setbacks.left - setbacks.right;
  const buildDepth = depth - setbacks.front - setbacks.rear;

  const w = Math.max(20, buildWidth);
  const h = Math.max(18, buildDepth);

  return [
    {
      id: 'option-a',
      name: 'Option A: Vastu-Compliant Family',
      tagline: 'Traditional spatial harmony mapped to compass zones.',
      description: 'Places the Kitchen in South-East (Agneya), Master Bed in South-West (Nairutya), and Living entrance in North-East (Ishanya). Designed for maximum natural ventilation.',
      costMultiplier: 1.0,
      rooms: createGridBasedLayout(w, h, setbacks, bedrooms, floors, 'family', settings),
    },
    {
      id: 'option-b',
      name: 'Option B: Vastu-Compliant Luxury',
      tagline: 'Grand spatial proportions following Vastu zones.',
      description: 'Expands the South-West Master Suite and aggregates the North-East Living space into a double-volume lobby. Features kitchen dining integration in the South-East.',
      costMultiplier: 1.25,
      rooms: createGridBasedLayout(w, h, setbacks, bedrooms, floors, 'luxury', settings),
    },
    {
      id: 'option-c',
      name: 'Option C: Vastu-Compliant Open Space',
      tagline: 'Flowing open plan with traditional orientation.',
      description: 'Combines the Agneya (South-East) kitchen and Ishanya (North-East) lounge into a unified central deck while keeping the South-West zones private for bedrooms.',
      costMultiplier: 1.1,
      rooms: createGridBasedLayout(w, h, setbacks, bedrooms, floors, 'open', settings),
    },
  ];
}

// Parametric Vastu-Compliant Space Division Solver with size clamps & custom overrides
function createGridBasedLayout(
  buildW: number,
  buildH: number,
  setbacks: ReturnType<typeof calculateSetbacks>,
  bedroomsCount: number,
  floorsCount: number,
  philosophy: 'family' | 'luxury' | 'open',
  settings: PlotSettings
): RoomLayout[] {
  const rooms: RoomLayout[] = [];

  // Yard Slabs
  const parkW = Math.round(Math.min(14, buildW * 0.35));
  const parkH = Math.round(Math.min(setbacks.front + 6, 18));
  rooms.push({
    id: 'parking-g',
    name: 'Parking / Portico',
    type: 'parking',
    x: setbacks.left + 2,
    y: buildH + setbacks.rear - 2,
    w: parkW,
    h: parkH,
    floor: 0,
    windows: [],
    doors: [],
    furniture: [{ id: 'car-1', type: 'car', x: parkW / 2, y: parkH / 2, w: 6.5, h: 13, rotation: 90 }],
  });

  const gardW = Math.max(10, buildW - parkW - 4);
  rooms.push({
    id: 'garden-g',
    name: 'North-East Lawn',
    type: 'garden',
    x: setbacks.left + parkW + 4,
    y: buildH + setbacks.rear + 1,
    w: gardW,
    h: setbacks.front - 2,
    floor: 0,
    windows: [],
    doors: [],
    furniture: [
      { id: 'plant-1', type: 'plant', x: 2, y: 2, w: 2, h: 2, rotation: 0 },
    ],
  });

  // Structural Grid Bays
  const col0 = Math.round(buildW * 0.38); // West
  const col1 = Math.round(buildW * 0.24); // Center (stairwell)
  const col2 = buildW - col0 - col1;     // East

  const colOffsets = [0, col0, col0 + col1, buildW];

  const row0 = Math.round(buildH * 0.45); // North (Rear)
  const row1 = buildH - row0;            // South (Front)

  const rowOffsets = [0, row0, buildH];

  const addRoom = (r: RoomLayout) => {
    // 1. Windows: If windows are not specified, add default ones on exterior walls
    if (!r.windows || r.windows.length === 0) {
      r.windows = [];
      const rx = r.x;
      const ry = r.y;
      const rw = r.w;
      const rh = r.h;
      // North wall exterior
      if (ry <= 1) {
        r.windows.push({ id: `w-${r.id}-n`, side: 'back', offset: Math.round(rw / 2) - 1.5, width: 3 });
      }
      // South wall exterior
      if (ry + rh >= buildH - 1) {
        r.windows.push({ id: `w-${r.id}-s`, side: 'front', offset: Math.round(rw / 2) - 1.5, width: 3 });
      }
      // West wall exterior
      if (rx <= 1) {
        r.windows.push({ id: `w-${r.id}-w`, side: 'left', offset: Math.round(rh / 2) - 1.5, width: 3 });
      }
      // East wall exterior
      if (rx + rw >= buildW - 1) {
        r.windows.push({ id: `w-${r.id}-e`, side: 'right', offset: Math.round(rh / 2) - 1.5, width: 3 });
      }
    }

    // 2. Doors: If doors are not specified, add a default entry door
    if (!r.doors || r.doors.length === 0) {
      r.doors = [];
      if (r.type === 'living') {
        r.doors.push({ id: `d-${r.id}-main`, side: 'front', offset: 2, width: 3.5, openDirection: 'in-right' });
      } else if (r.type !== 'parking' && r.type !== 'garden') {
        // Place door on right wall or left wall facing the center lobby
        const side = r.x === 0 ? 'right' : 'left';
        r.doors.push({ id: `d-${r.id}-in`, side, offset: 1.5, width: 2.5, openDirection: 'in-left' });
      }
    }

    // 3. Ensure furniture list exists
    if (!r.furniture) {
      r.furniture = [];
    }

    rooms.push(r);
  };

  let bedCount = 0;

  // ----------------------------------------------------
  // OPTIONS GENERATOR FOR FAMILY, LUXURY, AND OPEN SPACE
  // ----------------------------------------------------

  if (philosophy === 'family') {
    // --- GROUND FLOOR ---
    // Living Room (NE Corner)
    addRoom({
      id: 'living-0',
      name: 'Living Room (NE)',
      type: 'living',
      x: colOffsets[2],
      y: 0,
      w: col2,
      h: row0,
      floor: 0,
      gridColStart: 2,
      gridColSpan: 1,
      gridRowStart: 0,
      gridRowSpan: 1,
      windows: [{ id: 'w-liv-e', side: 'right', offset: Math.round(row0 / 2) - 2, width: 4 }],
      doors: [
        { id: 'd-liv-main', side: 'front', offset: 2, width: 3.5, openDirection: 'in-right' }, // Main Entrance
        { id: 'd-liv-stair', side: 'left', offset: Math.round(row0 / 2) - 1.5, width: 3, openDirection: 'in-left' }, // To staircase
        { id: 'd-liv-kit', side: 'front', offset: col2 - 4, width: 3, openDirection: 'in-right' }, // To kitchen
      ],
      furniture: [
        { id: 'sofa-0', type: 'sofa', x: col2 / 2, y: 3, w: 8, h: 3, rotation: 0 },
        { id: 'coffee-0', type: 'coffee-table', x: col2 / 2, y: 5.5, w: 3, h: 2, rotation: 0 },
        { id: 'tv-0', type: 'tv-unit', x: col2 / 2, y: row0 - 1, w: 6, h: 1, rotation: 0 },
      ],
    });

    // Kitchen & Dining (SE Corner)
    addRoom({
      id: 'kitchen-0',
      name: 'Kitchen & Dining (SE)',
      type: 'kitchen',
      x: colOffsets[2],
      y: row0,
      w: col2,
      h: row1,
      floor: 0,
      gridColStart: 2,
      gridColSpan: 1,
      gridRowStart: 1,
      gridRowSpan: 1,
      windows: [
        { id: 'w-kit-s', side: 'front', offset: col2 / 2 - 1.5, width: 3 },
        { id: 'w-kit-e', side: 'right', offset: row1 / 2 - 1.5, width: 3 },
      ],
      doors: [
        { id: 'd-kit-liv', side: 'back', offset: col2 - 4, width: 3, openDirection: 'in-left' }, // From living
        { id: 'd-kit-lobby', side: 'left', offset: 2, width: 2.5, openDirection: 'in-left' }, // From lobby
      ],
      furniture: [
        { id: 'counter-0', type: 'kitchen-counter', x: col2 - 1.5, y: row1 / 2, w: 1.5, h: row1 - 3, rotation: 90 },
        { id: 'dining-0', type: 'dining-table', x: 4, y: row1 / 2, w: 4, h: 3, rotation: 0 },
      ],
    });

    // Parents Bedroom (SW Corner)
    if (bedroomsCount >= 1) {
      addRoom({
        id: 'bedroom-1-0',
        name: 'Parents Bedroom (SW)',
        type: 'bedroom',
        x: 0,
        y: row0,
        w: col0,
        h: row1,
        floor: 0,
        gridColStart: 0,
        gridColSpan: 1,
        gridRowStart: 1,
        gridRowSpan: 1,
        windows: [
          { id: 'w-bed1-w', side: 'left', offset: row1 / 2 - 2, width: 4 },
          { id: 'w-bed1-s', side: 'front', offset: col0 / 2 - 2, width: 4 },
        ],
        doors: [
          { id: 'd-bed1-lobby', side: 'right', offset: 2, width: 3, openDirection: 'in-left' }, // From lobby
        ],
        furniture: [
          { id: 'bed-1', type: 'bed', x: col0 / 2, y: row1 - 4, w: 5, h: 6, rotation: 0 },
          { id: 'wardrobe-1', type: 'wardrobe', x: 1.5, y: 3.5, w: 2, h: 5, rotation: 90 },
        ],
      });
      bedCount++;
    }

    // Guest Bedroom (NW Corner)
    if (bedroomsCount >= 2) {
      addRoom({
        id: 'bedroom-2-0',
        name: 'Guest Bedroom (NW)',
        type: 'bedroom',
        x: 0,
        y: 0,
        w: col0,
        h: row0,
        floor: 0,
        gridColStart: 0,
        gridColSpan: 1,
        gridRowStart: 0,
        gridRowSpan: 1,
        windows: [
          { id: 'w-bed2-w', side: 'left', offset: row0 / 2 - 2, width: 4 },
          { id: 'w-bed2-n', side: 'back', offset: col0 / 2 - 2, width: 4 },
        ],
        doors: [
          { id: 'd-bed2-stair', side: 'right', offset: 2, width: 3, openDirection: 'in-left' }, // From stairwell
        ],
        furniture: [
          { id: 'bed-2', type: 'bed', x: col0 / 2, y: 4, w: 5, h: 6, rotation: 180 },
          { id: 'wardrobe-2', type: 'wardrobe', x: col0 - 1.5, y: row0 - 3.5, w: 2, h: 5, rotation: 90 },
        ],
      });
      bedCount++;
    }

    // Staircase (Center-North)
    const stairW = Math.min(8, col1);
    const stairH = Math.min(12, row0);
    addRoom({
      id: 'stair-0',
      name: 'Staircase Well',
      type: 'staircase',
      x: colOffsets[1],
      y: 0,
      w: stairW,
      h: stairH,
      floor: 0,
      gridColStart: 1,
      gridColSpan: 1,
      gridRowStart: 0,
      gridRowSpan: 1,
      windows: [],
      doors: [
        { id: 'd-stair-liv', side: 'right', offset: 2, width: 3, openDirection: 'in-right' }, // From living
        { id: 'd-stair-bed2', side: 'left', offset: 2, width: 3, openDirection: 'in-left' }, // To guest bed
        { id: 'd-stair-lobby', side: 'front', offset: 2, width: 3, openDirection: 'in-left' }, // To lobby
      ],
      furniture: [],
    });

    // Central Lobby & Common Bath (Center-South)
    const toiletW = Math.min(8, col1);
    const toiletH = 6;
    const lobbyH = row1 - toiletH;

    // Common Toilet Foyer / Lobby
    addRoom({
      id: 'lobby-0',
      name: 'Central Lobby',
      type: 'lobby',
      x: colOffsets[1],
      y: row0,
      w: col1,
      h: lobbyH,
      floor: 0,
      windows: [],
      doors: [
        { id: 'd-lobby-bed1', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
        { id: 'd-lobby-kit', side: 'right', offset: 2, width: 2.5, openDirection: 'in-right' },
        { id: 'd-lobby-toilet', side: 'front', offset: 2, width: 2.5, openDirection: 'in-left' },
        { id: 'd-lobby-stair', side: 'back', offset: 2, width: 3, openDirection: 'in-left' },
      ],
      furniture: [],
    });

    // Common Toilet
    addRoom({
      id: 'toilet-com-0',
      name: 'Common Bath',
      type: 'toilet',
      x: colOffsets[1],
      y: row0 + lobbyH,
      w: toiletW,
      h: toiletH,
      floor: 0,
      gridColStart: 1,
      gridColSpan: 1,
      gridRowStart: 1,
      gridRowSpan: 1,
      windows: [{ id: 'v-toilet-com', side: 'front', offset: toiletW / 2 - 1, width: 2 }],
      doors: [
        { id: 'd-toilet-com-in', side: 'back', offset: 2, width: 2.5, openDirection: 'in-left' },
      ],
      furniture: [
        { id: 'wc-com', type: 'wc', x: 2, y: toiletH - 1.5, w: 1.5, h: 2, rotation: 0 },
        { id: 'basin-com', type: 'basin', x: toiletW - 1.5, y: 1.5, w: 2, h: 1.5, rotation: 0 },
        { id: 'shower-com', type: 'shower', x: toiletW - 2, y: toiletH - 2, w: 3, h: 3, rotation: 0 },
      ],
    });

    // --- FIRST FLOOR ---
    // --- UPPER FLOORS (1 and 2) ---
    for (let f = 1; f < floorsCount; f++) {
      addRoom({
        id: `stair-${f}`,
        name: 'Staircase Well',
        type: 'staircase',
        x: colOffsets[1],
        y: 0,
        w: stairW,
        h: stairH,
        floor: f,
        windows: [],
        doors: [
          { id: `d-stair${f}-lobby`, side: 'front', offset: 2, width: 3, openDirection: 'in-left' },
        ],
        furniture: [],
      });

      if (f === 1) {
        // First Floor Lounge
        addRoom({
          id: 'lounge-1',
          name: 'Family Lounge',
          type: 'lobby',
          x: colOffsets[1],
          y: row0,
          w: col1,
          h: row1,
          floor: 1,
          windows: [{ id: 'w-lounge-s', side: 'front', offset: col1 / 2 - 1.5, width: 3 }],
          doors: [
            { id: 'd-lounge-stair', side: 'back', offset: 2, width: 3, openDirection: 'in-left' },
            ...(floorsCount === 2 ? [{ id: 'd-lounge-mast', side: 'left' as const, offset: 2, width: 3, openDirection: 'in-left' as const }] : []),
            { id: 'd-lounge-bed3', side: 'right', offset: 2, width: 3, openDirection: 'in-right' },
          ],
          furniture: [
            { id: 'sofa-lounge', type: 'sofa', x: col1 / 2, y: row1 / 2, w: 6, h: 2.5, rotation: 90 },
          ],
        });

        // Kids Bedroom (SE Corner)
        if (bedCount < bedroomsCount) {
          addRoom({
            id: 'bedroom-3-1',
            name: 'Kids Bedroom (SE)',
            type: 'bedroom',
            x: colOffsets[2],
            y: row0,
            w: col2,
            h: row1,
            floor: 1,
            windows: [
              { id: 'w-bed3-s', side: 'front', offset: col2 / 2 - 2, width: 4 },
              { id: 'w-bed3-e', side: 'right', offset: row1 / 2 - 2, width: 4 },
            ],
            doors: [
              { id: 'd-bed3-lobby', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-3', type: 'bed', x: col2 / 2, y: row1 - 4, w: 5, h: 6, rotation: 0 },
            ],
          });
          bedCount++;
        }

        // Guest Bed 2 (NE Corner)
        if (bedCount < bedroomsCount) {
          addRoom({
            id: 'bedroom-4-1',
            name: 'Guest Bed 2 (NE)',
            type: 'bedroom',
            x: colOffsets[2],
            y: 0,
            w: col2,
            h: row0,
            floor: 1,
            windows: [
              { id: 'w-bed4-n', side: 'back', offset: col2 / 2 - 2, width: 4 },
              { id: 'w-bed4-e', side: 'right', offset: row0 / 2 - 2, width: 4 },
            ],
            doors: [
              { id: 'd-bed4-lobby', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-4', type: 'bed', x: col2 / 2, y: 4, w: 5, h: 6, rotation: 180 },
            ],
          });
          bedCount++;
        }

        // If floorsCount === 2, place Master Suite on floor 1
        if (floorsCount === 2 && bedCount < bedroomsCount) {
          addRoom({
            id: 'bedroom-master-1',
            name: 'Master Suite (SW)',
            type: 'bedroom',
            x: 0,
            y: row0,
            w: col0,
            h: row1,
            floor: 1,
            windows: [
              { id: 'w-mast-w', side: 'left', offset: row1 / 2 - 2, width: 4 },
              { id: 'w-mast-s', side: 'front', offset: col0 / 2 - 2, width: 4 },
            ],
            doors: [
              { id: 'd-mast-lobby', side: 'right', offset: 2, width: 3, openDirection: 'in-left' },
              { id: 'd-mast-bath', side: 'back', offset: 2, width: 2.5, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-mast', type: 'bed', x: col0 / 2, y: row1 - 4, w: 6, h: 6.5, rotation: 0 },
              { id: 'wardrobe-mast', type: 'wardrobe', x: 1.5, y: 3.5, w: 2, h: 6, rotation: 90 },
            ],
          });
          bedCount++;

          addRoom({
            id: 'toilet-master-1',
            name: 'Master Bath',
            type: 'toilet',
            x: 0,
            y: 0,
            w: col0,
            h: row0,
            floor: 1,
            windows: [{ id: 'v-toilet-mast', side: 'left', offset: row0 / 2 - 1, width: 2 }],
            doors: [
              { id: 'd-toilet-mast-in', side: 'front', offset: 2, width: 2.5, openDirection: 'in-right' },
            ],
            furniture: [
              { id: 'wc-mast', type: 'wc', x: 2, y: row0 - 2, w: 1.5, h: 2, rotation: 0 },
              { id: 'basin-mast', type: 'basin', x: col0 - 2, y: 2, w: 2.5, h: 1.5, rotation: 0 },
              { id: 'shower-mast', type: 'shower', x: col0 - 2.5, y: row0 - 2.5, w: 3, h: 3, rotation: 0 },
            ],
          });
        }
      }

      if (f === 2) {
        // Second Floor Master Suite (SW)
        if (bedCount < bedroomsCount) {
          addRoom({
            id: 'bedroom-master-2',
            name: 'Master Suite (SW)',
            type: 'bedroom',
            x: 0,
            y: row0,
            w: col0,
            h: row1,
            floor: 2,
            windows: [
              { id: 'w-mast-w2', side: 'left', offset: row1 / 2 - 2, width: 4 },
              { id: 'w-mast-s2', side: 'front', offset: col0 / 2 - 2, width: 4 },
            ],
            doors: [
              { id: 'd-mast-lobby2', side: 'right', offset: 2, width: 3, openDirection: 'in-left' },
              { id: 'd-mast-bath2', side: 'back', offset: 2, width: 2.5, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-mast2', type: 'bed', x: col0 / 2, y: row1 - 4, w: 6, h: 6.5, rotation: 0 },
              { id: 'wardrobe-mast2', type: 'wardrobe', x: 1.5, y: 3.5, w: 2, h: 6, rotation: 90 },
            ],
          });
          bedCount++;

          addRoom({
            id: 'toilet-master-2',
            name: 'Master Bath',
            type: 'toilet',
            x: 0,
            y: 0,
            w: col0,
            h: row0,
            floor: 2,
            windows: [{ id: 'v-toilet-mast2', side: 'left', offset: row0 / 2 - 1, width: 2 }],
            doors: [
              { id: 'd-toilet-mast-in2', side: 'front', offset: 2, width: 2.5, openDirection: 'in-right' },
            ],
            furniture: [
              { id: 'wc-mast2', type: 'wc', x: 2, y: row0 - 2, w: 1.5, h: 2, rotation: 0 },
              { id: 'basin-mast2', type: 'basin', x: col0 - 2, y: 2, w: 2.5, h: 1.5, rotation: 0 },
              { id: 'shower-mast2', type: 'shower', x: col0 - 2.5, y: row0 - 2.5, w: 3, h: 3, rotation: 0 },
            ],
          });
        }

        // Executive Study / Gym (Center-South)
        addRoom({
          id: 'study-2',
          name: 'Executive Study / Lounge',
          type: 'lobby',
          x: colOffsets[1],
          y: row0,
          w: col1,
          h: row1,
          floor: 2,
          windows: [{ id: 'w-study-s', side: 'front', offset: col1 / 2 - 1.5, width: 3 }],
          doors: [
            { id: 'd-study-stair', side: 'back', offset: 2, width: 3, openDirection: 'in-left' },
            { id: 'd-study-mast', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
          ],
          furniture: [
            { id: 'desk-study', type: 'study-desk', x: col1 / 2, y: 3, w: 4.5, h: 2.2, rotation: 0 },
            { id: 'chair-study', type: 'office-chair', x: col1 / 2, y: 5.5, w: 2, h: 2, rotation: 180 },
          ],
        });
      }
    }

  } else if (philosophy === 'luxury') {
    // --- GROUND FLOOR ---
    const doubleW = col1 + col2;
    // Imperial Living Hall (Center + NE)
    addRoom({
      id: 'living-0',
      name: 'Imperial Living Hall (NE/Center)',
      type: 'living',
      x: colOffsets[1],
      y: 0,
      w: doubleW,
      h: row0,
      floor: 0,
      windows: [{ id: 'w-lux-liv', side: 'back', offset: doubleW / 2 - 2, width: 8 }],
      doors: [
        { id: 'd-lux-main', side: 'front', offset: col1 + 2, width: 4.5, openDirection: 'in-right' }, // Grand entry
        { id: 'd-lux-stair', side: 'front', offset: 2, width: 4, openDirection: 'in-left' }, // To stair lobby
        { id: 'd-lux-suite', side: 'left', offset: 2, width: 3, openDirection: 'in-left' }, // To ground suite
      ],
      furniture: [
        { id: 'sofa-lux', type: 'sofa', x: doubleW / 2, y: 3.5, w: 10, h: 3.5, rotation: 0 },
        { id: 'coffee-lux', type: 'coffee-table', x: doubleW / 2, y: 7, w: 4, h: 2.5, rotation: 0 },
        { id: 'tv-lux', type: 'tv-unit', x: doubleW / 2, y: row0 - 1.5, w: 8, h: 1, rotation: 0 },
        { id: 'plant-lux1', type: 'plant', x: 2, y: 2, w: 2, h: 2, rotation: 0 },
      ],
    });

    // Staircase (Center-South)
    addRoom({
      id: 'stair-0',
      name: 'Grand Staircase',
      type: 'staircase',
      x: colOffsets[1],
      y: row0,
      w: col1,
      h: row1,
      floor: 0,
      windows: [],
      doors: [
        { id: 'd-stair-lux', side: 'back', offset: 2, width: 4, openDirection: 'in-left' },
        { id: 'd-stair-kit', side: 'right', offset: 2, width: 3, openDirection: 'in-right' },
        { id: 'd-stair-suite', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
      ],
      furniture: [],
    });

    // Chef Kitchen & Dining (SE Corner)
    addRoom({
      id: 'kitchen-0',
      name: 'Chef Kitchen & Dining (SE)',
      type: 'kitchen',
      x: colOffsets[2],
      y: row0,
      w: col2,
      h: row1,
      floor: 0,
      windows: [
        { id: 'w-kit-lux-s', side: 'front', offset: col2 / 2 - 2, width: 4 },
        { id: 'w-kit-lux-e', side: 'right', offset: row1 / 2 - 2, width: 4 },
      ],
      doors: [
        { id: 'd-kit-stair', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
      ],
      furniture: [
        { id: 'counter-lux', type: 'kitchen-counter', x: col2 - 2, y: row1 / 2, w: 1.5, h: row1 - 4, rotation: 180 },
        { id: 'dining-lux', type: 'dining-table', x: 4, y: row1 / 2, w: 5, h: 3.5, rotation: 0 },
      ],
    });

    // Ground Suite (SW Corner)
    if (bedroomsCount >= 1) {
      addRoom({
        id: 'bedroom-1-0',
        name: 'Ground Suite (SW)',
        type: 'bedroom',
        x: 0,
        y: row0,
        w: col0,
        h: row1,
        floor: 0,
        windows: [
          { id: 'w-gsuite-w', side: 'left', offset: row1 / 2 - 2, width: 4 },
          { id: 'w-gsuite-s', side: 'front', offset: col0 / 2 - 2, width: 4 },
        ],
        doors: [
          { id: 'd-gsuite-stair', side: 'right', offset: 2, width: 3, openDirection: 'in-left' },
        ],
        furniture: [
          { id: 'bed-lux-g', type: 'bed', x: col0 / 2, y: row1 - 4, w: 6, h: 6.5, rotation: 0 },
          { id: 'wardrobe-lux-g', type: 'wardrobe', x: 1.5, y: 3.5, w: 2, h: 6, rotation: 90 },
        ],
      });
      bedCount++;

      // Suite Attached Bath (NW Corner)
      addRoom({
        id: 'toilet-g-1',
        name: 'Suite Bath',
        type: 'toilet',
        x: 0,
        y: 0,
        w: col0,
        h: row0,
        floor: 0,
        windows: [{ id: 'v-toilet-g', side: 'left', offset: row0 / 2 - 1, width: 2 }],
        doors: [
          { id: 'd-toilet-g-in', side: 'front', offset: col0 - 4, width: 2.5, openDirection: 'in-right' },
        ],
        furniture: [
          { id: 'wc-lux-g', type: 'wc', x: 2, y: row0 - 2, w: 1.5, h: 2, rotation: 0 },
          { id: 'basin-lux-g', type: 'basin', x: col0 - 2, y: 2, w: 2.5, h: 1.5, rotation: 0 },
          { id: 'shower-lux-g', type: 'shower', x: col0 - 2.5, y: row0 - 2.5, w: 3, h: 3, rotation: 0 },
        ],
      });
    }

    // --- FIRST FLOOR ---
    // --- UPPER FLOORS (1 and 2) ---
    for (let f = 1; f < floorsCount; f++) {
      addRoom({
        id: `stair-${f}`,
        name: 'Grand Staircase',
        type: 'staircase',
        x: colOffsets[1],
        y: row0,
        w: col1,
        h: row1,
        floor: f,
        windows: [],
        doors: [
          ...(f === 1 ? [
            { id: 'd-stair1-lounge', side: 'left' as const, offset: 2, width: 3, openDirection: 'in-left' as const },
            { id: 'd-stair1-jnr', side: 'right' as const, offset: 2, width: 3, openDirection: 'in-right' as const }
          ] : [
            { id: `d-stair${f}-pres`, side: 'left' as const, offset: 2, width: 3, openDirection: 'in-left' as const }
          ])
        ],
        furniture: [],
      });

      if (f === 1) {
        // Junior Suite (SE Corner) on Floor 1
        if (bedCount < bedroomsCount) {
          addRoom({
            id: 'bedroom-3-1',
            name: 'Junior Suite (SE)',
            type: 'bedroom',
            x: colOffsets[2],
            y: row0,
            w: col2,
            h: row1,
            floor: 1,
            windows: [
              { id: 'w-jnr-s', side: 'front', offset: col2 / 2 - 2, width: 4 },
              { id: 'w-jnr-e', side: 'right', offset: row1 / 2 - 2, width: 4 },
            ],
            doors: [
              { id: 'd-jnr-stair', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-jnr', type: 'bed', x: col2 / 2, y: row1 - 4, w: 6, h: 6, rotation: 0 },
            ],
          });
          bedCount++;
        }

        // Home Theater / Bed 4 (NE Corner) on Floor 1
        if (bedCount < bedroomsCount) {
          addRoom({
            id: 'bedroom-4-1',
            name: 'Home Theater / Bed 4 (NE)',
            type: 'bedroom',
            x: colOffsets[2],
            y: 0,
            w: col2,
            h: row0,
            floor: 1,
            windows: [
              { id: 'w-theater-n', side: 'back', offset: col2 / 2 - 2, width: 4 },
              { id: 'w-theater-e', side: 'right', offset: row0 / 2 - 2, width: 4 },
            ],
            doors: [
              { id: 'd-theater-stair', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-theater', type: 'bed', x: col2 / 2, y: 4, w: 5, h: 6, rotation: 180 },
            ],
          });
          bedCount++;
        }

        // SW area: If floorsCount === 2, place Presidential Suite here.
        // Otherwise, place a Grand Lounge.
        if (floorsCount === 2) {
          if (bedCount < bedroomsCount) {
            const presW = col0 + col1;
            addRoom({
              id: 'bedroom-master-1',
              name: 'Owner Presidential Suite (SW/Center)',
              type: 'bedroom',
              x: 0,
              y: row0,
              w: presW,
              h: row1,
              floor: 1,
              windows: [{ id: 'w-pres-f', side: 'front', offset: presW / 2 - 3, width: 8 }],
              doors: [
                { id: 'd-pres-stair', side: 'right', offset: 2, width: 3, openDirection: 'in-right' },
                { id: 'd-pres-bath', side: 'back', offset: 2, width: 2.5, openDirection: 'in-left' },
              ],
              furniture: [
                { id: 'bed-pres', type: 'bed', x: presW / 2, y: row1 - 4, w: 7, h: 7, rotation: 0 },
              ],
            });
            bedCount++;

            addRoom({
              id: 'toilet-master-1',
              name: 'Presidential Bath',
              type: 'toilet',
              x: 0,
              y: 0,
              w: col0,
              h: row0,
              floor: 1,
              windows: [{ id: 'v-toilet-pres', side: 'left', offset: row0 / 2 - 1, width: 2 }],
              doors: [
                { id: 'd-toilet-pres-in', side: 'front', offset: 2, width: 2.5, openDirection: 'in-right' },
              ],
              furniture: [
                { id: 'wc-pres', type: 'wc', x: 2, y: row0 - 2, w: 1.5, h: 2, rotation: 0 },
                { id: 'basin-pres', type: 'basin', x: col0 - 2, y: 2, w: 2.5, h: 1.5, rotation: 0 },
                { id: 'shower-pres', type: 'shower', x: col0 - 2.5, y: row0 - 2.5, w: 3.5, h: 3.5, rotation: 0 },
              ],
            });
          }
        } else {
          // Grand Lounge on Floor 1 for 3-floor building
          const loungeW = col0 + col1;
          addRoom({
            id: 'lounge-1',
            name: 'Mezzanine Grand Lounge',
            type: 'lobby',
            x: 0,
            y: row0,
            w: loungeW,
            h: row1,
            floor: 1,
            windows: [{ id: 'w-lounge1-f', side: 'front', offset: loungeW / 2 - 3, width: 8 }],
            doors: [{ id: 'd-lounge1-stair', side: 'right', offset: 2, width: 3, openDirection: 'in-right' }],
            furniture: [
              { id: 'sofa-lounge1', type: 'sofa', x: loungeW / 2, y: row1 / 2, w: 8, h: 3, rotation: 0 },
            ],
          });
        }
      }

      if (f === 2) {
        // Owner Presidential Suite on Floor 2
        if (bedCount < bedroomsCount) {
          const presW = col0 + col1;
          addRoom({
            id: 'bedroom-master-2',
            name: 'Owner Presidential Suite (SW/Center)',
            type: 'bedroom',
            x: 0,
            y: row0,
            w: presW,
            h: row1,
            floor: 2,
            windows: [{ id: 'w-pres-f2', side: 'front', offset: presW / 2 - 3, width: 8 }],
            doors: [
              { id: 'd-pres-stair2', side: 'right', offset: 2, width: 3, openDirection: 'in-right' },
              { id: 'd-pres-bath2', side: 'back', offset: 2, width: 2.5, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-pres2', type: 'bed', x: presW / 2, y: row1 - 4, w: 7, h: 7, rotation: 0 },
            ],
          });
          bedCount++;

          addRoom({
            id: 'toilet-master-2',
            name: 'Presidential Bath',
            type: 'toilet',
            x: 0,
            y: 0,
            w: col0,
            h: row0,
            floor: 2,
            windows: [{ id: 'v-toilet-pres2', side: 'left', offset: row0 / 2 - 1, width: 2 }],
            doors: [
              { id: 'd-toilet-pres-in2', side: 'front', offset: 2, width: 2.5, openDirection: 'in-right' },
            ],
            furniture: [
              { id: 'wc-pres2', type: 'wc', x: 2, y: row0 - 2, w: 1.5, h: 2, rotation: 0 },
              { id: 'basin-pres2', type: 'basin', x: col0 - 2, y: 2, w: 2.5, h: 1.5, rotation: 0 },
              { id: 'shower-pres2', type: 'shower', x: col0 - 2.5, y: row0 - 2.5, w: 3.5, h: 3.5, rotation: 0 },
            ],
          });
        }

        // Penthouse Gym / Deck (SE Corner)
        addRoom({
          id: 'gym-2',
          name: 'Penthouse Wellness Gym',
          type: 'lobby',
          x: colOffsets[2],
          y: row0,
          w: col2,
          h: row1,
          floor: 2,
          windows: [{ id: 'w-gym2-e', side: 'right', offset: row1 / 2 - 1.5, width: 3 }],
          doors: [{ id: 'd-gym2-stair', side: 'left', offset: 2, width: 3, openDirection: 'in-left' }],
          furniture: [
            { id: 'treadmill-1', type: 'gym-treadmill', x: col2 / 2, y: row1 / 2, w: 3, h: 6, rotation: 0 },
          ],
        });
      }
    }

  } else {
    // --- OPEN SPACE PLAN ---
    const openW = col1 + col2;
    // Great Room (Living/Dining/Kitchen)
    addRoom({
      id: 'living-0',
      name: 'The Great Room (Living/Kitchen/Dining)',
      type: 'living',
      x: colOffsets[1],
      y: 0,
      w: openW,
      h: buildH,
      floor: 0,
      windows: [
        { id: 'w-open-rear', side: 'back', offset: openW / 2 - 2, width: 6 },
        { id: 'w-open-front', side: 'front', offset: openW / 2 - 2, width: 6 },
      ],
      doors: [
        { id: 'd-open-main', side: 'right', offset: buildH / 2 - 2, width: 4.5, openDirection: 'in-right' }, // Main entry
        { id: 'd-open-guest', side: 'left', offset: row0 + 2, width: 3, openDirection: 'in-left' }, // To guest bed
        { id: 'd-open-toilet', side: 'left', offset: 2, width: 2.5, openDirection: 'in-left' }, // To common toilet
      ],
      furniture: [
        { id: 'sofa-open', type: 'sofa', x: openW / 2, y: buildH - 5, w: 8, h: 3, rotation: 0 },
        { id: 'coffee-open', type: 'coffee-table', x: openW / 2, y: buildH - 8, w: 3, h: 2, rotation: 0 },
        { id: 'dining-open', type: 'dining-table', x: openW / 2, y: buildH / 2, w: 5, h: 3, rotation: 0 },
        { id: 'counter-open', type: 'kitchen-counter', x: openW - 2, y: 5, w: 2, h: 8, rotation: 90 },
      ],
    });

    // Floating Stairs (Inside Great Room)
    addRoom({
      id: 'stair-0',
      name: 'Floating Stairs',
      type: 'staircase',
      x: colOffsets[1] + 2,
      y: buildH / 2 - 6,
      w: 8,
      h: 12,
      floor: 0,
      windows: [],
      doors: [],
      furniture: [],
    });

    // Guest Room (SW Corner)
    if (bedroomsCount >= 1) {
      addRoom({
        id: 'bedroom-1-0',
        name: 'Guest Room (SW)',
        type: 'bedroom',
        x: 0,
        y: row0,
        w: col0,
        h: row1,
        floor: 0,
        windows: [
          { id: 'w-guest-w', side: 'left', offset: row1 / 2 - 2, width: 4 },
          { id: 'w-guest-s', side: 'front', offset: col0 / 2 - 2, width: 4 },
        ],
        doors: [
          { id: 'd-guest-open', side: 'right', offset: 2, width: 3, openDirection: 'in-left' },
        ],
        furniture: [
          { id: 'bed-open-g', type: 'bed', x: col0 / 2, y: row1 - 4, w: 5, h: 6, rotation: 0 },
          { id: 'wardrobe-open-g', type: 'wardrobe', x: 1.5, y: 3, w: 2, h: 5, rotation: 90 },
        ],
      });
      bedCount++;
    }

    // Common Toilet (NW Corner)
    addRoom({
      id: 'toilet-com-0',
      name: 'Common Toilet',
      type: 'toilet',
      x: 0,
      y: 0,
      w: col0,
      h: row0,
      floor: 0,
      windows: [{ id: 'v-toilet-open', side: 'left', offset: row0 / 2 - 1, width: 2 }],
      doors: [
        { id: 'd-toilet-open-in', side: 'right', offset: 2, width: 2.5, openDirection: 'in-left' },
      ],
      furniture: [
        { id: 'wc-open-g', type: 'wc', x: 2, y: row0 - 2, w: 1.5, h: 2, rotation: 0 },
        { id: 'basin-open-g', type: 'basin', x: col0 - 2, y: 2, w: 2, h: 1.5, rotation: 0 },
        { id: 'shower-open-g', type: 'shower', x: col0 - 2, y: row0 - 2, w: 3, h: 3, rotation: 0 },
      ],
    });

    // --- FIRST FLOOR ---
    // --- UPPER FLOORS (1 and 2) ---
    for (let f = 1; f < floorsCount; f++) {
      addRoom({
        id: `stair-${f}`,
        name: 'Floating Stairs',
        type: 'staircase',
        x: colOffsets[1] + 2,
        y: buildH / 2 - 6,
        w: 8,
        h: 12,
        floor: f,
        windows: [],
        doors: [],
        furniture: [],
      });

      if (f === 1) {
        // Guest Room 2 (NE) on Floor 1
        if (bedCount < bedroomsCount) {
          addRoom({
            id: 'bedroom-3-1',
            name: 'Guest Room 2 (NE)',
            type: 'bedroom',
            x: colOffsets[2],
            y: 0,
            w: col2,
            h: row0,
            floor: 1,
            windows: [
              { id: 'w-oguest2-n', side: 'back', offset: col2 / 2 - 2, width: 4 },
              { id: 'w-oguest2-e', side: 'right', offset: row0 / 2 - 2, width: 4 },
            ],
            doors: [
              { id: 'd-oguest2-lounge', side: 'left', offset: 2, width: 3, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-oguest2', type: 'bed', x: col2 / 2, y: 4, w: 5, h: 6, rotation: 180 },
            ],
          });
          bedCount++;
        }

        // Panoramic Glass Lounge (Center + SE) on Floor 1
        const loungeW = col1 + col2;
        addRoom({
          id: 'lounge-1',
          name: 'Panoramic Glass Lounge',
          type: 'lobby',
          x: colOffsets[1],
          y: row0,
          w: loungeW,
          h: row1,
          floor: 1,
          windows: [{ id: 'w-lounge-glass', side: 'front', offset: loungeW / 2 - 4, width: 10 }],
          doors: [{ id: 'd-lounge-balc', side: 'front', offset: 2, width: 3, openDirection: 'out-left' }],
          furniture: [
            { id: 'sofa-lounge-open', type: 'sofa', x: loungeW / 2, y: row1 / 2, w: 8, h: 3, rotation: 0 },
          ],
        });

        // SW area: If floorsCount === 2, place Master Suite here.
        if (floorsCount === 2) {
          if (bedCount < bedroomsCount) {
            addRoom({
              id: 'bedroom-master-1',
              name: 'Master Suite (SW)',
              type: 'bedroom',
              x: 0,
              y: row0,
              w: col0,
              h: row1,
              floor: 1,
              windows: [
                { id: 'w-omast-w', side: 'left', offset: row1 / 2 - 2, width: 4 },
                { id: 'w-omast-s', side: 'front', offset: col0 / 2 - 2, width: 4 },
              ],
              doors: [
                { id: 'd-omast-lounge', side: 'right', offset: 2, width: 3, openDirection: 'in-left' },
              ],
              furniture: [
                { id: 'bed-omast', type: 'bed', x: col0 / 2, y: row1 - 4, w: 6, h: 6.5, rotation: 0 },
                { id: 'wardrobe-omast', type: 'wardrobe', x: 1.5, y: 3.5, w: 2, h: 6, rotation: 90 },
              ],
            });
            bedCount++;

            addRoom({
              id: 'toilet-master-1',
              name: 'Master Bath (NW)',
              type: 'toilet',
              x: 0,
              y: 0,
              w: col0,
              h: row0,
              floor: 1,
              windows: [{ id: 'v-toilet-omast', side: 'left', offset: row0 / 2 - 1, width: 2 }],
              doors: [
                { id: 'd-toilet-omast-in', side: 'front', offset: 2, width: 2.5, openDirection: 'in-right' },
              ],
              furniture: [
                { id: 'wc-omast', type: 'wc', x: 2, y: row0 - 2, w: 1.5, h: 2, rotation: 0 },
                { id: 'basin-omast', type: 'basin', x: col0 - 2, y: 2, w: 2.5, h: 1.5, rotation: 0 },
                { id: 'shower-omast', type: 'shower', x: col0 - 2.5, y: row0 - 2.5, w: 3, h: 3, rotation: 0 },
              ],
            });
          }
        }
      }

      if (f === 2) {
        // Master Suite on Floor 2
        if (bedCount < bedroomsCount) {
          addRoom({
            id: 'bedroom-master-2',
            name: 'Master Suite (SW)',
            type: 'bedroom',
            x: 0,
            y: row0,
            w: col0,
            h: row1,
            floor: 2,
            windows: [
              { id: 'w-omast-w2', side: 'left', offset: row1 / 2 - 2, width: 4 },
              { id: 'w-omast-s2', side: 'front', offset: col0 / 2 - 2, width: 4 },
            ],
            doors: [
              { id: 'd-omast-lounge2', side: 'right', offset: 2, width: 3, openDirection: 'in-left' },
            ],
            furniture: [
              { id: 'bed-omast2', type: 'bed', x: col0 / 2, y: row1 - 4, w: 6, h: 6.5, rotation: 0 },
              { id: 'wardrobe-omast2', type: 'wardrobe', x: 1.5, y: 3.5, w: 2, h: 6, rotation: 90 },
            ],
          });
          bedCount++;

          addRoom({
            id: 'toilet-master-2',
            name: 'Master Bath (NW)',
            type: 'toilet',
            x: 0,
            y: 0,
            w: col0,
            h: row0,
            floor: 2,
            windows: [{ id: 'v-toilet-omast2', side: 'left', offset: row0 / 2 - 1, width: 2 }],
            doors: [
              { id: 'd-toilet-omast-in2', side: 'front', offset: 2, width: 2.5, openDirection: 'in-right' },
            ],
            furniture: [
              { id: 'wc-omast2', type: 'wc', x: 2, y: row0 - 2, w: 1.5, h: 2, rotation: 0 },
              { id: 'basin-omast2', type: 'basin', x: col0 - 2, y: 2, w: 2.5, h: 1.5, rotation: 0 },
              { id: 'shower-omast2', type: 'shower', x: col0 - 2.5, y: row0 - 2.5, w: 3, h: 3, rotation: 0 },
            ],
          });
        }

        // Penthouse Studio Deck (Center + SE) on Floor 2
        const loungeW2 = col1 + col2;
        addRoom({
          id: 'lounge-2',
          name: 'Penthouse Lounge Deck',
          type: 'lobby',
          x: colOffsets[1],
          y: row0,
          w: loungeW2,
          h: row1,
          floor: 2,
          windows: [{ id: 'w-lounge-glass2', side: 'front', offset: loungeW2 / 2 - 4, width: 10 }],
          doors: [{ id: 'd-lounge-balc2', side: 'front', offset: 2, width: 3, openDirection: 'out-left' }],
          furniture: [
            { id: 'sofa-lounge-open2', type: 'sofa', x: loungeW2 / 2, y: row1 / 2, w: 8, h: 3, rotation: 0 },
          ],
        });
      }
    }
  }

  // Inject balcony flag
  if (settings.balconyRequired && floorsCount >= 2 && !rooms.some(r => r.id === 'balcony-1')) {
    rooms.push({
      id: 'balcony-1',
      name: 'North-East Balcony Deck',
      type: 'balcony',
      x: buildW - Math.round(buildW * 0.45),
      y: buildH,
      w: Math.round(buildW * 0.45),
      h: 7,
      floor: 1,
      windows: [],
      doors: [],
      furniture: [],
    });
  }

  // 3. APPLY CUSTOM OVERRIDES (Dynamic edits from chatbot or user manual input)
  if (settings.customOverrides && settings.customOverrides.length > 0) {
    settings.customOverrides.forEach(ovr => {
      // Find room in layouts
      const matchingRooms = rooms.filter(r => r.id.startsWith(ovr.roomId));
      
      matchingRooms.forEach(room => {
        if (ovr.type === 'add-door') {
          room.doors.push({
            id: `d-override-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            side: ovr.side || 'right',
            offset: ovr.offset || 2,
            width: ovr.width || 3,
            openDirection: 'in-left'
          });
        } else if (ovr.type === 'add-window') {
          room.windows.push({
            id: `w-override-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            side: ovr.side || 'front',
            offset: ovr.offset || 2,
            width: ovr.width || 4
          });
        } else if (ovr.type === 'resize-room') {
          if (ovr.width) room.w = ovr.width;
          if (ovr.offset) room.h = ovr.offset; // using offset parameter as height
        } else if (ovr.type === 'rename-room' && ovr.targetRoomId) {
          room.name = ovr.targetRoomId;
        }
      });
    });
  }

  return rooms;
}
