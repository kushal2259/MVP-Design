'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getProject, saveProject } from '@/lib/store';
import {
  generateFloorPlans, calculateSpaceAllocation,
  generateCostEstimate, generateBOQ, generateTimeline
} from '@/lib/generator';
import { generateLayouts } from '@/lib/layoutSolver';
import { analyzeVastu, DIRECTION_NAMES } from '@/lib/vastuEngine';
import { analyzeByelaws } from '@/lib/byelawEngine';
import { generateDetailedBOQ, calcEMI, formatINR, boqToCSV, type Tier } from '@/lib/costEngine';
import { analyzeSunVent } from '@/lib/sunPathEngine';
import { generateElevation, type ElevSide } from '@/lib/elevationGenerator';
import { useIsMobile } from '@/lib/useIsMobile';
import type { Project, ActiveTab, FloorPlan, PlotSettings, LayoutOption } from '@/types';
import dynamic from 'next/dynamic';

const FloorPlanRenderer = dynamic(() => import('@/components/FloorPlanRenderer'), { ssr: false });
const FloorPlanV2Renderer = dynamic(() => import('@/components/FloorPlanV2Renderer'), { ssr: false });
const CopilotChat = dynamic(() => import('@/components/CopilotChat'), { ssr: false });
const ElevationRenderer = dynamic(() => import('@/components/ElevationRenderer'), { ssr: false });
const MEPRenderer = dynamic(() => import('@/components/MEPRenderer'), { ssr: false });
const CADEditor = dynamic(() => import('@/components/CADEditor'), { ssr: false });
const DrawingViewport = dynamic(() => import('@/components/DrawingViewport'), { ssr: false });
const ThreeDViewer = dynamic(() => import('@/components/ThreeDViewer'), { ssr: false });
const ThreeDViewerV2 = dynamic(() => import('@/components/ThreeDViewerV2'), { ssr: false });
const InteriorProductsCatalog = dynamic(() => import('@/components/InteriorProductsCatalog'), { ssr: false });
const InteriorRenderView = dynamic(() => import('@/components/InteriorRenderView'), { ssr: false });
const DrawingCatalogView = dynamic(() => import('@/components/DrawingCatalogView'), { ssr: false });
const SiteVisitsTab = dynamic(() => import('@/components/SiteVisitsTab'), { ssr: false });

const TABS: { id: ActiveTab; label: string; icon: string; group?: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'floor-plans', label: 'Floor Plans', icon: '◱', group: 'Design' },
  { id: 'cad-editor', label: 'CAD Editor', icon: '✎', group: 'Design' },
  { id: '3d-view', label: '3D View', icon: '◈', group: 'Design' },
  { id: 'elevations', label: 'Elevations', icon: '⬡', group: 'Design' },
  { id: 'interior', label: 'Interior', icon: '🛋', group: 'Design' },
  { id: 'vastu', label: 'Vastu Score', icon: '🕉', group: 'India Analysis' },
  { id: 'sun-vent', label: 'Sun & Ventilation', icon: '☀', group: 'India Analysis' },
  { id: 'structural', label: 'Structural', icon: '◐', group: 'Engineering' },
  { id: 'electrical', label: 'Electrical', icon: '⚡', group: 'Engineering' },
  { id: 'plumbing', label: 'Plumbing', icon: '◉', group: 'Engineering' },
  { id: 'hvac', label: 'HVAC', icon: '❄', group: 'Engineering' },
  { id: 'fire', label: 'Fire Safety', icon: '🜂', group: 'Engineering' },
  { id: 'site', label: 'Site Plans', icon: '⊡', group: 'Engineering' },
  { id: 'cost', label: 'Cost Est.', icon: '₹', group: 'Estimates' },
  { id: 'boq', label: 'BOQ', icon: '≡', group: 'Estimates' },
  { id: 'timeline', label: 'Timeline', icon: '▷', group: 'Estimates' },
  { id: 'site-visits', label: 'Site Visits', icon: '◷', group: 'Admin' },
  { id: 'compliance', label: 'Compliance', icon: '✓' },
  { id: 'export', label: 'Export', icon: '↗' },
];

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [analysisData, setAnalysisData] = useState<Record<string, unknown> | null>(null);
  const [interiorData, setInteriorData] = useState<{ concepts: unknown[] } | null>(null);
  const [complianceData, setComplianceData] = useState<Record<string, unknown> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [editedFloorPlans, setEditedFloorPlans] = useState<FloorPlan[] | null>(null);
  const [layoutOptions, setLayoutOptions] = useState<LayoutOption[] | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<'option-a' | 'option-b' | 'option-c'>('option-a');
  const [geminiKey, setGeminiKey] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    (async () => {
      const p = await getProject(id);
      if (p) {
        setProject(p);
        if (p.layoutOptions) {
          setLayoutOptions(p.layoutOptions);
          setSelectedLayoutId(p.selectedLayoutId || 'option-a');
        }
      }
      const key = localStorage.getItem('ARCH_COPILOT_GEMINI_KEY') || '';
      setGeminiKey(key);
      setMounted(true);
    })();
  }, [id]);

  const generateDesign = async () => {
    if (!project) return;
    setGenerating(true);

    try {
      // Step 1: AI analysis
      setGenStep('Analyzing requirements with AI...');
      const analysisRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements: project.requirements, type: 'analyze' }),
      });
      const analysisJson = await analysisRes.json();
      if (analysisJson.success) setAnalysisData(analysisJson.data);

      // Step 2: Generate floor plans (both new Vastu layouts + legacy)
      setGenStep('Generating Vastu-compliant floor plan options...');
      await new Promise(r => setTimeout(r, 800));

      const plotSettings: PlotSettings = {
        width: project.requirements.plotWidth,
        depth: project.requirements.plotDepth,
        location: project.requirements.location,
        floors: project.requirements.floors,
        style: (['modern', 'contemporary', 'traditional', 'luxury'].includes(project.requirements.style)
          ? project.requirements.style : 'modern') as PlotSettings['style'],
        budgetLakhs: project.requirements.budget,
        bedrooms: project.requirements.bhk,
        kitchenStyle: project.requirements.specialRooms.includes('Home Office') ? 'compact' : 'large',
        balconyRequired: true,
      };

      const layouts = generateLayouts(plotSettings);
      setLayoutOptions(layouts);

      const floorPlans = generateFloorPlans(project.requirements);
      const spaceAllocation = calculateSpaceAllocation(floorPlans);

      // Step 3: Cost & BOQ
      setGenStep('Calculating cost estimates...');
      await new Promise(r => setTimeout(r, 600));
      const costResult = generateCostEstimate(project.requirements, floorPlans);
      const boq = generateBOQ(costResult.builtUp);
      const timeline = generateTimeline(project.requirements.floors);

      // Step 4: Interior concepts
      setGenStep('Generating interior design concepts...');
      const interiorRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements: project.requirements, type: 'interior' }),
      });
      const interiorJson = await interiorRes.json();
      if (interiorJson.success) setInteriorData(interiorJson.data);

      // Step 5: Compliance
      setGenStep('Checking compliance...');
      const complianceRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirements: project.requirements, type: 'compliance' }),
      });
      const complianceJson = await complianceRes.json();
      if (complianceJson.success) setComplianceData(complianceJson.data);

      // Save everything
      const updated: Project = {
        ...project,
        status: 'generated',
        floorPlans,
        layoutOptions: layouts,
        selectedLayoutId: 'option-a',
        plotSettings,
        costEstimate: costResult,
        boq,
        timeline,
        analysis: {
          parsedRequirements: analysisJson.data?.parsedRequirements || {},
          validationNotes: analysisJson.data?.validationNotes || [],
          spaceAllocation,
        },
      };
      await saveProject(updated);
      setProject(updated);
      setGenStep('');
      setActiveTab('overview');
    } catch (err) {
      console.error(err);
      setGenStep('Error during generation. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (!mounted) return null;
  if (!project) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}>
      <div>Project not found. <Link href="/dashboard">← Dashboard</Link></div>
    </div>
  );

  const isGenerated = project.status === 'generated' || project.status === 'reviewing';
  const req = project.requirements;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <div style={{
        height: 56, borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center',
        padding: isMobile ? '0 14px' : '0 24px', gap: isMobile ? 10 : 16,
        backgroundColor: 'white',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link href="/dashboard" style={{ color: 'var(--steel)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Dashboard
        </Link>
        <span style={{ color: 'var(--line-strong)' }}>/</span>
        <h1 style={{ fontSize: 15, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</h1>
        <div style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 100,
          backgroundColor: isGenerated ? '#f0fdf4' : '#fff7ed',
          color: isGenerated ? '#16a34a' : '#c8853a',
          fontSize: 11, fontWeight: 500,
        }}>
          {isGenerated ? 'Generated' : project.status.charAt(0).toUpperCase() + project.status.slice(1)}
        </div>
        {isGenerated && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isMobile && (
              <>
                <input
                  type="text"
                  placeholder="Gemini API key (optional — for AI chat)"
                  value={geminiKey}
                  title={geminiKey ? 'AI features enabled' : 'Optional: add a Gemini API key to enable the AI Copilot chat and smarter analysis. Plans generate fine without it.'}
                  onChange={e => {
                    setGeminiKey(e.target.value);
                    localStorage.setItem('ARCH_COPILOT_GEMINI_KEY', e.target.value);
                  }}
                  style={{
                    padding: '5px 10px', borderRadius: 4,
                    border: `1.5px solid ${geminiKey ? '#16a34a' : 'var(--line-strong)'}`,
                    fontSize: 12, width: 220,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--steel)',
                  }}
                />
                <span title="AI Copilot status" style={{ fontSize: 11, color: geminiKey ? '#16a34a' : 'var(--steel)', whiteSpace: 'nowrap' }}>
                  {geminiKey ? '✓ AI on' : '○ AI off'}
                </span>
              </>
            )}
            <button onClick={() => setActiveTab('export')} style={{
              padding: isMobile ? '6px 12px' : '6px 16px', borderRadius: 4,
              border: '1.5px solid var(--blueprint)',
              background: 'var(--blueprint)', color: 'white',
              fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-body)', fontWeight: 500,
            }}>
              {isMobile ? '⬇ Export' : '⬇ Export / Download'}
            </button>
          </div>
        )}
      </div>

      {/* If not generated: generation screen */}
      {!isGenerated ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
            <div style={{ marginBottom: 32 }}>
              <svg width="80" height="80" viewBox="0 0 28 28" fill="none" style={{ display: 'block', margin: '0 auto 24px' }}>
                <rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/>
                <path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 300, marginBottom: 12, letterSpacing: '-0.02em' }}>Ready to Generate</h2>
              <p style={{ color: 'var(--steel)', fontSize: 16, lineHeight: 1.7, fontWeight: 300 }}>
                We'll create your complete design package: floor plans, elevations, cost estimates, BOQ, interior concepts, and compliance notes.
              </p>
            </div>

            {/* Project summary */}
            <div style={{
              border: '1px solid var(--line)', borderRadius: 8,
              backgroundColor: 'white', padding: '24px',
              marginBottom: 32, textAlign: 'left',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
                {[
                  { k: 'Plot', v: `${req.plotWidth}×${req.plotDepth} ft (${req.plotSize} sq yd)` },
                  { k: 'Location', v: req.location },
                  { k: 'Configuration', v: `${req.bhk} BHK · ${req.floors === 1 ? 'G' : `G+${req.floors - 1}`}` },
                  { k: 'Style', v: req.style.charAt(0).toUpperCase() + req.style.slice(1) },
                  { k: 'Budget', v: `₹${req.budget} Lakhs` },
                  { k: 'Special', v: req.specialRooms.length > 0 ? req.specialRooms.slice(0, 2).join(', ') + (req.specialRooms.length > 2 ? '...' : '') : 'None' },
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 10, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.k}</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {generating ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: 'var(--blueprint)',
                      animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}/>
                  ))}
                </div>
                <p style={{ color: 'var(--blueprint)', fontSize: 14, fontWeight: 500 }}>{genStep}</p>
                <div style={{
                  marginTop: 16, height: 4, backgroundColor: 'var(--paper-dark)', borderRadius: 2, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    backgroundColor: 'var(--blueprint)',
                    width: '60%',
                    transition: 'width 1s ease',
                    backgroundImage: 'linear-gradient(90deg, var(--blueprint) 0%, var(--blueprint-light) 50%, var(--blueprint) 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s infinite',
                  }}/>
                </div>
              </div>
            ) : (
              <button onClick={generateDesign} style={{
                width: '100%', padding: '16px',
                borderRadius: 6, border: 'none',
                backgroundColor: 'var(--blueprint)', color: 'white',
                fontSize: 16, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: '0 4px 24px rgba(26,39,68,0.2)',
                transition: 'transform 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
              >
                Generate Design Package →
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Generated: tabbed view */
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: 'hidden' }}>
          {/* Left sidebar tabs (horizontal scroll bar on mobile) */}
          <div style={isMobile ? {
            width: '100%', borderBottom: '1px solid var(--line)',
            backgroundColor: 'white', flexShrink: 0,
            display: 'flex', flexDirection: 'row', overflowX: 'auto', whiteSpace: 'nowrap',
          } : {
            width: 210, borderRight: '1px solid var(--line)',
            backgroundColor: 'white', flexShrink: 0,
            overflowY: 'auto', paddingTop: 8,
          }}>
            {(() => {
              const groups: string[] = [];
              const seen = new Set<string>();
              TABS.forEach(t => { const g = t.group || ''; if (!seen.has(g)) { seen.add(g); groups.push(g); } });
              return groups.map(group => (
                <div key={group} style={isMobile ? { display: 'inline-flex' } : undefined}>
                  {group && !isMobile && (
                    <div style={{ padding: '10px 20px 4px', fontSize: 9, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {group}
                    </div>
                  )}
                  {TABS.filter(t => (t.group || '') === group).map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={isMobile ? {
                      padding: '12px 14px', whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      backgroundColor: activeTab === tab.id ? 'rgba(26,39,68,0.07)' : 'transparent',
                      borderTop: 'none', borderRight: 'none', borderLeft: 'none',
                      borderBottom: `2.5px solid ${activeTab === tab.id ? 'var(--blueprint)' : 'transparent'}`,
                      cursor: 'pointer',
                      color: activeTab === tab.id ? 'var(--blueprint)' : 'var(--steel)',
                      fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                      fontFamily: 'var(--font-body)',
                    } : {
                      width: '100%', padding: '9px 20px',
                      display: 'flex', alignItems: 'center', gap: 9,
                      backgroundColor: activeTab === tab.id ? 'rgba(26,39,68,0.07)' : 'transparent',
                      borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                      borderLeft: `3px solid ${activeTab === tab.id ? 'var(--blueprint)' : 'transparent'}`,
                      cursor: 'pointer',
                      color: activeTab === tab.id ? 'var(--blueprint)' : 'var(--steel)',
                      fontSize: 12.5, fontWeight: activeTab === tab.id ? 600 : 400,
                      textAlign: 'left', fontFamily: 'var(--font-body)',
                      transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: 13, opacity: 0.75 }}>{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              ));
            })()}
          </div>

          {/* Main content area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '32px 40px' }}>
            {activeTab === 'overview' && <OverviewTab project={project} analysisData={analysisData} />}
            {activeTab === 'floor-plans' && (
              <FloorPlansTab
                project={project}
                editedPlans={editedFloorPlans}
                layoutOptions={layoutOptions}
                selectedLayoutId={selectedLayoutId}
                onSelectLayout={(id) => {
                  setSelectedLayoutId(id);
                  saveProject({ ...project, selectedLayoutId: id });
                }}
              />
            )}
            {activeTab === 'cad-editor' && (
              <CADEditorTab
                project={project}
                editedPlans={editedFloorPlans}
                layoutOptions={layoutOptions}
                selectedLayoutId={selectedLayoutId}
                onSelectLayout={setSelectedLayoutId}
                onPlansChange={(plans) => {
                  setEditedFloorPlans(plans);
                  saveProject({ ...project, floorPlans: plans });
                }}
              />
            )}
            {activeTab === '3d-view' && (
              <ThreeDViewTab
                project={project}
                editedPlans={editedFloorPlans}
                layoutOptions={layoutOptions}
                selectedLayoutId={selectedLayoutId}
              />
            )}
            {activeTab === 'elevations' && <ElevationsTab project={project} layoutOptions={layoutOptions} selectedLayoutId={selectedLayoutId} />}
            {activeTab === 'interior' && (
              <InteriorTab
                project={project}
                interiorData={interiorData}
                editedPlans={editedFloorPlans}
                onPlansChange={(plans) => {
                  setEditedFloorPlans(plans);
                  saveProject({ ...project, floorPlans: plans });
                }}
              />
            )}
            {activeTab === 'vastu' && <VastuTab project={project} layoutOptions={layoutOptions} selectedLayoutId={selectedLayoutId} />}
            {activeTab === 'sun-vent' && <SunVentTab project={project} layoutOptions={layoutOptions} selectedLayoutId={selectedLayoutId} />}
            {['structural', 'electrical', 'plumbing', 'hvac', 'fire', 'site'].includes(activeTab) && (
              <DrawingCatalogView
                discipline={activeTab as 'structural' | 'electrical' | 'plumbing' | 'hvac' | 'fire' | 'site'}
                title={TABS.find(t => t.id === activeTab)?.label || ''}
                layoutOptions={layoutOptions}
                selectedLayoutId={selectedLayoutId}
                settings={project.plotSettings || { width: project.requirements.plotWidth, depth: project.requirements.plotDepth, location: project.requirements.location, floors: project.requirements.floors, style: 'modern', budgetLakhs: project.requirements.budget, bedrooms: project.requirements.bhk, kitchenStyle: 'large', balconyRequired: true }}
                floors={project.requirements.floors}
              />
            )}
            {activeTab === 'cost' && <CostTab project={project} layoutOptions={layoutOptions} selectedLayoutId={selectedLayoutId} />}
            {activeTab === 'boq' && <BOQTab project={project} layoutOptions={layoutOptions} selectedLayoutId={selectedLayoutId} />}
            {activeTab === 'timeline' && <TimelineTab project={project} />}
            {activeTab === 'site-visits' && <SiteVisitsTab project={project} />}
            {activeTab === 'compliance' && <ComplianceTab project={project} complianceData={complianceData} />}
            {activeTab === 'export' && <ExportTab project={project} />}
          </div>
        </div>
      )}

      {/* AI Copilot Chat (floats bottom-right when generated) */}
      {isGenerated && project.plotSettings && (
        <CopilotChat
          settings={project.plotSettings}
          onUpdateSettings={(newSettings) => {
            const updated = { ...project, plotSettings: newSettings };
            const newLayouts = generateLayouts(newSettings);
            setLayoutOptions(newLayouts);
            saveProject({ ...updated, layoutOptions: newLayouts });
            setProject({ ...updated, layoutOptions: newLayouts });
          }}
          geminiKey={geminiKey}
        />
      )}
    </div>
  );
}

/* ---- Tab Components ---- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, marginBottom: 24, letterSpacing: '-0.02em' }}>
      {children}
    </h2>
  );
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} transform="rotate(-90 65 65)" />
        <text x="65" y="60" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-display)">{score}</text>
        <text x="65" y="80" textAnchor="middle" fontSize="11" fill="var(--steel)" fontFamily="var(--font-mono)">/ 100</text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
    </div>
  );
}

function useSelectedRooms(project: Project, layoutOptions: LayoutOption[] | null, selectedLayoutId: string) {
  const opt = layoutOptions?.find(o => o.id === selectedLayoutId) || layoutOptions?.[0];
  return opt?.rooms || [];
}

function VastuTab({ project, layoutOptions, selectedLayoutId }: { project: Project; layoutOptions: LayoutOption[] | null; selectedLayoutId: string }) {
  const rooms = useSelectedRooms(project, layoutOptions, selectedLayoutId);
  const ps = project.plotSettings;
  if (!rooms.length || !ps) return <div><SectionTitle>Vastu Score</SectionTitle><p style={{ color: 'var(--steel)' }}>Generate a design first to see the Vastu analysis.</p></div>;
  const report = analyzeVastu(rooms, ps.width, ps.depth);
  const scoreColor = report.score >= 85 ? '#16a34a' : report.score >= 70 ? '#65a30d' : report.score >= 55 ? '#d97706' : '#dc2626';
  const sevColor = { critical: '#dc2626', moderate: '#d97706', minor: '#65a30d' };
  const statusColor = { ideal: '#16a34a', acceptable: '#d97706', dosha: '#dc2626' };

  return (
    <div>
      <SectionTitle>🕉 Vastu Compliance Report</SectionTitle>
      <p style={{ color: 'var(--steel)', marginBottom: 28, fontWeight: 300, maxWidth: 680 }}>
        Every room is mapped to its directional zone (Ashtadik) and scored against classical Vastu Shastra principles — the differentiator global tools don&apos;t offer.
      </p>

      <div style={{ display: 'flex', gap: 32, alignItems: 'center', padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', marginBottom: 28 }}>
        <ScoreRing score={report.score} label={report.grade} color={scoreColor} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>{report.rating}</div>
          <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
            <div><span style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{report.zoneMap.filter(z => z.status === 'ideal').length}</span><div style={{ fontSize: 11, color: 'var(--steel)' }}>Ideal placements</div></div>
            <div><span style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>{report.zoneMap.filter(z => z.status === 'acceptable').length}</span><div style={{ fontSize: 11, color: 'var(--steel)' }}>Acceptable</div></div>
            <div><span style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{report.doshas.length}</span><div style={{ fontSize: 11, color: 'var(--steel)' }}>Doshas (defects)</div></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 24 }}>
        {/* Zone map */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--blueprint)' }}>Room → Direction Map</h3>
          {report.zoneMap.map((z, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>{z.room}</div>
                <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{DIRECTION_NAMES[z.zone]}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 100, color: 'white', backgroundColor: statusColor[z.status], textTransform: 'uppercase' }}>{z.status}</span>
            </div>
          ))}
        </div>

        {/* Doshas + remedies */}
        <div>
          {report.doshas.length > 0 ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: '#dc2626' }}>Doshas & Remedies</h3>
              {report.doshas.map((d, i) => (
                <div key={i} style={{ padding: '12px', borderRadius: 8, backgroundColor: '#fef2f2', border: '1px solid #fecaca', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 100, color: 'white', backgroundColor: sevColor[d.severity], textTransform: 'uppercase' }}>{d.severity}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{d.room}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--steel)', lineHeight: 1.5, marginBottom: 6 }}>{d.issue}</div>
                  <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.5 }}><strong>Remedy:</strong> {d.remedy}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ border: '1px solid #bbf7d0', borderRadius: 10, backgroundColor: '#f0fdf4', padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>✓ No major doshas detected</h3>
            </div>
          )}
          {report.positives.length > 0 && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#16a34a' }}>Auspicious Highlights</h3>
              {report.positives.map((p, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--steel)', lineHeight: 1.6, marginBottom: 6, display: 'flex', gap: 8 }}>
                  <span style={{ color: '#16a34a' }}>✓</span> {p}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--steel)', marginTop: 20, fontStyle: 'italic' }}>Orientation assumed North-up. Vastu guidance is advisory; consult a Vastu expert for ritual specifics.</p>
    </div>
  );
}

function SunVentTab({ project, layoutOptions, selectedLayoutId }: { project: Project; layoutOptions: LayoutOption[] | null; selectedLayoutId: string }) {
  const rooms = useSelectedRooms(project, layoutOptions, selectedLayoutId);
  if (!rooms.length) return <div><SectionTitle>Sun & Ventilation</SectionTitle><p style={{ color: 'var(--steel)' }}>Generate a design first.</p></div>;
  const report = analyzeSunVent(rooms, project.requirements.location);
  const dayColor = report.daylightScore >= 75 ? '#16a34a' : report.daylightScore >= 55 ? '#d97706' : '#dc2626';
  const ventColor = report.ventilationScore >= 75 ? '#16a34a' : report.ventilationScore >= 55 ? '#d97706' : '#dc2626';
  const heatBadge = { low: '#16a34a', medium: '#d97706', high: '#dc2626' };
  const dayBadge = { excellent: '#16a34a', good: '#65a30d', fair: '#d97706', poor: '#dc2626' };

  return (
    <div>
      <SectionTitle>☀ Sun-Path & Ventilation</SectionTitle>
      <p style={{ color: 'var(--steel)', marginBottom: 28, fontWeight: 300, maxWidth: 680 }}>
        Daylight, heat-gain and cross-ventilation analysis tuned to your <strong>{report.climate}</strong> climate zone.
      </p>

      <div style={{ display: 'flex', gap: 32, alignItems: 'center', padding: '24px 28px', border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', marginBottom: 28 }}>
        <ScoreRing score={report.daylightScore} label="Daylight" color={dayColor} />
        <ScoreRing score={report.ventilationScore} label="Ventilation" color={ventColor} />
        <div style={{ flex: 1, paddingLeft: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Climate Zone</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--blueprint)', marginBottom: 12 }}>{report.climate}</div>
          <div style={{ fontSize: 12, color: 'var(--steel)', lineHeight: 1.6 }}>Sun rises East → transits South → sets West. North light is soft & glare-free.</div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--blueprint)' }}>Room-by-Room Solar Analysis</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--steel)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <th style={{ padding: '6px 0' }}>Room</th><th>Sun Exposure</th><th>Daylight</th><th>Ventilation</th><th>Heat Risk</th>
          </tr></thead>
          <tbody>
            {report.rooms.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '9px 0', color: 'var(--ink)' }}>{r.room}</td>
                <td style={{ fontSize: 11, color: 'var(--steel)' }}>{r.exposures.length ? r.exposures.join(', ') : '— no windows —'}</td>
                <td><span style={{ fontSize: 10, fontWeight: 600, color: dayBadge[r.daylight], textTransform: 'capitalize' }}>{r.daylight}</span></td>
                <td><span style={{ fontSize: 10, fontWeight: 600, color: r.ventilation === 'cross' ? '#16a34a' : r.ventilation === 'single' ? '#d97706' : '#dc2626', textTransform: 'capitalize' }}>{r.ventilation === 'cross' ? 'Cross ✓' : r.ventilation}</span></td>
                <td><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, color: 'white', backgroundColor: heatBadge[r.heatRisk], textTransform: 'uppercase' }}>{r.heatRisk}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: '#fffbeb', padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#92400e' }}>Climate-Specific Recommendations</h3>
        {report.recommendations.map((rec, i) => (
          <div key={i} style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6, marginBottom: 8, display: 'flex', gap: 8 }}>
            <span>☀</span> {rec}
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ project, analysisData }: { project: Project; analysisData: Record<string, unknown> | null }) {
  const req = project.requirements;
  const cost = project.costEstimate;
  const builtUp = project.floorPlans?.reduce((s, p) => s + p.builtUpArea, 0) || 0;

  return (
    <div>
      <SectionTitle>Project Overview</SectionTitle>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 16, marginBottom: 40 }}>
        {[
          { label: 'Built-up Area', value: `${builtUp.toLocaleString()} sq.ft`, sub: `${req.plotSize} sq yd plot` },
          { label: 'Configuration', value: `${req.bhk} BHK`, sub: `${req.floors === 1 ? 'G' : `G+${req.floors - 1}`} · ${req.floors} floor${req.floors > 1 ? 's' : ''}` },
          { label: 'Standard Cost', value: cost ? `₹${cost.standard}L` : '—', sub: `₹${cost ? cost.economy : '—'}L – ₹${cost ? cost.premium : '—'}L range` },
          { label: 'Style', value: req.style.charAt(0).toUpperCase() + req.style.slice(1), sub: req.location },
        ].map((m, i) => (
          <div key={i} style={{ padding: '20px', border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white' }}>
            <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--blueprint)', lineHeight: 1 }}>{m.value}</div>
            <div style={{ fontSize: 12, color: 'var(--steel)', marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 24 }}>
        {/* AI Analysis */}
        {analysisData && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: '24px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>AI Design Analysis</h3>
            {(analysisData as { designIntent?: string }).designIntent && (
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)', marginBottom: 16, fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
                "{(analysisData as { designIntent: string }).designIntent}"
              </p>
            )}
            {(analysisData as { validationNotes?: string[] }).validationNotes?.map((note, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--blueprint)', fontSize: 10, marginTop: 4, flexShrink: 0 }}>●</span>
                <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{note}</span>
              </div>
            ))}
          </div>
        )}

        {/* Space Allocation */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: '24px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>Space Allocation</h3>
          {project.analysis?.spaceAllocation.slice(0, 8).map((s, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--ink)' }}>{s.room}</span>
                <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{s.area} sq.ft · {s.percentage}%</span>
              </div>
              <div style={{ height: 4, backgroundColor: 'var(--paper-dark)', borderRadius: 2 }}>
                <div style={{ height: '100%', backgroundColor: 'var(--blueprint-light)', borderRadius: 2, width: `${s.percentage}%`, opacity: 0.7 }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Floor breakdown */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: '24px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>Floor Areas</h3>
          {project.floorPlans?.map(plan => (
            <div key={plan.floor} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid var(--line)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {plan.floor === 0 ? 'Ground Floor' : plan.floor === 1 ? 'First Floor' : plan.floor === 2 ? 'Second Floor' : 'Terrace'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--steel)' }}>{plan.rooms.length} rooms / spaces</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--blueprint)' }}>{plan.totalArea.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--steel)' }}>sq.ft</div>
              </div>
            </div>
          ))}
        </div>

        {/* Cost summary */}
        {cost && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: '24px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>Cost Summary</h3>
            {[
              { label: 'Economy', value: cost.economy, color: '#16a34a' },
              { label: 'Standard', value: cost.standard, color: 'var(--blueprint)' },
              { label: 'Premium', value: cost.premium, color: 'var(--amber)' },
            ].map((tier, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 14, color: 'var(--ink)' }}>{tier.label}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: tier.color }}>₹{tier.value}L</span>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: '12px', backgroundColor: 'var(--paper)', borderRadius: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--steel)', marginBottom: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Breakdown (Standard)</div>
              {Object.entries(cost.breakdown).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--ink)', textTransform: 'capitalize' }}>{k}</span>
                  <span style={{ color: 'var(--steel)' }}>₹{v}L</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FloorPlansTab({
  project, editedPlans, layoutOptions, selectedLayoutId, onSelectLayout,
}: {
  project: Project;
  editedPlans: FloorPlan[] | null;
  layoutOptions: LayoutOption[] | null;
  selectedLayoutId: 'option-a' | 'option-b' | 'option-c';
  onSelectLayout: (id: 'option-a' | 'option-b' | 'option-c') => void;
}) {
  const [viewMode, setViewMode] = useState<'vastu' | 'legacy'>('vastu');
  const [selectedFloor, setSelectedFloor] = useState(0);
  const plans = editedPlans || project.floorPlans || [];
  const plan = plans[selectedFloor];

  const selectedLayout = layoutOptions?.find(l => l.id === selectedLayoutId);
  const req = project.requirements;

  return (
    <div>
      <SectionTitle>Floor Plans</SectionTitle>

      {/* View mode toggle */}
      {layoutOptions && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button onClick={() => setViewMode('vastu')} style={{
            padding: '8px 20px', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
            border: `1.5px solid ${viewMode === 'vastu' ? 'var(--amber)' : 'var(--line-strong)'}`,
            backgroundColor: viewMode === 'vastu' ? 'var(--amber)' : 'white',
            color: viewMode === 'vastu' ? 'white' : 'var(--steel)', fontWeight: viewMode === 'vastu' ? 600 : 400,
          }}>✦ Vastu-Optimized Plans (New)</button>
          <button onClick={() => setViewMode('legacy')} style={{
            padding: '8px 20px', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
            border: `1.5px solid ${viewMode === 'legacy' ? 'var(--blueprint)' : 'var(--line-strong)'}`,
            backgroundColor: viewMode === 'legacy' ? 'var(--blueprint)' : 'white',
            color: viewMode === 'legacy' ? 'white' : 'var(--steel)',
          }}>Standard View</button>
        </div>
      )}

      {/* Vastu layout options */}
      {viewMode === 'vastu' && layoutOptions && (
        <div>
          {/* 3 option cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 16, marginBottom: 28 }}>
            {layoutOptions.map(opt => (
              <div
                key={opt.id}
                onClick={() => onSelectLayout(opt.id)}
                style={{
                  border: `2px solid ${selectedLayoutId === opt.id ? 'var(--amber)' : 'var(--line)'}`,
                  borderRadius: 8, padding: '18px 20px', cursor: 'pointer',
                  backgroundColor: selectedLayoutId === opt.id ? '#fff7ed' : 'white',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: selectedLayoutId === opt.id ? 'var(--amber)' : 'var(--blueprint)' }}>
                    {opt.name}
                  </div>
                  {selectedLayoutId === opt.id && (
                    <div style={{ fontSize: 10, backgroundColor: 'var(--amber)', color: 'white', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
                      SELECTED
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500, marginBottom: 6 }}>{opt.tagline}</div>
                <div style={{ fontSize: 12, color: 'var(--steel)', lineHeight: 1.5 }}>{opt.description}</div>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>
                  {opt.rooms.length} spaces · ×{opt.costMultiplier.toFixed(1)} cost
                </div>
              </div>
            ))}
          </div>

          {/* Floor selector for selected layout */}
          {selectedLayout && (
            <>
              {project.requirements.floors > 1 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {Array.from(new Set(selectedLayout.rooms.map(r => r.floor))).sort().map(fl => (
                    <button key={fl} onClick={() => setSelectedFloor(fl)} style={{
                      padding: '7px 18px', borderRadius: 4, fontSize: 12,
                      border: `1.5px solid ${selectedFloor === fl ? 'var(--blueprint)' : 'var(--line-strong)'}`,
                      backgroundColor: selectedFloor === fl ? 'var(--blueprint)' : 'white',
                      color: selectedFloor === fl ? 'white' : 'var(--steel)',
                      cursor: 'pointer', fontFamily: 'var(--font-body)',
                    }}>
                      {fl === 0 ? 'Ground Floor' : fl === 1 ? 'First Floor' : fl === 2 ? 'Second Floor' : 'Terrace'}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 24 }}>
                <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', backgroundColor: 'white', padding: 16 }}>
                  <FloorPlanV2Renderer
                    rooms={selectedLayout.rooms.filter(r => r.floor === selectedFloor)}
                    plotWidth={req.plotWidth}
                    plotDepth={req.plotDepth}
                  />
                </div>
                <div>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>Room Schedule</div>
                    {selectedLayout.rooms.filter(r => r.floor === selectedFloor).map(room => (
                      <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{room.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{room.w}×{room.h} ft</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Legacy standard view */}
      {(!layoutOptions || viewMode === 'legacy') && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {plans.map((_, i) => (
              <button key={i} onClick={() => setSelectedFloor(i)} style={{
                padding: '8px 20px', borderRadius: 4,
                border: `1.5px solid ${selectedFloor === i ? 'var(--blueprint)' : 'var(--line-strong)'}`,
                backgroundColor: selectedFloor === i ? 'var(--blueprint)' : 'white',
                color: selectedFloor === i ? 'white' : 'var(--steel)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}>
                {i === 0 ? 'Ground Floor' : i === 1 ? 'First Floor' : i === 2 ? 'Second Floor' : 'Terrace'}
              </button>
            ))}
          </div>

          {plan && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 24 }}>
              <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', backgroundColor: 'white', padding: 16 }}>
                <FloorPlanRenderer plan={plan} scale={1} />
              </div>
              <div>
                <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>Room Schedule</div>
                  {plan.rooms.map(room => (
                    <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: room.color, border: '1px solid rgba(0,0,0,0.1)' }}/>
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{room.name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{room.area} sq.ft</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontWeight: 600 }}>
                    <span style={{ fontSize: 13 }}>Total</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--blueprint)' }}>{plan.totalArea} sq.ft</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CADEditorTab({ project, editedPlans, layoutOptions, selectedLayoutId, onSelectLayout, onPlansChange }: {
  project: Project;
  editedPlans: FloorPlan[] | null;
  layoutOptions: LayoutOption[] | null;
  selectedLayoutId: 'option-a' | 'option-b' | 'option-c';
  onSelectLayout: (id: 'option-a' | 'option-b' | 'option-c') => void;
  onPlansChange: (plans: FloorPlan[]) => void;
}) {
  const [viewMode, setViewMode] = useState<'vastu' | 'legacy'>('vastu');
  const [activeTab, setActiveTab] = useState<'ground' | 'first' | 'terrace'>('ground');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [layoutRooms, setLayoutRooms] = useState(() =>
    layoutOptions?.find(l => l.id === selectedLayoutId)?.rooms || []
  );

  // Sync when selection changes
  const selectedLayout = layoutOptions?.find(l => l.id === selectedLayoutId);

  const handleUpdateRoom = (updatedRoom: import('@/types').RoomLayout) => {
    setLayoutRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));
  };

  const req = project.requirements;
  const plotSettings: PlotSettings = project.plotSettings || {
    width: req.plotWidth, depth: req.plotDepth, location: req.location,
    floors: req.floors, style: 'modern', budgetLakhs: req.budget,
    bedrooms: req.bhk, kitchenStyle: 'large', balconyRequired: true,
  };

  if (viewMode === 'vastu' && selectedLayout) {
    const floorTabs: ('ground' | 'first' | 'terrace')[] = ['ground'];
    if (req.floors >= 2) floorTabs.push('first');
    if (req.floors >= 3) floorTabs.push('terrace');
    const floorNum = activeTab === 'ground' ? 0 : activeTab === 'first' ? 1 : 2;
    const currentRooms = layoutRooms.filter(r => r.floor === floorNum);

    return (
      <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          <SectionTitle>CAD Editor</SectionTitle>
          {/* Floor tabs */}
          {floorTabs.length > 1 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {floorTabs.map(f => (
                <button key={f} onClick={() => setActiveTab(f)} style={{
                  padding: '5px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
                  border: `1.5px solid ${activeTab === f ? 'var(--blueprint)' : 'var(--line-strong)'}`,
                  backgroundColor: activeTab === f ? 'var(--blueprint)' : 'white',
                  color: activeTab === f ? 'white' : 'var(--steel)',
                  fontWeight: activeTab === f ? 600 : 400,
                }}>
                  {f === 'ground' ? 'Ground Floor' : f === 'first' ? 'First Floor' : 'Second Floor'}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {(['option-a', 'option-b', 'option-c'] as const).map(id => {
              const opt = layoutOptions?.find(l => l.id === id);
              return opt ? (
                <button key={id} onClick={() => {
                  onSelectLayout(id);
                  setLayoutRooms(layoutOptions?.find(l => l.id === id)?.rooms || []);
                }} style={{
                  padding: '5px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
                  border: `1.5px solid ${selectedLayoutId === id ? 'var(--amber)' : 'var(--line-strong)'}`,
                  backgroundColor: selectedLayoutId === id ? 'var(--amber)' : 'white',
                  color: selectedLayoutId === id ? 'white' : 'var(--steel)',
                  fontWeight: selectedLayoutId === id ? 600 : 400,
                }}>
                  {opt.name}
                </button>
              ) : null;
            })}
            <button onClick={() => setViewMode('legacy')} style={{
              padding: '5px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
              border: '1.5px solid var(--line-strong)', background: 'white', color: 'var(--steel)',
              fontFamily: 'var(--font-body)',
            }}>Standard View</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--line)' }}>
          <DrawingViewport
            rooms={layoutRooms}
            settings={plotSettings}
            selectedRoomId={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
            onUpdateRoom={handleUpdateRoom}
            activeTab={activeTab}
            elevationSide="front"
            sectionType="cross"
            siteSvg=""
            roofSvg=""
            elevationSvg=""
            sectionSvg=""
          />
        </div>
      </div>
    );
  }

  // Legacy CAD editor
  const [selectedFloor, setSelectedFloor] = useState(0);
  const plans = editedPlans || project.floorPlans || [];
  const plan = plans[selectedFloor];

  if (!plan) return <div style={{ padding: 32, color: 'var(--steel)' }}>No floor plan data. Generate the design first.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <SectionTitle>CAD Editor</SectionTitle>
        {layoutOptions && (
          <button onClick={() => setViewMode('vastu')} style={{
            padding: '6px 16px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
            border: '1.5px solid var(--amber)', color: 'var(--amber)', background: 'white',
            fontFamily: 'var(--font-body)',
          }}>← Vastu Plans</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {plans.map((_, i) => (
          <button key={i} onClick={() => setSelectedFloor(i)} style={{
            padding: '7px 18px', borderRadius: 4, fontSize: 12,
            border: `1.5px solid ${selectedFloor === i ? 'var(--blueprint)' : 'var(--line-strong)'}`,
            backgroundColor: selectedFloor === i ? 'var(--blueprint)' : 'white',
            color: selectedFloor === i ? 'white' : 'var(--steel)',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            {i === 0 ? 'Ground Floor' : i === 1 ? 'First Floor' : i === 2 ? 'Second Floor' : 'Terrace'}
          </button>
        ))}
      </div>
      <CADEditor
        plan={plan}
        onPlanChange={(updatedPlan) => {
          const newPlans = plans.map((p, i) => i === selectedFloor ? updatedPlan : p);
          onPlansChange(newPlans);
        }}
      />
    </div>
  );
}

function ThreeDViewTab({ project, editedPlans, layoutOptions, selectedLayoutId }: {
  project: Project;
  editedPlans: FloorPlan[] | null;
  layoutOptions: LayoutOption[] | null;
  selectedLayoutId: 'option-a' | 'option-b' | 'option-c';
}) {
  const [viewType, setViewType] = useState<'walkthrough' | 'interior'>('walkthrough');
  const [optionId, setOptionId] = useState<'option-a' | 'option-b' | 'option-c'>(selectedLayoutId);
  const [floor, setFloor] = useState(0);
  const req = project.requirements;
  const plotSettings: PlotSettings = project.plotSettings || {
    width: req.plotWidth, depth: req.plotDepth, location: req.location,
    floors: req.floors, style: 'modern', budgetLakhs: req.budget,
    bedrooms: req.bhk, kitchenStyle: 'large', balconyRequired: true,
  };
  const opt = layoutOptions?.find(l => l.id === optionId);
  const selectedRooms = opt?.rooms;
  const legacyPlans = editedPlans || project.floorPlans || [];
  const chip = (active: boolean, accent = 'var(--blueprint)'): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
    border: `1.5px solid ${active ? accent : 'var(--line-strong)'}`, backgroundColor: active ? accent : 'white',
    color: active ? 'white' : 'var(--steel)', fontWeight: active ? 600 : 400,
  });

  return (
    <div>
      <SectionTitle>3D View</SectionTitle>

      {/* Mode + option (+ floor for dollhouse) selectors */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setViewType('walkthrough')} style={chip(viewType === 'walkthrough')}>🚶 Walkthrough & Exterior</button>
          <button onClick={() => setViewType('interior')} style={chip(viewType === 'interior', 'var(--amber)')}>🏠 Interior Render</button>
        </div>
        {layoutOptions && layoutOptions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Plan:</span>
            {layoutOptions.map((o, i) => (
              <button key={o.id} onClick={() => setOptionId(o.id)} style={chip(optionId === o.id, 'var(--amber)')}>{String.fromCharCode(65 + i)} · {o.name}</button>
            ))}
          </div>
        )}
        {viewType === 'interior' && req.floors > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Floor:</span>
            {Array.from({ length: req.floors }, (_, f) => (
              <button key={f} onClick={() => setFloor(f)} style={chip(floor === f)}>{f === 0 ? 'Ground' : f === 1 ? 'First' : 'Second'}</button>
            ))}
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--steel)', marginBottom: 16 }}>
        {viewType === 'walkthrough'
          ? 'Use the in-view controls: Orbit · First-Person Walk (WASD) · Cinematic Tour. Floor isolation (All/Ground/First) is in the viewer.'
          : 'Open-roof furnished render of the selected plan & floor. Drag to orbit, scroll to zoom.'}
      </p>

      {viewType === 'walkthrough' && selectedRooms ? (
        <div style={{ height: 600, border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <ThreeDViewerV2 key={optionId} rooms={selectedRooms} settings={plotSettings} />
        </div>
      ) : viewType === 'walkthrough' && legacyPlans.length > 0 ? (
        <ThreeDViewer floorPlans={legacyPlans} />
      ) : null}

      {viewType === 'interior' && selectedRooms ? (
        <InteriorRenderView key={`${optionId}-${floor}`} rooms={selectedRooms} settings={plotSettings} floor={floor} />
      ) : null}
    </div>
  );
}

function ElevationsTab({ project, layoutOptions, selectedLayoutId }: { project: Project; layoutOptions: LayoutOption[] | null; selectedLayoutId: 'option-a' | 'option-b' | 'option-c' }) {
  const [optionId, setOptionId] = useState<'option-a' | 'option-b' | 'option-c'>(selectedLayoutId);
  const [side, setSide] = useState<ElevSide>('front');
  const opt = layoutOptions?.find(o => o.id === optionId);
  const ps = project.plotSettings || { width: project.requirements.plotWidth, depth: project.requirements.plotDepth, location: project.requirements.location, floors: project.requirements.floors, style: 'modern' as const, budgetLakhs: project.requirements.budget, bedrooms: project.requirements.bhk, kitchenStyle: 'large' as const, balconyRequired: true };

  if (!opt) {
    return (
      <div>
        <SectionTitle>Building Elevations</SectionTitle>
        <ElevationRenderer req={project.requirements} />
      </div>
    );
  }
  const svg = generateElevation(opt.rooms, ps, side, project.requirements.style, project.requirements.floors);
  const chip = (active: boolean, accent = 'var(--blueprint)'): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
    border: `1.5px solid ${active ? accent : 'var(--line-strong)'}`, backgroundColor: active ? accent : 'white',
    color: active ? 'white' : 'var(--steel)', fontWeight: active ? 600 : 400, textTransform: 'capitalize',
  });

  return (
    <div>
      <SectionTitle>Building Elevations</SectionTitle>
      <p style={{ color: 'var(--steel)', marginBottom: 14, fontWeight: 300 }}>
        Plan-accurate concept elevations — each option produces a different façade because windows & the entrance line up with that option&apos;s rooms.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {layoutOptions && layoutOptions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Option:</span>
            {layoutOptions.map((o, i) => (
              <button key={o.id} onClick={() => setOptionId(o.id)} style={chip(optionId === o.id, 'var(--amber)')}>{String.fromCharCode(65 + i)} · {o.name}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Side:</span>
          {(['front', 'rear', 'left', 'right'] as ElevSide[]).map(s => (
            <button key={s} onClick={() => setSide(s)} style={chip(side === s)}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{
        padding: '10px 14px', marginBottom: 16, backgroundColor: '#fff7ed', borderRadius: 6,
        fontSize: 12, color: '#92400e', border: '1px solid #fed7aa',
      }}>
        ⚠ AI-generated concept elevation. Final façade, heights & openings require an architect&apos;s detailing.
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: '#eaf0f7', padding: 16, overflow: 'auto' }}
        dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

function InteriorTab({ project, interiorData, editedPlans, onPlansChange }: {
  project: Project;
  interiorData: { concepts: unknown[] } | null;
  editedPlans: FloorPlan[] | null;
  onPlansChange: (plans: FloorPlan[]) => void;
}) {
  const req = project.requirements;
  const roomImages: Record<string, string> = {
    'Living Room': '🛋',
    'Master Bedroom': '🛏',
    'Kitchen': '🍳',
    'Dining': '🪑',
    'Master Bathroom': '🚿',
    'Balcony': '🌿',
  };

  const fallbackConcepts = [
    { room: 'Living Room', concept: `A ${req.style} living room with open layout, feature wall, and curated lighting. Large windows bring in natural light creating a warm, welcoming atmosphere.`, materials: ['Italian Marble Flooring', 'Textured Gypsum Wall', 'Wooden Ceiling Panels'], colorPalette: ['#F5F0E8', '#3D5A80', '#E8C99A'], furniturePlan: 'L-shaped sofa facing entertainment unit, center rug, accent chairs', lightingConcept: 'Recessed ceiling lights with warm tone LED strips and statement pendant' },
    { room: 'Master Bedroom', concept: `Serene master bedroom with ${req.style} aesthetics, built-in wardrobes, and a dedicated study nook. Designed for maximum comfort and functionality.`, materials: ['Engineered Wood Flooring', 'Fabric Wallpaper', 'Glass Wardrobe'], colorPalette: ['#EDE8E0', '#7B6D8D', '#C4A882'], furniturePlan: 'King bed centered, wardrobes flanking, study desk in corner', lightingConcept: 'Cove lighting with bedside pendants and task lamp at study' },
    { room: 'Kitchen', concept: `Modern ${req.style} kitchen with island counter, modular cabinets, and premium appliances. The work triangle ensures ergonomic workflow.`, materials: ['Quartz Countertop', 'Lacquered MDF Cabinets', 'Anti-skid Ceramic Tiles'], colorPalette: ['#FFFFFF', '#2C3E50', '#E8A855'], furniturePlan: 'L-shape layout with island, upper and lower cabinets, appliance niche', lightingConcept: 'Under-cabinet LED strips, pendant over island, bright task lighting' },
    { room: 'Master Bathroom', concept: `Spa-inspired master bathroom with separate shower enclosure, soaking tub, and double vanity unit for a luxury experience.`, materials: ['Large Format Tiles', 'Tempered Glass', 'Teak Wood Accents'], colorPalette: ['#F0ECE8', '#7A8A9A', '#B8A898'], furniturePlan: 'Double vanity with mirrors, separate shower and tub zones', lightingConcept: 'Backlit mirrors, waterproof LED strips in shower, warm ambient' },
  ];

  const concepts = interiorData?.concepts || fallbackConcepts;

  return (
    <div>
      <SectionTitle>Interior Design Concepts</SectionTitle>
      <p style={{ color: 'var(--steel)', marginBottom: 32, fontWeight: 300 }}>
        AI-generated interior concepts for {req.style.charAt(0).toUpperCase() + req.style.slice(1)} style, ₹{req.budget}L budget, {req.location}.
      </p>

      {/* Products Catalog */}
      {(editedPlans || project.floorPlans) && (
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 400, marginBottom: 6, color: 'var(--ink)' }}>
            Furniture &amp; Fixture Placement
          </h3>
          <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 20 }}>
            Browse the catalog and place furniture onto your floor plan. Drag from catalog or click +.
          </p>
          <InteriorProductsCatalog
            floorPlans={editedPlans || project.floorPlans || []}
            onPlansChange={onPlansChange}
            activeFloor={0}
          />
        </div>
      )}

      <h3 style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 400, marginBottom: 20, color: 'var(--ink)' }}>
        AI Interior Design Concepts
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {(concepts as Array<{room: string; concept: string; materials: string[]; colorPalette: string[]; furniturePlan?: string; lightingConcept?: string}>).map((c, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {/* Room preview mockup */}
              <div style={{
                width: 200, flexShrink: 0,
                backgroundColor: 'var(--paper)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 24,
                borderRight: '1px solid var(--line)',
              }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>{roomImages[c.room] || '🏠'}</div>
                <div style={{ fontSize: 13, fontWeight: 500, textAlign: 'center', color: 'var(--blueprint)' }}>{c.room}</div>
                {/* Color palette */}
                <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                  {c.colorPalette?.map((color, ci) => (
                    <div key={ci} style={{
                      width: 24, height: 24, borderRadius: '50%',
                      backgroundColor: color,
                      border: '2px solid white',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                    }}/>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, padding: '24px 28px' }}>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--ink)', marginBottom: 20, fontWeight: 300 }}>{c.concept}</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Materials</div>
                    {c.materials?.map((m, mi) => (
                      <div key={mi} style={{ fontSize: 12, color: 'var(--ink)', padding: '3px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: 'var(--amber)', fontSize: 8 }}>●</span> {m}
                      </div>
                    ))}
                  </div>
                  {c.furniturePlan && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Furniture</div>
                      <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{c.furniturePlan}</p>
                    </div>
                  )}
                  {c.lightingConcept && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Lighting</div>
                      <p style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{c.lightingConcept}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InteriorThreeDView({ rooms, settings }: { rooms: import('@/types').RoomLayout[]; settings: PlotSettings }) {
  return (
    <div style={{ height: 600, border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      <ThreeDViewerV2 rooms={rooms} settings={settings} />
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 10,
        backgroundColor: 'rgba(26,39,68,0.85)', color: 'white',
        padding: '8px 14px', borderRadius: 6, fontSize: 11,
        fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
      }}>
        ✦ INTERIOR 3D VIEW — Use WASD in Walkthrough mode to explore
      </div>
    </div>
  );
}

function EngineeringTab({ project, layoutOptions, selectedLayoutId, type }: {
  project: Project;
  layoutOptions: LayoutOption[] | null;
  selectedLayoutId: 'option-a' | 'option-b' | 'option-c';
  type: 'electrical' | 'plumbing' | 'structural';
}) {
  const [activeFloor, setActiveFloor] = useState<'ground' | 'first' | 'terrace'>('ground');
  const [optionId, setOptionId] = useState<'option-a' | 'option-b' | 'option-c'>(selectedLayoutId);
  const req = project.requirements;
  const plotSettings: PlotSettings = project.plotSettings || {
    width: req.plotWidth, depth: req.plotDepth, location: req.location,
    floors: req.floors, style: 'modern', budgetLakhs: req.budget,
    bedrooms: req.bhk, kitchenStyle: 'large', balconyRequired: true,
  };

  const tabMap: Record<typeof type, 'electrical' | 'plumbing' | 'structural'> = {
    electrical: 'electrical', plumbing: 'plumbing', structural: 'structural',
  };
  const titles = { electrical: 'Electrical Plan', plumbing: 'Plumbing Plan', structural: 'Structural Plan' };
  const approvals = {
    electrical: 'Requires Licensed Electrical Engineer Approval',
    plumbing: 'Requires Licensed Plumbing Engineer Approval',
    structural: 'Requires Licensed Structural Engineer Approval',
  };

  // Engineering follows the chosen architectural option (switchable here).
  const selectedRooms = layoutOptions?.find(l => l.id === optionId)?.rooms;

  // Fall back to legacy renderer if no Vastu rooms
  if (!selectedRooms || selectedRooms.length === 0) {
    const plans = project.floorPlans || [];
    const floorIdx = activeFloor === 'ground' ? 0 : activeFloor === 'first' ? 1 : 2;
    const plan = plans[floorIdx];
    return (
      <div>
        <SectionTitle>{titles[type]}</SectionTitle>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {plans.map((_, i) => (
            <button key={i} onClick={() => setActiveFloor(i === 0 ? 'ground' : i === 1 ? 'first' : 'terrace')} style={{
              padding: '8px 20px', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${floorIdx === i ? 'var(--blueprint)' : 'var(--line-strong)'}`,
              backgroundColor: floorIdx === i ? 'var(--blueprint)' : 'white',
              color: floorIdx === i ? 'white' : 'var(--steel)',
            }}>
              {i === 0 ? 'Ground Floor' : i === 1 ? 'First Floor' : 'Second Floor'}
            </button>
          ))}
        </div>
        {plan && <MEPRenderer plan={plan} type={type} />}
      </div>
    );
  }

  const floorNum = activeFloor === 'ground' ? 0 : activeFloor === 'first' ? 1 : 2;
  const floorRooms = selectedRooms.filter(r => r.floor === floorNum);

  const floorTabs: ('ground' | 'first' | 'terrace')[] = ['ground'];
  if (req.floors >= 2) floorTabs.push('first');
  if (req.floors >= 3) floorTabs.push('terrace');

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <SectionTitle>{titles[type]}</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          {floorTabs.map(f => (
            <button key={f} onClick={() => setActiveFloor(f)} style={{
              padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${activeFloor === f ? 'var(--blueprint)' : 'var(--line-strong)'}`,
              backgroundColor: activeFloor === f ? 'var(--blueprint)' : 'white',
              color: activeFloor === f ? 'white' : 'var(--steel)',
            }}>
              {f === 'ground' ? 'Ground Floor' : f === 'first' ? 'First Floor' : 'Second Floor'}
            </button>
          ))}
        </div>
      </div>

      {/* Per-option engineering selector — each option has its own package */}
      {layoutOptions && layoutOptions.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Engineering for:</span>
          {layoutOptions.map((o, i) => (
            <button key={o.id} onClick={() => setOptionId(o.id)} style={{
              padding: '5px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${optionId === o.id ? 'var(--amber)' : 'var(--line-strong)'}`,
              backgroundColor: optionId === o.id ? 'var(--amber)' : 'white',
              color: optionId === o.id ? 'white' : 'var(--steel)', fontWeight: optionId === o.id ? 600 : 400,
            }}>
              {String.fromCharCode(65 + i)} · {o.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 12px', borderRadius: 6, backgroundColor: '#fef2f2', border: '1px solid #fecaca', flexShrink: 0 }}>
        <span style={{ fontSize: 12 }}>⚠</span>
        <span style={{ fontSize: 11.5, color: '#b91c1c', fontWeight: 600 }}>{approvals[type]}</span>
        <span style={{ fontSize: 11, color: '#7f1d1d' }}>— AI draft for the selected option ({optionId.replace('option-', 'Option ').toUpperCase()}). Not for construction.</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--line)' }}>
        <DrawingViewport
          rooms={floorRooms}
          settings={plotSettings}
          selectedRoomId={null}
          onSelectRoom={() => {}}
          onUpdateRoom={() => {}}
          activeTab={tabMap[type]}
          elevationSide="front"
          sectionType="cross"
          siteSvg="" roofSvg="" elevationSvg="" sectionSvg=""
        />
      </div>
    </div>
  );
}

function MEPTab({ project, type }: { project: Project; type: 'electrical' | 'plumbing' | 'structural' }) {
  const [selectedFloor, setSelectedFloor] = useState(0);
  const plan = project.floorPlans?.[selectedFloor];
  const titles = { electrical: 'Electrical Draft', plumbing: 'Plumbing Draft', structural: 'Structural Draft' };
  return (
    <div>
      <SectionTitle>{titles[type]}</SectionTitle>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {project.floorPlans?.map((_, i) => (
          <button key={i} onClick={() => setSelectedFloor(i)} style={{
            padding: '8px 20px', borderRadius: 4,
            border: `1.5px solid ${selectedFloor === i ? 'var(--blueprint)' : 'var(--line-strong)'}`,
            backgroundColor: selectedFloor === i ? 'var(--blueprint)' : 'white',
            color: selectedFloor === i ? 'white' : 'var(--steel)',
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            {i === 0 ? 'Ground Floor' : i === 1 ? 'First Floor' : i === 2 ? 'Second Floor' : 'Terrace'}
          </button>
        ))}
      </div>
      {plan && <MEPRenderer plan={plan} type={type} />}
    </div>
  );
}

function optionBuiltUp(opt: LayoutOption | undefined): number {
  if (!opt) return 0;
  return Math.round(opt.rooms.filter(r => r.type !== 'parking' && r.type !== 'garden').reduce((s, r) => s + r.w * r.h, 0));
}

function CostTab({ project, layoutOptions, selectedLayoutId }: { project: Project; layoutOptions: LayoutOption[] | null; selectedLayoutId: 'option-a' | 'option-b' | 'option-c' }) {
  const cost = project.costEstimate;
  const [optionId, setOptionId] = useState<'option-a' | 'option-b' | 'option-c'>(selectedLayoutId);
  const opt = layoutOptions?.find(o => o.id === optionId);
  const optBuiltUp = optionBuiltUp(opt) || cost?.builtUp || 0;
  if (!cost) return null;

  return (
    <div>
      <SectionTitle>Cost Estimation</SectionTitle>
      <p style={{ color: 'var(--steel)', marginBottom: 16, fontWeight: 300 }}>
        Per-option, city-wise estimate (incl. GST) for {project.requirements.location}. Rates vary by material grade and market conditions.
      </p>
      {layoutOptions && layoutOptions.length > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Costing for:</span>
          {layoutOptions.map((o, i) => (
            <button key={o.id} onClick={() => setOptionId(o.id)} style={{
              padding: '5px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${optionId === o.id ? 'var(--amber)' : 'var(--line-strong)'}`,
              backgroundColor: optionId === o.id ? 'var(--amber)' : 'white', color: optionId === o.id ? 'white' : 'var(--steel)', fontWeight: optionId === o.id ? 600 : 400,
            }}>{String.fromCharCode(65 + i)} · {o.name} · {optionBuiltUp(o).toLocaleString()} sq ft</button>
          ))}
        </div>
      )}

      {/* Three tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 20, marginBottom: 40 }}>
        {[
          { tier: 'Economy', value: cost.economy, color: '#16a34a', bg: '#f0fdf4', desc: 'Standard materials, functional finishes', rate: `₹${Math.round(cost.economy * 100000 / (cost.builtUp || 1)).toLocaleString()}/sq.ft` },
          { tier: 'Standard', value: cost.standard, color: 'var(--blueprint)', bg: 'rgba(26,39,68,0.04)', desc: 'Good quality materials, elegant finishes', rate: `₹${Math.round(cost.standard * 100000 / (cost.builtUp || 1)).toLocaleString()}/sq.ft`, recommended: true },
          { tier: 'Premium', value: cost.premium, color: 'var(--amber)', bg: '#fff7ed', desc: 'Premium materials, luxury finishes', rate: `₹${Math.round(cost.premium * 100000 / (cost.builtUp || 1)).toLocaleString()}/sq.ft` },
        ].map((t, i) => (
          <div key={i} style={{
            border: `2px solid ${t.recommended ? t.color : 'var(--line)'}`,
            borderRadius: 8, padding: '28px 24px',
            backgroundColor: t.bg, position: 'relative',
          }}>
            {t.recommended && (
              <div style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                backgroundColor: 'var(--blueprint)', color: 'white',
                padding: '3px 12px', borderRadius: 100, fontSize: 10, fontWeight: 500,
              }}>RECOMMENDED</div>
            )}
            <div style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 8 }}>{t.tier}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 600, color: t.color, lineHeight: 1 }}>₹{t.value}L</div>
            <div style={{ fontSize: 12, color: 'var(--steel)', margin: '8px 0 12px', fontFamily: 'var(--font-mono)' }}>{t.rate}</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* Breakdown chart */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: '28px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 24, color: 'var(--blueprint)' }}>Cost Breakdown (Standard)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 48px' }}>
          {Object.entries(cost.breakdown).map(([key, value]) => {
            const pct = Math.round((value / cost.standard) * 100);
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, textTransform: 'capitalize', color: 'var(--ink)' }}>{key}</span>
                  <span style={{ fontSize: 13, color: 'var(--steel)' }}>₹{value}L ({pct}%)</span>
                </div>
                <div style={{ height: 6, backgroundColor: 'var(--paper-dark)', borderRadius: 3 }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    backgroundColor: 'var(--blueprint-light)',
                    width: `${pct}%`,
                    opacity: 0.8,
                  }}/>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, padding: '16px', backgroundColor: 'var(--paper)', borderRadius: 6, fontSize: 12, color: 'var(--steel)', lineHeight: 1.7 }}>
          💡 <strong>Note:</strong> Rates are indicative for {project.requirements.location}. Final costs depend on contractor, material selection, current market rates, and site conditions. Recommend getting 3 contractor quotes.
        </div>
      </div>

      <IndiaCostPanel builtUp={optBuiltUp} location={project.requirements.location} projectName={`${project.name}_${optionId}`} />
    </div>
  );
}

function IndiaCostPanel({ builtUp, location, projectName }: { builtUp: number; location: string; projectName: string }) {
  const [tier, setTier] = useState<Tier>('standard');
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);

  if (!builtUp) return null;
  const cb = generateDetailedBOQ(builtUp, location, tier);
  const principal = cb.total * (1 - downPct / 100);
  const emi = calcEMI(principal, rate, years);

  const downloadQuote = () => {
    const csv = boqToCSV(cb, projectName);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${projectName.replace(/\s+/g, '_')}_Quotation.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const catTotals = cb.boq.reduce((m, l) => { m[l.category] = (m[l.category] || 0) + l.amount; return m; }, {} as Record<string, number>);

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400 }}>🇮🇳 Live Cost Engine & Contractor Quotation — <span style={{ color: 'var(--blueprint)' }}>{cb.city}</span></h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['economy', 'standard', 'premium'] as Tier[]).map(t => (
            <button key={t} onClick={() => setTier(t)} style={{
              padding: '7px 16px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', textTransform: 'capitalize',
              border: `1.5px solid ${tier === t ? 'var(--blueprint)' : 'var(--line-strong)'}`,
              backgroundColor: tier === t ? 'var(--blueprint)' : 'white', color: tier === t ? 'white' : 'var(--steel)',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Totals strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Subtotal (pre-GST)', val: formatINR(cb.subtotal), c: 'var(--ink)' },
          { label: 'GST (blended)', val: formatINR(cb.gstAmount), c: '#d97706' },
          { label: 'Grand Total', val: formatINR(cb.total), c: 'var(--blueprint)' },
          { label: 'All-in ₹/sq ft', val: `₹${cb.perSqftAllIn.toLocaleString('en-IN')}`, c: 'var(--amber)' },
        ].map((x, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--steel)', marginBottom: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{x.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: x.c, fontFamily: 'var(--font-display)' }}>{x.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 24 }}>
        {/* Detailed BOQ */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--blueprint)' }}>Contractor-Grade BOQ</span>
            <button onClick={downloadQuote} style={{ padding: '6px 14px', borderRadius: 4, border: '1.5px solid #16a34a', backgroundColor: 'white', color: '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>⬇ Export Quotation (CSV)</button>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ backgroundColor: 'var(--paper)', color: 'var(--steel)', position: 'sticky', top: 0 }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10 }}>ITEM</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>QTY</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>RATE</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: 10 }}>GST</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10 }}>AMOUNT</th>
              </tr></thead>
              <tbody>
                {cb.boq.map((l, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px 12px' }}><div style={{ color: 'var(--ink)' }}>{l.item}</div><div style={{ fontSize: 10, color: 'var(--steel)' }}>{l.category}</div></td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--steel)' }}>{l.qty.toLocaleString('en-IN')} {l.unit}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>₹{l.rate.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--steel)' }}>{l.gstPct}%</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* EMI calculator */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', padding: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>🏦 Home Loan EMI Calculator</h4>
          {[
            { label: `Down payment: ${downPct}%`, val: downPct, set: setDownPct, min: 0, max: 60, step: 5, suffix: `(${formatINR(cb.total * downPct / 100)})` },
            { label: `Interest rate: ${rate}% p.a.`, val: rate, set: setRate, min: 6, max: 14, step: 0.1, suffix: '' },
            { label: `Tenure: ${years} years`, val: years, set: setYears, min: 5, max: 30, step: 1, suffix: '' },
          ].map((s, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{s.label}</span><span style={{ color: 'var(--steel)', fontSize: 11 }}>{s.suffix}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.val} onChange={e => s.set(+e.target.value)} style={{ width: '100%', accentColor: 'var(--blueprint)' }} />
            </div>
          ))}
          <div style={{ marginTop: 20, padding: '18px', backgroundColor: 'var(--blueprint)', borderRadius: 8, textAlign: 'center', color: 'white' }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.08em', marginBottom: 4 }}>MONTHLY EMI</div>
            <div style={{ fontSize: 34, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{formatINR(emi.emi)}</div>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--steel)', lineHeight: 1.9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Loan amount</span><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatINR(emi.principal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total interest</span><span style={{ fontWeight: 600, color: '#d97706' }}>{formatINR(emi.totalInterest)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total payable</span><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{formatINR(emi.totalPayable)}</span></div>
          </div>

          {/* Category mini-breakdown */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => {
              const pct = Math.round((amt / cb.subtotal) * 100);
              return (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}><span style={{ color: 'var(--ink)' }}>{cat}</span><span style={{ color: 'var(--steel)' }}>{pct}%</span></div>
                  <div style={{ height: 5, backgroundColor: 'var(--paper-dark)', borderRadius: 3 }}><div style={{ height: '100%', width: `${pct}%`, backgroundColor: 'var(--blueprint-light)', borderRadius: 3 }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--steel)', marginTop: 16, fontStyle: 'italic' }}>City rates are 2026 market approximations including 18% blended GST. Use the exported quotation as a contractor negotiation baseline.</p>
    </div>
  );
}

function BOQTab({ project, layoutOptions, selectedLayoutId }: { project: Project; layoutOptions: LayoutOption[] | null; selectedLayoutId: 'option-a' | 'option-b' | 'option-c' }) {
  const [tier, setTier] = useState<Tier>('standard');
  const [optionId, setOptionId] = useState<'option-a' | 'option-b' | 'option-c'>(selectedLayoutId);
  const opt = layoutOptions?.find(o => o.id === optionId);
  const builtUp = optionBuiltUp(opt) || project.costEstimate?.builtUp || 1500;
  const cb = generateDetailedBOQ(builtUp, project.requirements.location, tier);

  const exportCSV = () => {
    const csv = boqToCSV(cb, `${project.name}_${optionId}`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${project.name}_${optionId}_BOQ.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <SectionTitle>Bill of Quantities</SectionTitle>
      <p style={{ color: 'var(--steel)', marginBottom: 14, fontWeight: 300 }}>
        Per-option, contractor-grade BOQ for {cb.city} — {builtUp.toLocaleString()} sq ft built-up. Concrete, steel, masonry, finishes, MEP, doors & windows with GST.
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {layoutOptions && layoutOptions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Option:</span>
            {layoutOptions.map((o, i) => (
              <button key={o.id} onClick={() => setOptionId(o.id)} style={{
                padding: '5px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
                border: `1.5px solid ${optionId === o.id ? 'var(--amber)' : 'var(--line-strong)'}`,
                backgroundColor: optionId === o.id ? 'var(--amber)' : 'white', color: optionId === o.id ? 'white' : 'var(--steel)', fontWeight: optionId === o.id ? 600 : 400,
              }}>{String.fromCharCode(65 + i)} · {optionBuiltUp(o).toLocaleString()} sqft</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['economy', 'standard', 'premium'] as Tier[]).map(t => (
            <button key={t} onClick={() => setTier(t)} style={{
              padding: '6px 16px', borderRadius: 4, textTransform: 'capitalize', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${tier === t ? 'var(--blueprint)' : 'var(--line-strong)'}`,
              backgroundColor: tier === t ? 'var(--blueprint)' : 'white', color: tier === t ? 'white' : 'var(--steel)',
            }}>{t}</button>
          ))}
        </div>
        <button onClick={exportCSV} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 4, border: '1.5px solid #16a34a', backgroundColor: 'white', color: '#16a34a', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⬇ Export BOQ (CSV)</button>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', backgroundColor: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--blueprint)', color: 'white' }}>
              {['Category', 'Item', 'Unit', 'Qty', 'Rate ₹', 'Amount ₹', 'GST'].map(h => (
                <th key={h} style={{ padding: '11px 12px', textAlign: h === 'Item' || h === 'Category' ? 'left' : 'right', fontWeight: 500, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cb.boq.map((l, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 ? '#fafaf9' : 'white', borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--steel)', fontSize: 11 }}>{l.category}</td>
                <td style={{ padding: '8px 12px' }}>{l.item}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{l.unit}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{l.qty.toLocaleString('en-IN')}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{l.rate.toLocaleString('en-IN')}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatINR(l.amount)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{l.gstPct}%</td>
              </tr>
            ))}
            <tr style={{ backgroundColor: 'rgba(26,39,68,0.04)', borderTop: '2px solid var(--blueprint)' }}>
              <td colSpan={5} style={{ padding: '12px', fontWeight: 600, color: 'var(--blueprint)' }}>Subtotal + GST {formatINR(cb.gstAmount)} → Grand Total ({tier})</td>
              <td colSpan={2} style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--blueprint)' }}>{formatINR(cb.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--steel)', lineHeight: 1.7 }}>
        * Quantities use standard Indian thumb-rules from this option&apos;s built-up area; rates are 2026 city approximations incl. GST. Confirm with detailed drawings & site measurement.
      </div>
    </div>
  );
}

function TimelineTab({ project }: { project: Project }) {
  const timeline = project.timeline || [];
  const maxWeek = Math.max(...timeline.map(t => t.endWeek));

  return (
    <div>
      <SectionTitle>Construction Timeline</SectionTitle>
      <p style={{ color: 'var(--steel)', marginBottom: 8, fontWeight: 300 }}>Estimated duration: {maxWeek} weeks ({Math.ceil(maxWeek / 4)} months)</p>
      <div style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: 100,
        backgroundColor: '#fff7ed', color: '#92400e',
        fontSize: 11, marginBottom: 32,
        border: '1px solid #fed7aa',
      }}>
        ⚠ Timeline is indicative. Actual schedule depends on contractor, weather, material availability, and approvals.
      </div>

      {/* Gantt-like view */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', backgroundColor: 'white' }}>
        {timeline.map((phase, i) => {
          const startPct = ((phase.startWeek - 1) / maxWeek) * 100;
          const widthPct = ((phase.endWeek - phase.startWeek + 1) / maxWeek) * 100;

          return (
            <div key={i} style={{
              display: 'flex', gap: 0,
              borderBottom: i < timeline.length - 1 ? '1px solid var(--line)' : 'none',
            }}>
              {/* Phase name */}
              <div style={{
                width: 220, flexShrink: 0,
                padding: '16px 20px',
                borderRight: '1px solid var(--line)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>{phase.phase}</div>
                <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>Week {phase.startWeek}–{phase.endWeek} · {phase.duration}</div>
              </div>

              {/* Gantt bar area */}
              <div style={{ flex: 1, padding: '20px 12px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '100%', height: 28, backgroundColor: 'var(--paper)', borderRadius: 4, position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    height: '100%',
                    backgroundColor: i % 3 === 0 ? 'var(--blueprint)' : i % 3 === 1 ? 'var(--blueprint-mid)' : 'var(--blueprint-light)',
                    borderRadius: 4,
                    opacity: 0.8,
                    display: 'flex', alignItems: 'center', paddingLeft: 8,
                  }}>
                    {widthPct > 10 && (
                      <span style={{ fontSize: 9, color: 'white', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                        {phase.duration}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div style={{ width: 220, flexShrink: 0, padding: '12px 16px', borderLeft: '1px solid var(--line)' }}>
                {phase.tasks.slice(0, 3).map((task, ti) => (
                  <div key={ti} style={{ fontSize: 11, color: 'var(--steel)', padding: '2px 0', display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--blueprint-light)', fontSize: 8, marginTop: 2 }}>●</span>
                    {task}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ByelawPanel({ project }: { project: Project }) {
  const ps = project.plotSettings;
  const [optionId, setOptionId] = useState<'option-a' | 'option-b' | 'option-c'>(project.selectedLayoutId || 'option-a');
  const opt = project.layoutOptions?.find(o => o.id === optionId) || project.layoutOptions?.[0];
  if (!ps || !opt) return null;
  const report = analyzeByelaws(opt.rooms, ps);
  const sc = report.score >= 85 ? '#16a34a' : report.score >= 65 ? '#d97706' : '#dc2626';
  const stColor = { pass: '#16a34a', warn: '#d97706', fail: '#dc2626' };
  const stIcon = { pass: '✓', warn: '!', fail: '✕' };

  const grouped = report.checks.reduce((m, c) => { (m[c.category] ||= []).push(c); return m; }, {} as Record<string, typeof report.checks>);

  return (
    <div style={{ marginBottom: 32 }}>
      {project.layoutOptions && project.layoutOptions.length > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Compliance for:</span>
          {project.layoutOptions.map((o, i) => (
            <button key={o.id} onClick={() => setOptionId(o.id)} style={{
              padding: '5px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${optionId === o.id ? 'var(--amber)' : 'var(--line-strong)'}`,
              backgroundColor: optionId === o.id ? 'var(--amber)' : 'white', color: optionId === o.id ? 'white' : 'var(--steel)', fontWeight: optionId === o.id ? 600 : 400,
            }}>{String.fromCharCode(65 + i)} · {o.name}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '20px 24px', border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', marginBottom: 20 }}>
        <ScoreRing score={report.score} label="Byelaw Score" color={sc} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 4 }}>Checked against</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--blueprint)', marginBottom: 4 }}>{report.city} + NBC 2016</div>
          <div style={{ fontSize: 12, color: 'var(--steel)', marginBottom: 14 }}>{report.cityNote}</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><span style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{report.summary.pass}</span> <span style={{ fontSize: 11, color: 'var(--steel)' }}>pass</span></div>
            <div><span style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{report.summary.warn}</span> <span style={{ fontSize: 11, color: 'var(--steel)' }}>warnings</span></div>
            <div><span style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{report.summary.fail}</span> <span style={{ fontSize: 11, color: 'var(--steel)' }}>failures</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { k: 'FAR / FSI', a: report.far.actual, r: `≤ ${report.far.required}`, s: report.far.status },
            { k: 'Ground coverage', a: `${Math.round(report.groundCoverage.actual * 100)}%`, r: `≤ ${Math.round(report.groundCoverage.required * 100)}%`, s: report.groundCoverage.status },
          ].map((x, i) => (
            <div key={i} style={{ minWidth: 150, padding: '10px 14px', borderRadius: 8, border: `1px solid ${stColor[x.s]}`, backgroundColor: x.s === 'pass' ? '#f0fdf4' : x.s === 'warn' ? '#fffbeb' : '#fef2f2' }}>
              <div style={{ fontSize: 11, color: 'var(--steel)' }}>{x.k}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: stColor[x.s] }}>{x.a} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--steel)' }}>{x.r}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', padding: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--blueprint)' }}>{cat}</h4>
            {items.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', backgroundColor: stColor[c.status] }}>{stIcon[c.status]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink)' }}>{c.item}</div>
                  <div style={{ fontSize: 10, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>need {c.required} · got {c.actual}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--steel)', marginTop: 14, fontStyle: 'italic' }}>Automated NBC + municipal byelaw pre-check. Final sanction requires a licensed architect&apos;s stamped drawings.</p>
    </div>
  );
}

function ComplianceTab({ project, complianceData }: { project: Project; complianceData: Record<string, unknown> | null }) {
  const req = project.requirements;

  const fallback = {
    setbacks: { front: '10 ft', rear: '5 ft', leftSide: '3 ft', rightSide: '3 ft' },
    fsi: { permissible: '1.8', proposed: `${((req.floors * req.plotWidth * req.plotDepth) / (req.plotWidth * req.plotDepth)).toFixed(1)}`, status: 'within limits' },
    height: { permissible: req.floors <= 2 ? '10m' : '15m', proposed: `${req.floors * 3}m` },
    parking: 'Minimum 1 car park per unit (as per local norms)',
    approvalChecklist: [
      'Building Plan Approval from local authority',
      'No-objection certificate from Fire Department (if >15m height)',
      'Environmental clearance (if plot >20,000 sq.m)',
      'Structural stability certificate from licensed engineer',
      'Electrical connection approval from DISCOM',
      'Water connection approval from municipal body',
      'Commencement Certificate before starting work',
      'Completion Certificate after construction',
    ],
    warningNotes: [
      'Setback requirements vary by zone — verify with local municipality',
      'FSI calculations must be confirmed with approved drawings',
      'Special permissions may be needed for corner plots',
    ],
  };

  const data = (complianceData as typeof fallback) || fallback;

  return (
    <div>
      <SectionTitle>Compliance & Approvals</SectionTitle>

      <ByelawPanel project={project} />

      <div style={{
        padding: '16px 20px', marginBottom: 32,
        backgroundColor: '#fef3c7', borderRadius: 6,
        fontSize: 13, color: '#92400e', lineHeight: 1.7,
        border: '1px solid #fde68a',
      }}>
        ⚠ <strong>These are estimated assumptions based on typical regulations for {req.location}.</strong> Always verify setbacks, FSI, height restrictions, and approval requirements with your local Municipal Corporation before design finalization.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Setbacks */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: '20px 24px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>Setback Requirements</h3>
          {Object.entries(data.setbacks || {}).map(([dir, val]) => (
            <div key={dir} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13, textTransform: 'capitalize', color: 'var(--ink)' }}>{dir.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--blueprint)' }}>{String(val)}</span>
            </div>
          ))}
        </div>

        {/* FSI & Height */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: '20px 24px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>FSI & Height</h3>
          {data.fsi && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>Permissible FSI</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{String(data.fsi.permissible || '')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>Proposed FSI</span>
                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{String(data.fsi.proposed || '')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>Status</span>
                <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 100, backgroundColor: '#f0fdf4', color: '#16a34a', fontWeight: 500 }}>
                  {String(data.fsi.status || '')}
                </span>
              </div>
            </>
          )}
          {data.height && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>Permissible Height</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{String((data.height as Record<string, string>).permissible || '')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--ink)' }}>Proposed Height</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{String((data.height as Record<string, string>).proposed || '')}</span>
              </div>
            </>
          )}
          <div style={{ marginTop: 12, padding: '10px', backgroundColor: 'var(--paper)', borderRadius: 4, fontSize: 12, color: 'var(--steel)' }}>
            Parking: {String(data.parking || '')}
          </div>
        </div>
      </div>

      {/* Approval Checklist */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: '24px', marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>Approval Checklist</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {(data.approvalChecklist || []).map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
              <div style={{
                width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                border: '1.5px solid var(--blueprint-light)',
                backgroundColor: 'rgba(74,114,196,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 10, color: 'var(--blueprint)' }}>□</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{String(item)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {(data.warningNotes || []).length > 0 && (
        <div style={{ border: '1px solid #fed7aa', borderRadius: 6, backgroundColor: '#fff7ed', padding: '20px 24px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#92400e' }}>Important Notes</h3>
          {(data.warningNotes || []).map((note, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <span style={{ color: '#c8853a', fontSize: 12, marginTop: 2 }}>⚠</span>
              <span style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>{String(note)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportTab({ project }: { project: Project }) {
  const rooms = project.layoutOptions?.find(o => o.id === (project.selectedLayoutId || 'option-a'))?.rooms ?? [];

  // PDF checklist state
  const [pdfChecklist, setPdfChecklist] = useState({
    coverPage: true,
    floorPlans: true,
    costEstimate: true,
    boq: true,
    timeline: true,
    complianceNotes: true,
    designNotes: true,
  });
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const checklistLabels: Record<keyof typeof pdfChecklist, string> = {
    coverPage: 'Cover Page & Project Summary',
    floorPlans: 'Floor Plans (All Floors)',
    costEstimate: 'Cost Estimation',
    boq: 'Bill of Quantities (BOQ)',
    timeline: 'Construction Timeline',
    complianceNotes: 'Compliance & Vastu Notes',
    designNotes: 'Design Narrative',
  };

  const handleGeneratePDF = async () => {
    setPdfGenerating(true);
    const req = project.requirements;
    const cost = project.costEstimate;

    const selectedRooms = rooms;
    const floorNums = [...new Set(selectedRooms.map(r => r.floor))].sort();
    const totalArea = selectedRooms.filter(r => r.type !== 'parking' && r.type !== 'garden' && r.floor === 0).reduce((s, r) => s + r.w * r.h, 0);

    const floorSVGs = floorNums.map(floor => {
      const fr = selectedRooms.filter(r => r.floor === floor);
      const scale = 4;
      const rects = fr.map(r => `
        <rect x="${r.x * scale}" y="${r.y * scale}" width="${r.w * scale}" height="${r.h * scale}" fill="#1a2744" stroke="#4a72c4" stroke-width="2"/>
        <text x="${(r.x + r.w / 2) * scale}" y="${(r.y + r.h / 2) * scale - 4}" fill="#e2e8f0" font-family="monospace" font-size="7" text-anchor="middle">${r.name.toUpperCase()}</text>
        <text x="${(r.x + r.w / 2) * scale}" y="${(r.y + r.h / 2) * scale + 8}" fill="#94a3b8" font-family="monospace" font-size="6" text-anchor="middle">${r.w}' × ${r.h}'</text>
      `).join('');
      const maxX = Math.max(...fr.map(r => (r.x + r.w) * scale), 100);
      const maxY = Math.max(...fr.map(r => (r.y + r.h) * scale), 80);
      return { floor, svg: `<svg width="${maxX + 20}" height="${maxY + 20}" viewBox="-10 -10 ${maxX + 20} ${maxY + 20}" xmlns="http://www.w3.org/2000/svg" style="background:#040811">${rects}</svg>` };
    });

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to export PDF.'); setPdfGenerating(false); return; }

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${project.name} — Design Report</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Georgia', serif; background: #f9f7f2; color: #1a2744; }
      @media print {
        .no-print { display: none !important; }
        .page-break { page-break-before: always; }
        body { background: white; }
      }
      .cover { min-height: 100vh; background: #1a2744; color: white; display: flex; flex-direction: column; justify-content: center; padding: 80px; }
      .cover h1 { font-size: 52px; font-weight: 300; line-height: 1.1; margin-bottom: 20px; }
      .cover .meta { font-family: monospace; font-size: 13px; opacity: 0.6; margin-bottom: 8px; }
      .cover .amber { color: #c8853a; }
      .section { padding: 60px 80px; border-bottom: 1px solid #e2d9cc; }
      .section h2 { font-size: 28px; font-weight: 400; margin-bottom: 8px; color: #1a2744; }
      .section .label { font-family: monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #c8853a; margin-bottom: 16px; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
      .card { border: 1px solid #e2d9cc; border-radius: 6px; padding: 20px; background: white; }
      .card .val { font-size: 32px; font-weight: 600; color: #1a2744; line-height: 1; }
      .card .lbl { font-size: 12px; color: #7a8a9a; margin-top: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
      th { background: #1a2744; color: white; padding: 10px 14px; text-align: left; font-family: monospace; font-size: 11px; letter-spacing: 0.08em; }
      td { padding: 9px 14px; border-bottom: 1px solid #f0ece4; }
      tr:nth-child(even) td { background: #faf8f4; }
      .disclaimer { background: #fff8f0; border: 1px solid #f59e0b; border-radius: 6px; padding: 20px; margin-top: 40px; font-size: 12px; line-height: 1.8; color: #7a5a1a; }
      .floor-plan-container { background: #040811; border-radius: 8px; padding: 20px; margin-top: 24px; }
      .floor-label { font-family: monospace; font-size: 11px; color: #c8853a; letter-spacing: 0.1em; margin-bottom: 10px; }
      .print-btn { position: fixed; top: 20px; right: 20px; padding: 12px 28px; background: #c8853a; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-family: sans-serif; z-index: 999; }
    </style></head><body>
    <button class="no-print print-btn" onclick="window.print()">🖨 Print / Save PDF</button>

    ${pdfChecklist.coverPage ? `
    <div class="cover">
      <div class="meta amber">ARCHCOPILOT — AI DESIGN REPORT</div>
      <div class="meta" style="margin-bottom:40px">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <h1>${project.name}</h1>
      <div style="height:2px;background:#c8853a;width:80px;margin:20px 0"></div>
      <div class="meta">${req.plotWidth}' × ${req.plotDepth}' PLOT &nbsp;·&nbsp; ${req.bhk} BHK &nbsp;·&nbsp; ${req.floors} FLOOR${req.floors > 1 ? 'S' : ''}</div>
      <div class="meta">${req.location} &nbsp;·&nbsp; ${req.style.toUpperCase()} STYLE &nbsp;·&nbsp; ₹${req.budget} LAKHS</div>
      <div style="margin-top:60px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;max-width:600px">
        <div><div style="font-size:28px;font-weight:600;color:#c8853a">${req.plotSize}</div><div style="font-size:11px;opacity:0.5;margin-top:4px">SQ YARDS</div></div>
        <div><div style="font-size:28px;font-weight:600;color:#c8853a">${totalArea}</div><div style="font-size:11px;opacity:0.5;margin-top:4px">SQ FT BUILT UP</div></div>
        <div><div style="font-size:28px;font-weight:600;color:#c8853a">${req.bhk}</div><div style="font-size:11px;opacity:0.5;margin-top:4px">BEDROOMS</div></div>
        <div><div style="font-size:28px;font-weight:600;color:#c8853a">${rooms.length}</div><div style="font-size:11px;opacity:0.5;margin-top:4px">TOTAL ROOMS</div></div>
      </div>
    </div>` : ''}

    ${pdfChecklist.floorPlans ? `
    <div class="section page-break">
      <div class="label">— Floor Plans</div>
      <h2>Layout Drawings</h2>
      ${floorSVGs.map(({ floor, svg }) => `
        <div style="margin-top:32px">
          <div class="floor-label">${floor === 0 ? 'GROUND FLOOR' : floor === 1 ? 'FIRST FLOOR' : 'SECOND FLOOR'} — SCALE 1:100 (APPROX)</div>
          <div class="floor-plan-container">${svg}</div>
        </div>
      `).join('')}
      <p style="font-size:11px;color:#7a8a9a;margin-top:16px;font-family:monospace">* Dimensions in feet. All plans are AI-generated preliminary concepts.</p>
    </div>` : ''}

    ${pdfChecklist.costEstimate && cost ? `
    <div class="section page-break">
      <div class="label">— Cost Estimation</div>
      <h2>Construction Cost Summary</h2>
      <div class="grid2">
        <div class="card"><div class="val">₹${(cost.economy / 100000).toFixed(1)}L</div><div class="lbl">Economy Estimate</div></div>
        <div class="card"><div class="val">₹${(cost.standard / 100000).toFixed(1)}L</div><div class="lbl">Standard Estimate</div></div>
        <div class="card"><div class="val">₹${(cost.premium / 100000).toFixed(1)}L</div><div class="lbl">Premium Estimate</div></div>
        <div class="card"><div class="val">${totalArea}</div><div class="lbl">Built-Up Area (sq ft)</div></div>
      </div>
      <table>
        <thead><tr><th>Component</th><th>Economy</th><th>Standard</th><th>Premium</th></tr></thead>
        <tbody>
          <tr><td>Structure & Foundation</td><td>₹${(cost.breakdown.structure * 0.85 / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.structure / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.structure * 1.3 / 100000).toFixed(1)}L</td></tr>
          <tr><td>Finishing & Interiors</td><td>₹${(cost.breakdown.finishing * 0.85 / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.finishing / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.finishing * 1.3 / 100000).toFixed(1)}L</td></tr>
          <tr><td>Electrical Works</td><td>₹${(cost.breakdown.electrical * 0.85 / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.electrical / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.electrical * 1.3 / 100000).toFixed(1)}L</td></tr>
          <tr><td>Plumbing & Sanitation</td><td>₹${(cost.breakdown.plumbing * 0.85 / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.plumbing / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.plumbing * 1.3 / 100000).toFixed(1)}L</td></tr>
          <tr><td>Interior Design</td><td>₹${(cost.breakdown.interiors * 0.85 / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.interiors / 100000).toFixed(1)}L</td><td>₹${(cost.breakdown.interiors * 1.3 / 100000).toFixed(1)}L</td></tr>
        </tbody>
      </table>
    </div>` : ''}

    ${pdfChecklist.boq && project.boq ? `
    <div class="section page-break">
      <div class="label">— Bill of Quantities</div>
      <h2>Material Schedule</h2>
      <table>
        <thead><tr><th>Material</th><th>Unit</th><th>Quantity</th><th>Economy Rate</th><th>Standard Rate</th><th>Premium Rate</th></tr></thead>
        <tbody>${project.boq.map(b => `<tr><td>${b.material}</td><td>${b.unit}</td><td>${b.quantity}</td><td>₹${b.rateEconomy}</td><td>₹${b.rateStandard}</td><td>₹${b.ratePremium}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : ''}

    ${pdfChecklist.timeline && project.timeline ? `
    <div class="section page-break">
      <div class="label">— Construction Timeline</div>
      <h2>Project Schedule</h2>
      <table>
        <thead><tr><th>Phase</th><th>Duration</th><th>Weeks</th><th>Key Tasks</th></tr></thead>
        <tbody>${project.timeline.map(t => `<tr><td>${t.phase}</td><td>${t.duration}</td><td>W${t.startWeek}–W${t.endWeek}</td><td>${t.tasks.slice(0, 2).join(', ')}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : ''}

    ${pdfChecklist.complianceNotes && project.complianceNotes ? `
    <div class="section page-break">
      <div class="label">— Compliance & Vastu</div>
      <h2>Regulatory Notes</h2>
      <ul style="margin-top:20px;padding-left:20px;line-height:2">${project.complianceNotes.map(n => `<li style="font-size:13px;color:#1a2744">${n}</li>`).join('')}</ul>
    </div>` : ''}

    ${pdfChecklist.designNotes && project.designNotes ? `
    <div class="section page-break">
      <div class="label">— Design Narrative</div>
      <h2>Design Concept</h2>
      <p style="font-size:14px;line-height:1.9;color:#3a4a5a;margin-top:20px;max-width:700px">${project.designNotes}</p>
    </div>` : ''}

    <div class="section">
      <div class="disclaimer">
        <strong>⚠ LEGAL DISCLAIMER:</strong> All drawings and documents in this package are AI-generated preliminary concepts for architectural review only.
        Structural calculations, electrical layouts, plumbing designs, HVAC plans, fire safety compliance, and municipality submission
        must be reviewed and stamped by licensed professionals. Do not use for construction without proper professional approval and municipal clearances.
      </div>
      <p style="font-size:11px;color:#aaa;margin-top:20px;font-family:monospace;text-align:center">Generated by ArchCopilot &nbsp;·&nbsp; ${new Date().toISOString()}</p>
    </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { setPdfGenerating(false); }, 1000);
  };

  const handleDownloadDXF = () => {
    if (rooms.length === 0) { alert('No layout selected. Please select a floor plan first.'); return; }
    import('@/lib/dxfExporter').then(({ exportToDXF }) => {
      const dxfContent = exportToDXF(rooms);
      const blob = new Blob([dxfContent], { type: 'application/dxf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '_')}_floor_plan.dxf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const handleDownloadSVG = () => {
    if (rooms.length === 0) { alert('No layout selected. Please select a floor plan first.'); return; }
    const scale = 8;
    const floorNums = [...new Set(rooms.map(r => r.floor))].sort();
    const svgParts = floorNums.map(floor => {
      const fr = rooms.filter(r => r.floor === floor);
      const maxX = Math.max(...fr.map(r => (r.x + r.w) * scale), 100);
      const maxY = Math.max(...fr.map(r => (r.y + r.h) * scale), 80);
      const rects = fr.map(r => `
        <rect x="${r.x * scale}" y="${r.y * scale}" width="${r.w * scale}" height="${r.h * scale}" fill="#1a2744" stroke="#4a72c4" stroke-width="2"/>
        <text x="${(r.x + r.w / 2) * scale}" y="${(r.y + r.h / 2) * scale - 4}" fill="#e2e8f0" font-family="monospace" font-size="9" text-anchor="middle">${r.name}</text>
        <text x="${(r.x + r.w / 2) * scale}" y="${(r.y + r.h / 2) * scale + 10}" fill="#94a3b8" font-family="monospace" font-size="7" text-anchor="middle">${r.w}' × ${r.h}'</text>
        ${r.doors.map(d => {
          const dw = d.width * scale; let dx = 0, dy = 0;
          if (d.side === 'front') { dx = (r.x + d.offset) * scale; dy = (r.y + r.h) * scale; return `<line x1="${dx}" y1="${dy}" x2="${dx + dw}" y2="${dy}" stroke="#f59e0b" stroke-width="3"/>`; }
          if (d.side === 'back') { dx = (r.x + d.offset) * scale; dy = r.y * scale; return `<line x1="${dx}" y1="${dy}" x2="${dx + dw}" y2="${dy}" stroke="#f59e0b" stroke-width="3"/>`; }
          if (d.side === 'left') { dx = r.x * scale; dy = (r.y + d.offset) * scale; return `<line x1="${dx}" y1="${dy}" x2="${dx}" y2="${dy + dw}" stroke="#f59e0b" stroke-width="3"/>`; }
          return `<line x1="${(r.x + r.w) * scale}" y1="${(r.y + d.offset) * scale}" x2="${(r.x + r.w) * scale}" y2="${(r.y + d.offset + d.width) * scale}" stroke="#f59e0b" stroke-width="3"/>`;
        }).join('')}
        ${r.windows.map(w => {
          if (w.side === 'front') return `<line x1="${(r.x + w.offset) * scale}" y1="${(r.y + r.h) * scale}" x2="${(r.x + w.offset + w.width) * scale}" y2="${(r.y + r.h) * scale}" stroke="#38bdf8" stroke-width="4"/>`;
          if (w.side === 'back') return `<line x1="${(r.x + w.offset) * scale}" y1="${r.y * scale}" x2="${(r.x + w.offset + w.width) * scale}" y2="${r.y * scale}" stroke="#38bdf8" stroke-width="4"/>`;
          if (w.side === 'left') return `<line x1="${r.x * scale}" y1="${(r.y + w.offset) * scale}" x2="${r.x * scale}" y2="${(r.y + w.offset + w.width) * scale}" stroke="#38bdf8" stroke-width="4"/>`;
          return `<line x1="${(r.x + r.w) * scale}" y1="${(r.y + w.offset) * scale}" x2="${(r.x + r.w) * scale}" y2="${(r.y + w.offset + w.width) * scale}" stroke="#38bdf8" stroke-width="4"/>`;
        }).join('')}
      `).join('');
      return `<g transform="translate(10, ${floor * (maxY + 60) + 30})" id="floor-${floor}">
        <text x="0" y="-10" fill="#c8853a" font-family="monospace" font-size="11" letter-spacing="2">${floor === 0 ? 'GROUND FLOOR' : floor === 1 ? 'FIRST FLOOR' : 'SECOND FLOOR'} — SCALE 1:100</text>
        <rect x="-5" y="-5" width="${maxX + 10}" height="${maxY + 10}" fill="#040811" rx="4"/>
        ${rects}
      </g>`;
    });
    const totalH = floorNums.length * 500 + 80;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${totalH}" viewBox="0 0 900 ${totalH}" style="background:#040811">\n${svgParts.join('\n')}\n</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_floor_plans.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const rows: string[] = ['Material,Unit,Quantity,Rate (Economy),Rate (Standard),Rate (Premium),Cost (Standard)'];
    if (project.boq && project.boq.length > 0) {
      project.boq.forEach(b => {
        rows.push(`"${b.material}","${b.unit}",${b.quantity},${b.rateEconomy},${b.rateStandard},${b.ratePremium},${(b.quantity * b.rateStandard).toFixed(0)}`);
      });
    } else {
      rows.push('"No BOQ data available","—","—","—","—","—","—"');
    }
    if (project.costEstimate) {
      rows.push('');
      rows.push('COST SUMMARY,,,,,,,');
      rows.push(`"Economy Total",,"₹${(project.costEstimate.economy / 100000).toFixed(1)} Lakhs",,,,`);
      rows.push(`"Standard Total",,"₹${(project.costEstimate.standard / 100000).toFixed(1)} Lakhs",,,,`);
      rows.push(`"Premium Total",,"₹${(project.costEstimate.premium / 100000).toFixed(1)} Lakhs",,,,`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_BOQ.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  };

  return (
    <div>
      <SectionTitle>Export Package</SectionTitle>
      <p style={{ color: 'var(--steel)', marginBottom: 40, fontWeight: 300 }}>
        Export your architectural design package in various formats for sharing and professional review.
      </p>

      {/* PDF Section with Checklist */}
      <div style={{ border: '1.5px solid var(--blueprint)', borderRadius: 10, backgroundColor: 'white', padding: '28px 32px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 32 }}>📄</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Complete Report (PDF)</div>
                <div style={{ fontSize: 13, color: 'var(--steel)' }}>Select which sections to include in the PDF</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', margin: '20px 0' }}>
              {(Object.keys(pdfChecklist) as (keyof typeof pdfChecklist)[]).map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
                  <input
                    type="checkbox"
                    checked={pdfChecklist[key]}
                    onChange={e => setPdfChecklist(p => ({ ...p, [key]: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: 'var(--blueprint)', cursor: 'pointer' }}
                  />
                  {checklistLabels[key]}
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={handleGeneratePDF}
            disabled={pdfGenerating || Object.values(pdfChecklist).every(v => !v)}
            style={{
              padding: '12px 28px', borderRadius: 6, border: 'none',
              backgroundColor: 'var(--blueprint)', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)', minWidth: 160,
              opacity: pdfGenerating ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {pdfGenerating ? '⏳ Generating…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>

      {/* Other exports grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {[
          {
            title: 'DXF Drawing',
            desc: 'AutoCAD-compatible file with all floors, room walls, doors, windows on separate layers (WALLS, DOORS, WINDOWS, LABELS)',
            icon: '◱',
            label: '⬇ Export DXF',
            accent: 'var(--blueprint)',
            action: handleDownloadDXF,
          },
          {
            title: 'Floor Plan (SVG)',
            desc: 'Scalable vector drawing with all floors, doors, and windows. Opens in Illustrator, Figma, Inkscape, browsers.',
            icon: '⊞',
            label: '⬇ Export SVG',
            accent: '#0891b2',
            action: handleDownloadSVG,
          },
          {
            title: 'BOQ Cost Report (CSV)',
            desc: 'Full Bill of Quantities with materials, quantities, and cost estimates. Opens directly in Excel / Google Sheets.',
            icon: '≡',
            label: '⬇ Export CSV',
            accent: '#16a34a',
            action: handleDownloadCSV,
          },
          {
            title: 'Project Data (JSON)',
            desc: 'Complete project object including all layouts, costs, BOQ, and timeline. Use for import or backups.',
            icon: '{ }',
            label: '⬇ Download JSON',
            accent: '#7c3aed',
            action: handleDownloadJSON,
          },
          {
            title: 'Share Link',
            desc: 'Copy a direct link to this project. Share with clients or team members who have access to this browser.',
            icon: '↗',
            label: copyDone ? '✓ Copied!' : '⎘ Copy Link',
            accent: copyDone ? '#16a34a' : '#c8853a',
            action: handleCopyLink,
          },
        ].map((item, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: 'var(--ink)' }}>{item.title}</div>
            <div style={{ fontSize: 12, color: 'var(--steel)', lineHeight: 1.6, flex: 1, marginBottom: 16 }}>{item.desc}</div>
            <button onClick={item.action} style={{ padding: '9px 0', borderRadius: 5, border: `1.5px solid ${item.accent}`, backgroundColor: 'white', color: item.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = item.accent; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = item.accent; }}>
              {item.label}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: '20px 24px', border: '1px solid #fde68a', borderRadius: 6, backgroundColor: '#fffbeb' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#92400e' }}>⚠ Legal Disclaimer</h3>
        <p style={{ fontSize: 12, color: '#78350f', lineHeight: 1.8 }}>
          All drawings and documents are AI-generated preliminary concepts for architectural review only.
          <strong> Structural calculations, electrical layouts, plumbing designs, HVAC plans, fire safety compliance, and municipality submission must be reviewed and stamped by licensed professionals.</strong>
        </p>
      </div>
    </div>
  );
}
