'use client';
import ModuleProjectDashboard from '@/components/ModuleProjectDashboard';
import type { DrawingGroup } from '@/components/ModuleDashboard';

const groups: DrawingGroup[] = [
  { discipline: 'Architectural', icon: '📐', sheets: ['Master Site Plan', 'Typical Floor Plan', 'Ground Floor Plan', 'Unit Layout Plans', 'Terrace Plan', 'Elevations', 'Building Sections', 'Lobby & Corridor Layout', 'Refuge Area Plan', 'Door / Window Schedule', 'Unit Mix Plan', 'Parking Layout'] },
  { discipline: 'Structural', icon: '🏗', sheets: ['Column Grid Layout', 'Foundation Plan', 'Beam Layout', 'Slab Layout', 'Shear Wall Layout', 'Lift Core Structural Layout', 'Structural Sections'] },
  { discipline: 'Plumbing', icon: '🚰', sheets: ['Water Supply Layout', 'Drainage Layout', 'Plumbing Shaft Layout', 'Overhead & UG Tank Layout', 'STP Layout', 'Rainwater Harvesting'] },
  { discipline: 'Electrical', icon: '⚡', sheets: ['Lighting Layout', 'Power Layout', 'DB Layout', 'Single Line Diagram', 'Earthing Layout', 'Solar Layout'] },
  { discipline: 'HVAC & Fire', icon: '🌬', sheets: ['Ventilation Layout', 'Duct Layout', 'Fire Fighting Layout', 'Sprinkler Layout', 'Fire Alarm Layout', 'Fire Escape Layout'] },
];
const reports = ['FAR / FSI Report', 'NBC Compliance Report', 'Parking Compliance', 'Fire Compliance', 'Structural Safety', 'Cost Estimate', 'BOQ'];

export default function ApartmentDashboardPage() {
  return <ModuleProjectDashboard buildingType="apartment" title="Apartment — Residential Buildings" accent="#7c3aed" newHref="/apartment/new" workspaceBase="/apartment" examples={['G+4', 'G+10', 'High-rise Tower']} groups={groups} reports={reports} />;
}
