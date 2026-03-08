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
      'finch', 'north-york-centre', 'sheppard-yonge', 'york-mills', 'lawrence',
      'eglinton', 'davisville', 'st-clair', 'summerhill', 'rosedale',
      'bloor-yonge', 'wellesley', 'college', 'dundas', 'queen', 'king', 'union',
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
    stationIds: ['sheppard-yonge', 'bayview', 'bessarion', 'leslie', 'don-mills'],
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

export interface GraphEdge {
  to: string
  line: string
  weight: number
}

export const graph = new Map<string, GraphEdge[]>()

function addEdge(from: string, to: string, lineId: string, weight: number) {
  if (!graph.has(from)) graph.set(from, [])
  if (!graph.has(to)) graph.set(to, [])
  graph.get(from)!.push({ to, line: lineId, weight })
  graph.get(to)!.push({ to: from, line: lineId, weight })
}

const stationMap2 = new Map(stations.map((s) => [s.id, s]))

for (const line of lines) {
  for (let i = 0; i < line.stationIds.length - 1; i++) {
    const a = stationMap2.get(line.stationIds[i])
    const b = stationMap2.get(line.stationIds[i + 1])
    if (a && b) addEdge(a.id, b.id, line.id, 2)
  }
}

export function getLineById(id: string): Line | undefined {
  return lines.find((l) => l.id === id)
}
