import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { requirements, type } = await request.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key not configured' }, { status: 500 });
    }

    let prompt = '';

    if (type === 'analyze') {
      prompt = `You are a senior Indian residential architect with 20+ years of experience designing homes for Indian families. Analyze these project requirements thoroughly and provide expert guidance.

Requirements: ${JSON.stringify(requirements)}

Consider:
- Vastu shastra principles for Indian homes
- Local climate and ventilation needs
- Functional spaces for Indian family lifestyles (prayer room, large kitchen, guest room)
- Plot efficiency and setback norms
- Natural light optimization

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "parsedRequirements": {
    "bedrooms": <number>,
    "bathrooms": <number>,
    "totalFloors": <number>,
    "builtUpArea": <estimated sq ft>,
    "plotCoverage": "<percentage>%",
    "style": "<style>",
    "specialFeatures": "<comma-separated list>"
  },
  "validationNotes": [
    "<specific, actionable design note>"
  ],
  "designIntent": "<2-3 sentence design philosophy capturing the spirit of this home>",
  "keyConsiderations": [
    "<important architectural consideration specific to this project>"
  ]
}`;

    } else if (type === 'interior') {
      const budgetLevel = requirements.budget < 50 ? 'economy' : requirements.budget < 150 ? 'standard' : 'premium';
      prompt = `You are an award-winning interior designer specializing in Indian residential spaces. Create detailed, practical interior design concepts for this ${requirements.style} home.

Project details:
- Architectural style: ${requirements.style}
- Budget: ₹${requirements.budget} lakhs (${budgetLevel} finish level)
- BHK: ${requirements.bhk}
- Location: ${requirements.location}

For each room, provide specific material brands, colors with hex codes, and furniture brands available in India.

Return ONLY valid JSON (no markdown):
{
  "concepts": [
    {
      "room": "Living Room",
      "concept": "<vivid 2-3 sentence description of the design vision>",
      "materials": ["<specific material with finish e.g. 'Kajaria 800x800mm vitrified tile in Bianco White'>"],
      "colorPalette": ["#hexcode"],
      "furniturePlan": "<specific furniture layout with brands e.g. 'Urban Ladder 3-seater sofa facing 65-inch wall TV unit'>",
      "lightingConcept": "<specific lighting plan with types and brands>"
    }
  ]
}
Include all of: Living Room, Master Bedroom, Kitchen, Dining Room, Master Bathroom, Balcony/Study`;

    } else if (type === 'compliance') {
      prompt = `You are an expert in Indian municipal building regulations and local development authority rules. Provide accurate compliance guidance for this project.

Location: ${requirements.location}
Plot: ${requirements.plotWidth}×${requirements.plotDepth}ft (${requirements.plotSize} sq yards)
Floors: ${requirements.floors}
Style: ${requirements.style}

Research typical setback, FSI, height, and parking rules for ${requirements.location}. Be specific to the city/town if known.

Return ONLY valid JSON (no markdown):
{
  "setbacks": {
    "front": "<ft>",
    "rear": "<ft>",
    "leftSide": "<ft>",
    "rightSide": "<ft>"
  },
  "fsi": {
    "permissible": "<ratio>",
    "proposed": "<ratio>",
    "status": "<within limits / exceeds>"
  },
  "height": {
    "permissible": "<meters or ft>",
    "proposed": "<meters>"
  },
  "parking": "<requirement>",
  "approvalChecklist": ["<specific approval item>"],
  "warningNotes": ["<specific warning for this location/project>"]
}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
