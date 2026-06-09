import { parseChatEditWithGemini, DEFAULT_PLOT } from '../src/lib/layoutSolver';

const KEY = process.env.GKEY || '';

const tasks = [
  'hi',                                             // greeting guard
  'make it a 3 BHK',                                // bedrooms
  'change the style to luxury',                     // style
  'increase the plot to 60x50',                     // dimensions
  'make the kitchen compact',                       // kitchenStyle
  'remove the balcony',                             // balconyRequired
  'add a door from the living room to the kitchen', // customOverride (geometry intent)
  'set the location to Pune and budget 90 lakhs',   // location+budget
  'make it vastu compliant 4 bhk villa',            // multi
  'asdfghjkl random gibberish',                     // nonsense robustness
];

(async () => {
  let settings = { ...DEFAULT_PLOT };
  for (const t of tasks) {
    try {
      const res = await parseChatEditWithGemini(t, settings, KEY);
      const s = res.updatedSettings;
      console.log(`\nTASK: "${t}"`);
      console.log(`  msg: ${res.message?.slice(0, 90)}`);
      console.log(`  -> bhk=${s.bedrooms} floors=${s.floors} ${s.width}x${s.depth} style=${s.style} kitchen=${s.kitchenStyle} balcony=${s.balconyRequired} loc=${s.location} budget=${s.budgetLakhs} overrides=${(s.customOverrides || []).length}`);
      settings = s; // chain edits
      await new Promise(r => setTimeout(r, 1500)); // space out calls (real usage)
    } catch (e) {
      console.log(`\nTASK: "${t}"  ERROR: ${e}`);
    }
  }
})();
