'use client';
import ModuleProjectDashboard from '@/components/ModuleProjectDashboard';
import type { DrawingGroup } from '@/components/ModuleDashboard';

const groups: DrawingGroup[] = [
  { discipline: 'Architectural', icon: '📐', sheets: ['Master Site Plan', 'Commercial Floor Plans', 'Residential Floor Plans', 'Parking Layout', 'Lift & Stair Core Layout', 'Service Core Layout', 'Terrace Layout', 'Elevations', 'Sections', 'Door / Window Schedule'] },
  { discipline: 'Structural', icon: '🏗', sheets: ['Combined Column Grid', 'Foundation Layout', 'Beam Layout', 'Slab Layout', 'Shear Wall Layout', 'Lift Core Structural'] },
  { discipline: 'Plumbing', icon: '🚰', sheets: ['Commercial Plumbing Layout', 'Residential Plumbing Layout', 'Common Shaft Layout', 'Sewer Layout', 'STP Layout', 'Water Tank Layout'] },
  { discipline: 'Electrical', icon: '⚡', sheets: ['Commercial Electrical', 'Residential Electrical', 'Common Area Electrical', 'Generator Layout', 'Single Line Diagram'] },
  { discipline: 'HVAC & Fire', icon: '🌬', sheets: ['Commercial HVAC', 'Residential HVAC', 'Ventilation Layout', 'Fire Fighting Layout', 'Hydrant Layout', 'Emergency Exit Layout'] },
];
const reports = ['FAR / FSI Report', 'Mixed-Use Compliance', 'Parking Compliance', 'Fire Compliance', 'Structural Safety', 'Cost Estimate', 'BOQ'];

export default function MixedUseDashboardPage() {
  return <ModuleProjectDashboard buildingType="mixed-use" title="Apartment + Commercial — Mixed Use" accent="#0d9488" newHref="/mixed-use/new" workspaceBase="/mixed-use" examples={['Shops + Apartments', 'Offices + Residences']} groups={groups} reports={reports} />;
}
