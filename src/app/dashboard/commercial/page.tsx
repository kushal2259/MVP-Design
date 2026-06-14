'use client';
import ModuleProjectDashboard from '@/components/ModuleProjectDashboard';
import type { DrawingGroup } from '@/components/ModuleDashboard';

const groups: DrawingGroup[] = [
  { discipline: 'Architectural', icon: '📐', sheets: ['Master Site Plan', 'Commercial Floor Plans', 'Shop / Office Layout', 'Food Court Layout', 'Service Area Layout', 'Roof Plan', 'Elevations', 'Sections', 'Parking Layout', 'Door / Window Schedule'] },
  { discipline: 'Structural', icon: '🏗', sheets: ['Column Grid Layout', 'Foundation Layout', 'Beam Layout', 'Slab Layout', 'Structural Sections', 'Steel Structure Drawings'] },
  { discipline: 'Plumbing', icon: '🚰', sheets: ['Water Supply Layout', 'Drainage Layout', 'Sewer Layout', 'STP Layout', 'Water Tank Layout', 'Rainwater Harvesting'] },
  { discipline: 'Electrical', icon: '⚡', sheets: ['Lighting Layout', 'Power Layout', 'Data & CCTV Layout', 'DB Layout', 'Single Line Diagram', 'Earthing Layout'] },
  { discipline: 'HVAC & Fire', icon: '🌬', sheets: ['HVAC Layout', 'Duct Layout', 'Chiller / AHU Layout', 'Smoke Extraction', 'Sprinkler Layout', 'Fire Alarm Layout', 'Evacuation Plan'] },
  { discipline: 'Vertical Transport', icon: '🛗', sheets: ['Lift Layout', 'Escalator Layout', 'Service Lift Layout', 'Staircase Layout'] },
];
const reports = ['FAR / FSI Report', 'Occupancy Load Report', 'Fire Compliance', 'Structural Safety', 'Energy Efficiency', 'Cost Estimate', 'BOQ'];

export default function CommercialDashboardPage() {
  return <ModuleProjectDashboard buildingType="commercial" title="Commercial Buildings" accent="#c2410c" newHref="/commercial/new" workspaceBase="/commercial" examples={['Office', 'Mall', 'Hotel', 'Hospital', 'School']} groups={groups} reports={reports} />;
}
