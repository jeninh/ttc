export interface Station {
  id: string
  name: string
  lat: number
  lng: number
  lines: string[]
}

// All TTC subway/rapid transit stations with accurate coordinates
export const stations: Station[] = [
  // Line 1 Yonge-University (yellow)
  { id: 'finch', name: 'Finch', lat: 43.7806, lng: -79.4149, lines: ['1'] },
  { id: 'north-york-centre', name: 'North York Centre', lat: 43.7688, lng: -79.4127, lines: ['1'] },
  { id: 'sheppard-yonge', name: 'Sheppard-Yonge', lat: 43.7616, lng: -79.4111, lines: ['1', '4'] },
  { id: 'york-mills', name: 'York Mills', lat: 43.7440, lng: -79.4067, lines: ['1'] },
  { id: 'lawrence', name: 'Lawrence', lat: 43.7255, lng: -79.4024, lines: ['1'] },
  { id: 'eglinton', name: 'Eglinton', lat: 43.7066, lng: -79.3984, lines: ['1', '5'] },
  { id: 'davisville', name: 'Davisville', lat: 43.6976, lng: -79.3971, lines: ['1'] },
  { id: 'st-clair', name: 'St Clair', lat: 43.6884, lng: -79.3931, lines: ['1'] },
  { id: 'summerhill', name: 'Summerhill', lat: 43.6820, lng: -79.3910, lines: ['1'] },
  { id: 'rosedale', name: 'Rosedale', lat: 43.6768, lng: -79.3887, lines: ['1'] },
  { id: 'bloor-yonge', name: 'Bloor-Yonge', lat: 43.6710, lng: -79.3857, lines: ['1', '2'] },
  { id: 'wellesley', name: 'Wellesley', lat: 43.6654, lng: -79.3841, lines: ['1'] },
  { id: 'college', name: 'College', lat: 43.6614, lng: -79.3832, lines: ['1'] },
  { id: 'dundas', name: 'Dundas', lat: 43.6565, lng: -79.3806, lines: ['1'] },
  { id: 'queen', name: 'Queen', lat: 43.6522, lng: -79.3790, lines: ['1'] },
  { id: 'king', name: 'King', lat: 43.6490, lng: -79.3776, lines: ['1'] },
  { id: 'union', name: 'Union', lat: 43.6455, lng: -79.3807, lines: ['1'] },
  { id: 'st-andrew', name: 'St Andrew', lat: 43.6476, lng: -79.3847, lines: ['1'] },
  { id: 'osgoode', name: 'Osgoode', lat: 43.6507, lng: -79.3869, lines: ['1'] },
  { id: 'st-patrick', name: 'St Patrick', lat: 43.6548, lng: -79.3886, lines: ['1'] },
  { id: 'queens-park', name: "Queen's Park", lat: 43.6600, lng: -79.3905, lines: ['1'] },
  { id: 'museum', name: 'Museum', lat: 43.6672, lng: -79.3935, lines: ['1'] },
  { id: 'spadina-line1', name: 'Spadina', lat: 43.6674, lng: -79.4039, lines: ['1', '2'] },
  { id: 'st-george', name: 'St George', lat: 43.6683, lng: -79.3998, lines: ['1', '2'] },
  { id: 'dupont', name: 'Dupont', lat: 43.6749, lng: -79.4069, lines: ['1'] },
  { id: 'bathurst-line1', name: 'Bathurst', lat: 43.6816, lng: -79.4115, lines: ['1'] },
  { id: 'glencairn', name: 'Glencairn', lat: 43.7088, lng: -79.4412, lines: ['1'] },
  { id: 'lawrence-west', name: 'Lawrence West', lat: 43.7157, lng: -79.4443, lines: ['1'] },
  { id: 'yorkdale', name: 'Yorkdale', lat: 43.7245, lng: -79.4476, lines: ['1'] },
  { id: 'wilson', name: 'Wilson', lat: 43.7339, lng: -79.4504, lines: ['1'] },
  { id: 'sheppard-west', name: 'Sheppard West', lat: 43.7498, lng: -79.4620, lines: ['1'] },
  { id: 'downsview-park', name: 'Downsview Park', lat: 43.7537, lng: -79.4788, lines: ['1'] },
  { id: 'finch-west', name: 'Finch West', lat: 43.7654, lng: -79.4910, lines: ['1'] },
  { id: 'york-university', name: 'York University', lat: 43.7741, lng: -79.4998, lines: ['1'] },
  { id: 'pioneer-village', name: 'Pioneer Village', lat: 43.7775, lng: -79.5098, lines: ['1'] },
  { id: 'highway-407', name: 'Highway 407', lat: 43.7832, lng: -79.5234, lines: ['1'] },
  { id: 'vaughan-mc', name: 'Vaughan Metropolitan Centre', lat: 43.7936, lng: -79.5275, lines: ['1'] },
  { id: 'eglinton-west', name: 'Cedarvale', lat: 43.6994, lng: -79.4358, lines: ['1', '5'] },

  // Line 2 Bloor-Danforth (green)
  { id: 'kipling', name: 'Kipling', lat: 43.6372, lng: -79.5357, lines: ['2'] },
  { id: 'islington', name: 'Islington', lat: 43.6375, lng: -79.5246, lines: ['2'] },
  { id: 'royal-york', name: 'Royal York', lat: 43.6362, lng: -79.5112, lines: ['2'] },
  { id: 'old-mill', name: 'Old Mill', lat: 43.6499, lng: -79.4950, lines: ['2'] },
  { id: 'jane', name: 'Jane', lat: 43.6498, lng: -79.4842, lines: ['2'] },
  { id: 'runnymede', name: 'Runnymede', lat: 43.6515, lng: -79.4756, lines: ['2'] },
  { id: 'high-park', name: 'High Park', lat: 43.6539, lng: -79.4668, lines: ['2'] },
  { id: 'keele', name: 'Keele', lat: 43.6558, lng: -79.4597, lines: ['2'] },
  { id: 'dundas-west', name: 'Dundas West', lat: 43.6568, lng: -79.4528, lines: ['2'] },
  { id: 'lansdowne', name: 'Lansdowne', lat: 43.6593, lng: -79.4424, lines: ['2'] },
  { id: 'dufferin', name: 'Dufferin', lat: 43.6600, lng: -79.4355, lines: ['2'] },
  { id: 'ossington', name: 'Ossington', lat: 43.6624, lng: -79.4264, lines: ['2'] },
  { id: 'christie', name: 'Christie', lat: 43.6642, lng: -79.4185, lines: ['2'] },
  { id: 'bathurst-line2', name: 'Bathurst', lat: 43.6660, lng: -79.4111, lines: ['2'] },
  // Spadina & St George are already listed with both lines
  { id: 'bay', name: 'Bay', lat: 43.6703, lng: -79.3900, lines: ['2'] },
  // Bloor-Yonge already listed with both lines
  { id: 'sherbourne', name: 'Sherbourne', lat: 43.6722, lng: -79.3765, lines: ['2'] },
  { id: 'castle-frank', name: 'Castle Frank', lat: 43.6738, lng: -79.3686, lines: ['2'] },
  { id: 'broadview', name: 'Broadview', lat: 43.6768, lng: -79.3586, lines: ['2'] },
  { id: 'chester', name: 'Chester', lat: 43.6784, lng: -79.3520, lines: ['2'] },
  { id: 'pape', name: 'Pape', lat: 43.6800, lng: -79.3449, lines: ['2'] },
  { id: 'donlands', name: 'Donlands', lat: 43.6812, lng: -79.3373, lines: ['2'] },
  { id: 'greenwood', name: 'Greenwood', lat: 43.6826, lng: -79.3301, lines: ['2'] },
  { id: 'coxwell', name: 'Coxwell', lat: 43.6841, lng: -79.3230, lines: ['2'] },
  { id: 'woodbine', name: 'Woodbine', lat: 43.6865, lng: -79.3127, lines: ['2'] },
  { id: 'main-street', name: 'Main Street', lat: 43.6891, lng: -79.3013, lines: ['2'] },
  { id: 'victoria-park', name: 'Victoria Park', lat: 43.6930, lng: -79.2893, lines: ['2'] },
  { id: 'warden', name: 'Warden', lat: 43.6971, lng: -79.2798, lines: ['2'] },
  { id: 'kennedy', name: 'Kennedy', lat: 43.7326, lng: -79.2638, lines: ['2', '5'] },

  // Line 4 Sheppard (purple)
  // Sheppard-Yonge already listed
  { id: 'bayview', name: 'Bayview', lat: 43.7668, lng: -79.3870, lines: ['4'] },
  { id: 'bessarion', name: 'Bessarion', lat: 43.7692, lng: -79.3764, lines: ['4'] },
  { id: 'leslie', name: 'Leslie', lat: 43.7713, lng: -79.3659, lines: ['4'] },
  { id: 'don-mills', name: 'Don Mills', lat: 43.7757, lng: -79.3462, lines: ['4'] },

  // Line 5 Eglinton (orange)
  { id: 'mount-dennis', name: 'Mount Dennis', lat: 43.6908, lng: -79.5065, lines: ['5'] },
  { id: 'keelesdale', name: 'Keelesdale', lat: 43.6920, lng: -79.4838, lines: ['5'] },
  { id: 'caledonia', name: 'Caledonia', lat: 43.6932, lng: -79.4680, lines: ['5'] },
  { id: 'fairbank', name: 'Fairbank', lat: 43.6944, lng: -79.4509, lines: ['5'] },
  { id: 'oakwood', name: 'Oakwood', lat: 43.6959, lng: -79.4380, lines: ['5'] },
  // Cedarvale (eglinton-west) already listed with Line 1
  { id: 'forest-hill', name: 'Forest Hill', lat: 43.6985, lng: -79.4188, lines: ['5'] },
  { id: 'chaplin', name: 'Chaplin', lat: 43.6995, lng: -79.4080, lines: ['5'] },
  { id: 'avenue', name: 'Avenue', lat: 43.7010, lng: -79.3981, lines: ['5'] },
  // Eglinton (eglinton) already listed with Line 1
  { id: 'mount-pleasant', name: 'Mount Pleasant', lat: 43.7052, lng: -79.3868, lines: ['5'] },
  { id: 'leaside', name: 'Leaside', lat: 43.7058, lng: -79.3755, lines: ['5'] },
  { id: 'laird', name: 'Laird', lat: 43.7058, lng: -79.3630, lines: ['5'] },
  { id: 'sunnybrook-park', name: 'Sunnybrook Park', lat: 43.7140, lng: -79.3524, lines: ['5'] },
  { id: 'don-valley', name: 'Don Valley', lat: 43.7168, lng: -79.3383, lines: ['5'] },
  { id: 'aga-khan', name: 'Aga Khan Park & Museum', lat: 43.7252, lng: -79.3316, lines: ['5'] },
  { id: 'wynford', name: 'Wynford', lat: 43.7278, lng: -79.3264, lines: ['5'] },
  { id: 'sloane', name: 'Sloane', lat: 43.7301, lng: -79.3164, lines: ['5'] },
  { id: 'oconnor', name: "O'Connor", lat: 43.7321, lng: -79.3022, lines: ['5'] },
  { id: 'pharmacy', name: 'Pharmacy', lat: 43.7330, lng: -79.2928, lines: ['5'] },
  { id: 'hakimi-lebovic', name: 'Hakimi Lebovic', lat: 43.7335, lng: -79.2852, lines: ['5'] },
  { id: 'golden-mile', name: 'Golden Mile', lat: 43.7340, lng: -79.2790, lines: ['5'] },
  { id: 'birchmount', name: 'Birchmount', lat: 43.7340, lng: -79.2716, lines: ['5'] },
  { id: 'ionview', name: 'Ionview', lat: 43.7337, lng: -79.2665, lines: ['5'] },
  // Kennedy (kennedy) already listed with Line 2
]

export const stationMap = new Map(stations.map((s) => [s.id, s]))

export function findNearestStation(lat: number, lng: number): Station {
  let best = stations[0]
  let bestDist = Infinity
  for (const s of stations) {
    const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  return best
}

export interface NearbyStation {
  station: Station
  distKm: number
  walkMin: number
}

export function findNearestStations(lat: number, lng: number, count = 5): NearbyStation[] {
  return stations
    .map((s) => {
      const distKm = haversineKm(lat, lng, s.lat, s.lng)
      return { station: s, distKm, walkMin: Math.max(1, Math.round(distKm / 0.083)) }
    })
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, count)
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
