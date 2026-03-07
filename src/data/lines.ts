import { stations } from './stations'

export interface Line {
  id: string
  name: string
  color: string
  stationIds: string[]
}

export const lines: Line[] = [
  {
    id: '1',
    name: 'Line 1 Yonge-University',
    color: '#FFCC29',
    stationIds: [
      // Yonge branch (south from Finch)
      'finch', 'north-york-centre', 'sheppard-yonge', 'york-mills', 'lawrence',
      'eglinton', 'davisville', 'st-clair', 'summerhill', 'rosedale',
      'bloor-yonge', 'wellesley', 'college', 'dundas', 'queen', 'king', 'union',
      // University branch (north from Union)
      'st-andrew', 'osgoode', 'st-patrick', 'queens-park', 'museum',
      'st-george', 'spadina-line1', 'dupont', 'bathurst-line1',
      'eglinton-west', 'glencairn', 'lawrence-west', 'yorkdale', 'wilson',
      'sheppard-west', 'downsview-park', 'finch-west', 'york-university',
      'pioneer-village', 'highway-407', 'vaughan-mc',
    ],
  },
  {
    id: '2',
    name: 'Line 2 Bloor-Danforth',
    color: '#00A859',
    stationIds: [
      'kipling', 'islington', 'royal-york', 'old-mill', 'jane', 'runnymede',
      'high-park', 'keele', 'dundas-west', 'lansdowne', 'dufferin', 'ossington',
      'christie', 'bathurst-line2', 'spadina-line1', 'st-george', 'bay',
      'bloor-yonge', 'sherbourne', 'castle-frank', 'broadview', 'chester',
      'pape', 'donlands', 'greenwood', 'coxwell', 'woodbine', 'main-street',
      'victoria-park', 'warden', 'kennedy',
    ],
  },
  {
    id: '4',
    name: 'Line 4 Sheppard',
    color: '#A900A9',
    stationIds: [
      'sheppard-yonge', 'bayview', 'bessarion', 'leslie', 'don-mills',
    ],
  },
  {
    id: '5',
    name: 'Line 5 Eglinton',
    color: '#FF6E1E',
    stationIds: [
      'mount-dennis', 'keelesdale', 'caledonia', 'fairbank', 'oakwood',
      'eglinton-west', 'forest-hill', 'chaplin', 'avenue',
      'eglinton', 'mount-pleasant', 'leaside', 'laird',
      'sunnybrook-park', 'don-valley', 'aga-khan', 'wynford', 'sloane',
      'oconnor', 'pharmacy', 'hakimi-lebovic', 'golden-mile',
      'birchmount', 'ionview', 'kennedy',
    ],
  },
]

// Build adjacency graph for pathfinding
export interface GraphEdge {
  to: string
  line: string
  weight: number // minutes
}

export const graph = new Map<string, GraphEdge[]>()

function addEdge(from: string, to: string, lineId: string, weight: number) {
  if (!graph.has(from)) graph.set(from, [])
  if (!graph.has(to)) graph.set(to, [])
  graph.get(from)!.push({ to, line: lineId, weight })
  graph.get(to)!.push({ to: from, line: lineId, weight })
}

// Build edges from line definitions
const stationMap = new Map(stations.map((s) => [s.id, s]))

for (const line of lines) {
  for (let i = 0; i < line.stationIds.length - 1; i++) {
    const a = stationMap.get(line.stationIds[i])
    const b = stationMap.get(line.stationIds[i + 1])
    if (a && b) {
      // Estimate ~2 min between stations
      addEdge(a.id, b.id, line.id, 2)
    }
  }
}

// Transfers are implicit since shared stations appear in multiple lines

export function getLineById(id: string): Line | undefined {
  return lines.find((l) => l.id === id)
}

export function getLineColor(id: string): string {
  return getLineById(id)?.color ?? '#888'
}

// Get polyline coordinates for a line
export function getLineCoords(line: Line): [number, number][][] {
  // Line 1 is U-shaped: split at Union
  if (line.id === '1') {
    const yongeBranch = line.stationIds.slice(0, 17) // Finch to Union
    const universityBranch = ['union', ...line.stationIds.slice(17)]
    return [
      yongeBranch
        .map((id) => stationMap.get(id))
        .filter(Boolean)
        .map((s) => [s!.lat, s!.lng] as [number, number]),
      universityBranch
        .map((id) => stationMap.get(id))
        .filter(Boolean)
        .map((s) => [s!.lat, s!.lng] as [number, number]),
    ]
  }
  return [
    line.stationIds
      .map((id) => stationMap.get(id))
      .filter(Boolean)
      .map((s) => [s!.lat, s!.lng] as [number, number]),
  ]
}
