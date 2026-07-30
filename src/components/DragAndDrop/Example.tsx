import React, { useState } from 'react';

import { Draggable, Droppable } from './DnDComponents';
import { DnDProvider } from './DnDProvider';

interface Participant {
  id: string;
  name: string;
  type: 'participant';
}

interface Equipment {
  id: string;
  title: string;
  type: 'equipment';
}

type Resource = Participant | Equipment;

interface Team {
  id: string;
  name: string;
}

export default function App() {
  const [teams] = useState<Team[]>([
    { id: 'team-alpha', name: 'Team Alpha' },
    { id: 'team-beta', name: 'Team Beta' },
  ]);

  // Track which resource belongs to which team (or unassigned: null)
  const [resourceAssignments, setResourceAssignments] = useState<Record<string, string | null>>({
    p1: 'team-alpha',
    p2: 'team-alpha',
    p3: 'team-beta',
    e1: 'team-beta',
  });

  const resources: Resource[] = [
    { id: 'p1', name: 'Alex', type: 'participant' },
    { id: 'p2', name: 'Sam', type: 'participant' },
    { id: 'p3', name: 'Jordan', type: 'participant' },
    { id: 'e1', title: 'Camera Rig', type: 'equipment' },
  ];

  const handleDropOnTeam = (resource: Resource, targetTeamId: string | null) => {
    setResourceAssignments((prev) => ({
      ...prev,
      [resource.id]: targetTeamId,
    }));
  };

  const getTeamResources = (teamId: string | null) => resources.filter((res) => resourceAssignments[res.id] === teamId);

  return (
    <DnDProvider>
      <div style={{ padding: '32px', fontFamily: 'sans-serif' }}>
        <h2>Multi-Team Drag & Drop Test</h2>
        <p style={{ color: '#64748b' }}>Drag items between the two teams or move them back to the Unassigned pool (works on desktop mouse & mobile touch).</p>

        {/* Unassigned Items Pool */}
        <Droppable accepts={['participant', 'equipment']} onDrop={(item) => handleDropOnTeam(item, null)}>
          <div
            style={{
              marginBottom: '24px',
              padding: '16px',
              border: '2px dashed #cbd5e1',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              minHeight: '80px',
            }}
          >
            <h4 style={{ margin: '0 0 12px 0' }}>Unassigned Resources</h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {getTeamResources(null).map((item) => (
                <Draggable key={item.id} type={item.type} item={item}>
                  <ResourceCard resource={item} />
                </Draggable>
              ))}
              {getTeamResources(null).length === 0 && <span style={{ color: '#94a3b8', fontSize: '14px' }}>Drop items here to unassign them</span>}
            </div>
          </div>
        </Droppable>

        {/* Teams Container */}
        <div style={{ display: 'flex', gap: '24px' }}>
          {teams.map((team) => (
            <Droppable key={team.id} accepts={['participant', 'equipment']} onDrop={(item) => handleDropOnTeam(item, team.id)}>
              <div
                style={{
                  flex: 1,
                  minWidth: '240px',
                  minHeight: '260px',
                  border: '2px dashed #94a3b8',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <h3 style={{ margin: '0 0 16px 0' }}>
                  {team.name} ({getTeamResources(team.id).length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getTeamResources(team.id).map((item) => (
                    <Draggable key={item.id} type={item.type} item={item}>
                      <ResourceCard resource={item} />
                    </Draggable>
                  ))}
                  {getTeamResources(team.id).length === 0 && (
                    <div
                      style={{
                        padding: '24px',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '14px',
                      }}
                    >
                      Drop participants or equipment here
                    </div>
                  )}
                </div>
              </div>
            </Droppable>
          ))}
        </div>
      </div>
    </DnDProvider>
  );
}

// Reusable card renderer
const ResourceCard: React.FC<{ resource: Resource; isPreview?: boolean }> = ({ resource, isPreview }) => {
  const isParticipant = resource.type === 'participant';

  return (
    <div
      style={{
        padding: '10px 14px',
        backgroundColor: isPreview ? '#eff6ff' : '#ffffff',
        border: `1px solid ${isPreview ? '#2563eb' : '#cbd5e1'}`,
        borderRadius: '6px',
        boxShadow: isPreview ? '0 10px 15px -3px rgba(0, 0, 0, 0.2)' : '0 1px 2px rgba(0,0,0,0.05)',
        fontSize: '14px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span>{isParticipant ? '👤' : '📷'}</span>
      <span>{isParticipant ? resource.name : resource.title}</span>
    </div>
  );
};
