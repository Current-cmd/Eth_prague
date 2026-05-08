export interface Company {
  id: string
  name: string
  ens: string
  sector: string
  employees: number
}

export interface TaxonomyItem {
  id: string
  label: string
  glyph: string
  desc: string
}

export interface Subname {
  handle: string
  company: string
  status: 'active' | 'revoked' | 'pending'
  issued: string
  lastSeen: string
}

export interface Report {
  id: string
  company: string
  handle: string
  category: string
  date: string
  isNew?: boolean
  abstract: string
  proofHash: string
  ipfsHash: string
}

export const COMPANIES: Company[] = [
  { id: 'meridian', name: 'Meridian Energy',    ens: 'meridian.eth', sector: 'Energy',       employees: 9100 },
  { id: 'arcadia',  name: 'Arcadia Holdings',   ens: 'arcadia.eth',  sector: 'Asset Mgmt',   employees: 4200 },
  { id: 'helix',    name: 'Helix Agro',         ens: 'helix.eth',    sector: 'Agribusiness', employees: 1820 },
  { id: 'kestrel',  name: 'Kestrel Logistics',  ens: 'kestrel.eth',  sector: 'Shipping',     employees: 2600 },
]

export const TAXONOMY: TaxonomyItem[] = [
  { id: 'misconduct', label: 'Misconduct',              glyph: '§', desc: 'Verifiable breach of regulation or stated policy.' },
  { id: 'selective',  label: 'Selective Disclosure',    glyph: '◐', desc: 'Material data omitted from public reporting.' },
  { id: 'misclass',   label: 'Misclassification',       glyph: '◇', desc: 'Activity recategorized to evade scrutiny.' },
  { id: 'hollow',     label: 'Hollow Promise',          glyph: '◬', desc: 'Public commitment without internal plan or budget.' },
  { id: 'inname',     label: 'In Name Only',            glyph: '∅', desc: 'Initiative branded but not operationally implemented.' },
  { id: 'misleading', label: 'Misleading Presentation', glyph: '⊘', desc: 'Accurate figures arranged to imply a false conclusion.' },
]

export const SUBNAMES: Subname[] = [
  { handle: 'anon-7x3k', company: 'arcadia', status: 'active',  issued: '2026-04-19', lastSeen: '2026-05-01' },
  { handle: 'anon-q92m', company: 'arcadia', status: 'active',  issued: '2026-04-22', lastSeen: '2026-04-30' },
  { handle: 'anon-bf04', company: 'arcadia', status: 'active',  issued: '2026-05-02', lastSeen: '—' },
  { handle: 'anon-vd1n', company: 'arcadia', status: 'revoked', issued: '2026-02-11', lastSeen: '2026-03-08' },
  { handle: 'anon-c7ts', company: 'arcadia', status: 'active',  issued: '2026-03-30', lastSeen: '2026-04-28' },
  { handle: 'anon-9hke', company: 'arcadia', status: 'pending', issued: '2026-05-07', lastSeen: '—' },
  { handle: 'anon-z2pa', company: 'arcadia', status: 'revoked', issued: '2025-12-04', lastSeen: '2026-01-20' },
  { handle: 'anon-mr8j', company: 'arcadia', status: 'active',  issued: '2026-01-17', lastSeen: '2026-04-29' },
]

export const REPORTS: Report[] = [
  {
    id: 'SP-2026-0418',
    company: 'meridian',
    handle: 'anon-r8mz',
    category: 'misleading',
    date: '2026-05-06T14:22:00Z',
    isNew: true,
    abstract: 'Scope 1 emissions reported for the Belmont facility were calculated using a 2019 baseline factor that has since been retired by the IPCC. Restating with the current factor raises the figure by 31.4% — above the threshold for mandatory disclosure under EU CSRD Article 29b.',
    proofHash: '0x9a3f12b8c4e7b1d4a6f0e8c2',
    ipfsHash:  'bafybeih2qd4xkmjwz4fnq3a7tk6wuvxkzcnnp42q5ymf',
  },
  {
    id: 'SP-2026-0417',
    company: 'arcadia',
    handle: 'anon-7x3k',
    category: 'inname',
    date: '2026-05-05T09:11:00Z',
    isNew: true,
    abstract: "The \"Net Zero Transition Fund\" marketed to institutional clients holds 41% of NAV in companies excluded by the fund's own published screening criteria. Three named portfolio managers approved each exception via email.",
    proofHash: '0x5b1e09a2f4d3c8e7b2a1f6c4',
    ipfsHash:  'bafkreigi5z2v7y4kpr8n9e2tx3wu7jc5xkqnv6h2',
  },
  {
    id: 'SP-2026-0413',
    company: 'helix',
    handle: 'anon-vk2x',
    category: 'selective',
    date: '2026-05-02T18:40:00Z',
    abstract: 'Pesticide residue testing for the 2025 harvest excluded the three sites with the highest historical readings. Internal sampling protocol calls for stratified inclusion; the exclusion was not flagged in the published sustainability report.',
    proofHash: '0xc0a7be95613a0f4f2c8d1b97',
    ipfsHash:  'bafybeibcz3ymq8tn5p2v6yrxj9k4tcp7wxqzvm3a',
  },
  {
    id: 'SP-2026-0411',
    company: 'kestrel',
    handle: 'anon-jx4u',
    category: 'misclass',
    date: '2026-04-29T11:05:00Z',
    abstract: '2,400 short-haul diesel trips were logged as "rail-equivalent" in the FY2025 carbon ledger after a unilateral re-coding by mid-tier ops staff. Original GPS telemetry is preserved on the dispatch server.',
    proofHash: '0x33ef2c9b1a6e7d8c5b2a4901',
    ipfsHash:  'bafkreif5mq2z9w3xtyck7hr8jp6v4xnvbzqp1c8d',
  },
  {
    id: 'SP-2026-0408',
    company: 'meridian',
    handle: 'anon-c7ts',
    category: 'hollow',
    date: '2026-04-26T16:33:00Z',
    abstract: 'The publicly stated 2030 methane-reduction commitment is not present in any approved capex plan. The internal abatement budget for FY2026 is $0; FY2027 is unfunded.',
    proofHash: '0x71ab4d05c2e9f3b8a6c40d12',
    ipfsHash:  'bafybeihfw3p4kzwrn5q9c7xtby8jvmep2znqx0a6',
  },
  {
    id: 'SP-2026-0405',
    company: 'arcadia',
    handle: 'anon-q92m',
    category: 'misconduct',
    date: '2026-04-22T08:14:00Z',
    abstract: "Carbon offset certificates retired in 2025 against the firm's stated portfolio footprint were sourced from a registry placed under regulatory review in February 2024. The retirement was not disclosed to limited partners.",
    proofHash: '0x4c8b2e6d1f9a7c3e8b5d201f',
    ipfsHash:  'bafybeic7xz4w8mq2vp6yt3hr5kn9jp4cxbzvm1a0',
  },
  {
    id: 'SP-2026-0402',
    company: 'helix',
    handle: 'anon-h3df',
    category: 'misleading',
    date: '2026-04-19T13:50:00Z',
    abstract: 'Water-use intensity figures in the 2025 ESG summary use revenue as the denominator rather than tonnage produced. The tonnage-based metric — used internally — shows a 22% increase over the same period.',
    proofHash: '0xa9f307b15c2d8e4b6a0c1d57',
    ipfsHash:  'bafkreih2pmq5x7y9kc8vt4jr3wn6zp1xv0bcq8d5',
  },
  {
    id: 'SP-2026-0331',
    company: 'kestrel',
    handle: 'anon-uy7g',
    category: 'inname',
    date: '2026-03-31T20:28:00Z',
    abstract: 'The "Sustainable Routing Initiative" has no dedicated staff, no measurement framework, and no review cadence. It exists as a marketing page and a quarterly slide.',
    proofHash: '0x82c4e1a905bd6f7c3a8b2e14',
    ipfsHash:  'bafybeig5x3p7qmz2vy6k8wtcr4n9jh1bvcxz0pd6',
  },
]
