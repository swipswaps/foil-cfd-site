import repoDescriptions from './repo-descriptions.json';

export interface Project {
  name: string;
  url: string;
  pagesUrl?: string;
  description: string;
  tags: string[];
  category: 'cfd' | '3d' | 'cad';
}

const descriptions = repoDescriptions as Record<string, string>;

const desc = (name: string, fallback: string): string => {
  const d = descriptions[name];
  return d && d.trim().length > 0 ? d : fallback;
};

export const projects: Project[] = [
  {
    name: 'foil-cfd-site',
    url: 'https://github.com/swipswaps/foil-cfd-site',
    pagesUrl: 'https://swipswaps.github.io/foil-cfd-site/',
    description: desc('foil-cfd-site', 'NACA 16-series airfoil hero scene with real-time flow particles.'),
    tags: ['Three.js', 'R3F', 'Vite', 'NACA'],
    category: 'cfd',
  },
  {
    name: 'solar-nostoc-cad-bridge',
    url: 'https://github.com/swipswaps/solar-nostoc-cad-bridge',
    description: desc('solar-nostoc-cad-bridge', 'CAD bridge for solar Nostoc systems.'),
    tags: ['CAD', 'Solar'],
    category: 'cad',
  },
  {
    name: 'solar-panel-cad-bridge',
    url: 'https://github.com/swipswaps/solar-panel-cad-bridge',
    description: desc('solar-panel-cad-bridge', 'CAD bridge for solar panel design.'),
    tags: ['CAD', 'STL', 'Solar'],
    category: 'cad',
  },
  {
    name: 'LECDS-Configurator',
    url: 'https://github.com/swipswaps/LECDS-Configurator',
    description: desc('LECDS-Configurator', 'Configurator for LECDS systems.'),
    tags: ['Configurator', 'Systems'],
    category: 'cad',
  },
  {
    name: 'Solar-Farm-Feasibility-Engine',
    url: 'https://github.com/swipswaps/Solar-Farm-Feasibility-Engine',
    description: desc('Solar-Farm-Feasibility-Engine', 'Feasibility engine for solar farm projects.'),
    tags: ['Solar', 'Feasibility'],
    category: 'cad',
  },
  {
    name: 'video_flow_cfd_tool',
    url: 'https://github.com/swipswaps/video_flow_cfd_tool',
    description: desc('video_flow_cfd_tool', 'CFD tooling for extracting flow data from video.'),
    tags: ['CFD', 'Video', 'Flow'],
    category: 'cfd',
  },
  {
    name: 'parachute-cfd-game',
    url: 'https://github.com/swipswaps/parachute-cfd-game',
    description: desc('parachute-cfd-game', 'CFD parachute simulation with game interface.'),
    tags: ['CFD', 'Game'],
    category: 'cfd',
  },
  {
    name: 'lost-pla-explainer',
    url: 'https://github.com/swipswaps/lost-pla-explainer',
    pagesUrl: 'https://swipswaps.github.io/lost-pla-explainer/',
    description: desc('lost-pla-explainer', 'Three.js explainer for lost-PLA aluminum casting.'),
    tags: ['Three.js', 'Casting'],
    category: '3d',
  },
];
