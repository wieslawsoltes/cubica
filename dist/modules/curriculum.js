import { CubeState, parseAlgorithm, invertAlgorithm, COLORS } from './cube.js';

// Standard functional cube notation; descriptions, lesson text and diagrams are
// original to Cubica. The catalog was checked against J Perm and CubeSkills.
// Rotation-ending PLLs include a return to the initial reference frame.
const STANDARD_CASES = {
  "oll": [
    {
      "name": 1,
      "moves": "R U2 R' R' F R F' U2 R' F R F'",
      "group": "Dot"
    },
    {
      "name": 2,
      "moves": "r U r' U2 r U2 R' U2 R U' r'",
      "group": "Dot"
    },
    {
      "name": 3,
      "moves": "r' R2 U R' U r U2 r' U M'",
      "group": "Dot"
    },
    {
      "name": 4,
      "moves": "M U' r U2 r' U' R U' R' M'",
      "group": "Dot"
    },
    {
      "name": 5,
      "moves": "l' U2 L U L' U l",
      "group": "Square Shape"
    },
    {
      "name": 6,
      "moves": "r U2 R' U' R U' r'",
      "group": "Square Shape"
    },
    {
      "name": 7,
      "moves": "r U R' U R U2 r'",
      "group": "Small Lightning Bolt"
    },
    {
      "name": 8,
      "moves": "l' U' L U' L' U2 l",
      "group": "Small Lightning Bolt"
    },
    {
      "name": 9,
      "moves": "R U R' U' R' F R2 U R' U' F'",
      "group": "Fish Shape"
    },
    {
      "name": 10,
      "moves": "R U R' U R' F R F' R U2 R'",
      "group": "Fish Shape"
    },
    {
      "name": 11,
      "moves": "r U R' U R' F R F' R U2 r'",
      "group": "Small Lightning Bolt"
    },
    {
      "name": 12,
      "moves": "M' R' U' R U' R' U2 R U' R r'",
      "group": "Small Lightning Bolt"
    },
    {
      "name": 13,
      "moves": "F U R U' R2 F' R U R U' R'",
      "group": "Knight Move Shape"
    },
    {
      "name": 14,
      "moves": "R' F R U R' F' R F U' F'",
      "group": "Knight Move Shape"
    },
    {
      "name": 15,
      "moves": "l' U' l L' U' L U l' U l",
      "group": "Knight Move Shape"
    },
    {
      "name": 16,
      "moves": "r U r' R U R' U' r U' r'",
      "group": "Knight Move Shape"
    },
    {
      "name": 17,
      "moves": "F R' F' R2 r' U R U' R' U' M'",
      "group": "Dot"
    },
    {
      "name": 18,
      "moves": "r U R' U R U2 r' r' U' R U' R' U2 r",
      "group": "Dot"
    },
    {
      "name": 19,
      "moves": "r' R U R U R' U' M' R' F R F'",
      "group": "Dot"
    },
    {
      "name": 20,
      "moves": "r U R' U' M2 U R U' R' U' M'",
      "group": "Dot"
    },
    {
      "name": 21,
      "moves": "R U2 R' U' R U R' U' R U' R'",
      "group": "Cross"
    },
    {
      "name": 22,
      "moves": "R U2 (R2 U' R2 U' R2) U2 R",
      "group": "Cross"
    },
    {
      "name": 23,
      "moves": "R2 D' R U2 R' D R U2 R",
      "group": "Cross"
    },
    {
      "name": 24,
      "moves": "r U R' U' r' F R F'",
      "group": "Cross"
    },
    {
      "name": 25,
      "moves": "F' r U R' U' r' F R",
      "group": "Cross"
    },
    {
      "name": 26,
      "moves": "(R U2 R') U' R U' R'",
      "group": "Cross"
    },
    {
      "name": 27,
      "moves": "R U R' U R U2 R'",
      "group": "Cross"
    },
    {
      "name": 28,
      "moves": "r U R' U' r' R U R U' R'",
      "group": "Corners Oriented"
    },
    {
      "name": 29,
      "moves": "R U R' U' R U' R' F' U' F R U R'",
      "group": "Awkward Shape"
    },
    {
      "name": 30,
      "moves": "F R' F R2 U' R' U' R U R' F2",
      "group": "Awkward Shape"
    },
    {
      "name": 31,
      "moves": "R' U' F U R U' R' F' R",
      "group": "P Shape"
    },
    {
      "name": 32,
      "moves": "L U F' U' L' U L F L'",
      "group": "P Shape"
    },
    {
      "name": 33,
      "moves": "R U R' U' R' F R F'",
      "group": "T Shape"
    },
    {
      "name": 34,
      "moves": "R U R2 U' R' F R U R U' F'",
      "group": "C Shape"
    },
    {
      "name": 35,
      "moves": "R U2 R' R' F R F' R U2 R'",
      "group": "Fish Shape"
    },
    {
      "name": 36,
      "moves": "L' U' L U' L' U L U L F' L' F",
      "group": "W Shape"
    },
    {
      "name": 37,
      "moves": "F R' F' R U R U' R'",
      "group": "Fish Shape"
    },
    {
      "name": 38,
      "moves": "R U R' U R U' R' U' R' F R F'",
      "group": "W Shape"
    },
    {
      "name": 39,
      "moves": "L F' L' U' L U F U' L'",
      "group": "Big Lightning Bolt"
    },
    {
      "name": 40,
      "moves": "R' F R U R' U' F' U R",
      "group": "Big Lightning Bolt"
    },
    {
      "name": 41,
      "moves": "R U R' U R U2 R' F R U R' U' F'",
      "group": "Awkward Shape"
    },
    {
      "name": 42,
      "moves": "R' U' R U' R' U2 R F R U R' U' F'",
      "group": "Awkward Shape"
    },
    {
      "name": 43,
      "moves": "F' U' L' U L F",
      "group": "P Shape"
    },
    {
      "name": 44,
      "moves": "F U R U' R' F'",
      "group": "P Shape"
    },
    {
      "name": 45,
      "moves": "F R U R' U' F'",
      "group": "T Shape"
    },
    {
      "name": 46,
      "moves": "R' U' R' F R F' U R",
      "group": "C Shape"
    },
    {
      "name": 47,
      "moves": "R' U' R' F R F' R' F R F' U R",
      "group": "Small L Shape"
    },
    {
      "name": 48,
      "moves": "F R U R' U' R U R' U' F'",
      "group": "Small L Shape"
    },
    {
      "name": 49,
      "moves": "r U' r2 U r2 U r2 U' r",
      "group": "Small L Shape"
    },
    {
      "name": 50,
      "moves": "r' U r2 U' r2 U' r2 U r'",
      "group": "Small L Shape"
    },
    {
      "name": 51,
      "moves": "F U R U' R' U R U' R' F'",
      "group": "I Shape"
    },
    {
      "name": 52,
      "moves": "R U R' U R U' B U' B' R'",
      "group": "I Shape"
    },
    {
      "name": 53,
      "moves": "l' U2 L U L' U' L U L' U l",
      "group": "Small L Shape"
    },
    {
      "name": 54,
      "moves": "(r U2 R' U') R U R' U' R U' r'",
      "group": "Small L Shape"
    },
    {
      "name": 55,
      "moves": "R' F R U R U' R2 F' R2 U' R' U R U R'",
      "group": "I Shape"
    },
    {
      "name": 56,
      "moves": "(r' U' r) U' R' U R U' R' U R r' U r",
      "group": "I Shape"
    },
    {
      "name": 57,
      "moves": "R U R' U' M' U R U' r'",
      "group": "Corners Oriented"
    }
  ],
  "pll": [
    {
      "name": "H",
      "moves": "M2 U M2 U2 M2 U M2",
      "group": "Edges Only"
    },
    {
      "name": "Z",
      "moves": "M' U M2 U M2 U M' U2 M2",
      "group": "Edges Only"
    },
    {
      "name": "Ua",
      "moves": "M2 U M U2 M' U M2",
      "group": "Edges Only"
    },
    {
      "name": "Ub",
      "moves": "M2 U' M U2 M' U' M2",
      "group": "Edges Only"
    },
    {
      "name": "Aa",
      "moves": "x L2 D2 L' U' L D2 L' U L' x'",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Ab",
      "moves": "x' L2 D2 L U L' D2 L U' L x",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "E",
      "moves": "x' L' U L D' L' U' L D L' U' L D' L' U L D x",
      "group": "Diagonal Corner Swap"
    },
    {
      "name": "F",
      "moves": "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Ja",
      "moves": "R' U L' U2 R U' R' U2 R L",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Jb",
      "moves": "R U R' F' R U R' U' R' F R2 U' R'",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Ra",
      "moves": "R U' R' U' R U R D R' U' R D' R' U2 R'",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Rb",
      "moves": "R2 F R U R U' R' F' R U2 R' U2 R",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "T",
      "moves": "R U R' U' R' F R2 U' R' U' (R U R') F'",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Y",
      "moves": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
      "group": "Diagonal Corner Swap"
    },
    {
      "name": "V",
      "moves": "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
      "group": "Diagonal Corner Swap"
    },
    {
      "name": "Na",
      "moves": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
      "group": "Diagonal Corner Swap"
    },
    {
      "name": "Nb",
      "moves": "R' (U R U' R') F' U' F R U R' F R' F' R U' R",
      "group": "Diagonal Corner Swap"
    },
    {
      "name": "Ga",
      "moves": "R2 U R' U R' U' R U' R2 (U' D) R' U R D'",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Gb",
      "moves": "R' U' R (U D') R2 U R' U R U' R U' R2 D",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Gc",
      "moves": "R2 U' R U' R U R' U R2 (U D') R U' R' D",
      "group": "Adjacent Corner Swap"
    },
    {
      "name": "Gd",
      "moves": "R U R' (U' D) R2 U' R U' R' U R' U R2 D'",
      "group": "Adjacent Corner Swap"
    }
  ]
};

const OLL_NAMES = { 21: 'H', 22: 'Pi', 23: 'Headlights', 24: 'Chameleon', 25: 'Bowtie', 26: 'Anti-Sune', 27: 'Sune', 28: 'Stealth', 33: 'T shape', 45: 'Line', 57: 'H edges' };
const PLL_DESCRIPTION = {
  H: 'Swap both pairs of opposite last-layer edges.',
  Z: 'Exchange two pairs of neighboring last-layer edges.',
  Ua: 'Cycle three last-layer edges in one direction; corners stay solved.',
  Ub: 'Cycle the same three edge positions in the opposite direction.',
  Aa: 'Cycle three corners while keeping every edge fixed.',
  Ab: 'Reverse the A-permutation corner cycle.',
  E: 'Exchange two pairs of corners while preserving all edges.',
  T: 'Exchange two neighboring corners and two edges.',
  F: 'Exchange a pair of corners and the front/back edge pair.',
  Ja: 'A corner swap and an adjacent edge swap, arranged in a J pattern.',
  Jb: 'The companion J case: a corner pair and an adjacent edge pair move together.',
  Ra: 'Exchange a pair of corners and a pair of edges with an R-style pattern.',
  Rb: 'The companion R permutation; learn its blocks separately from Ra.',
  Y: 'Exchange a diagonal corner pair and a neighboring edge pair.',
  V: 'Exchange a diagonal corner pair and two edges in a V pattern.',
  Na: 'Exchange two corners and two edges in the first N pattern.',
  Nb: 'The companion N permutation; inspect the direction of the two blocks.',
  Ga: 'Cycle three corners and three edges together.',
  Gb: 'The inverse companion of Ga, with both corner and edge cycles.',
  Gc: 'The second paired corner-and-edge cycle pattern.',
  Gd: 'The inverse companion of Gc.',
};

function normalizedMoves(text) { return parseAlgorithm(text).join(' '); }

function algorithmRecord(record) {
  const moves = normalizedMoves(record.moves);
  const setup = invertAlgorithm(moves).join(' ');
  return { size: 3, ...record, moves, setup, moveCount: parseAlgorithm(moves).length };
}

const fundamentals = [
  { id: 'right-trigger', name: 'Right-hand trigger', family: 'Triggers', level: 'Beginner', moves: "R U R' U'", description: 'Four turns that introduce the idea of moving a piece out, working above the slot, and restoring the slot.', recognition: 'A motion drill, not a universal solution. Load its prepared case and trace one corner.', tips: 'Keep the cube in one grip. After six repetitions, the cube returns to its starting state.' },
  { id: 'left-trigger', name: 'Left-hand trigger', family: 'Triggers', level: 'Beginner', moves: "L' U' L U", description: 'The left-handed mirror of the basic trigger.', recognition: 'Use the left-front slot as your working area.', tips: 'Learn both hands slowly, with distinct turns and no cube rotations.' },
  { id: 'sledgehammer', name: 'Sledgehammer', family: 'Triggers', level: 'Intermediate', moves: "R' F R F'", description: 'A compact trigger used inside many F2L and OLL solutions.', recognition: 'Track the front-right pieces as R and F undo their earlier turns.', tips: 'A trigger is a useful building block; apply it only after recognizing its setup.' },
  { id: 'hedgeslammer', name: 'Hedgeslammer', family: 'Triggers', level: 'Intermediate', moves: "F R' F' R", description: 'The inverse of the sledgehammer trigger.', recognition: 'Watch how reversing the order and direction reverses the piece paths.', tips: 'Compare its cycles with the sledgehammer in the graph explorer.' },
  { id: 'middle-right', name: 'Middle edge · right', family: 'Beginner', level: 'Beginner', moves: "U R U' R' U' F' U F", description: 'Insert an upper-layer edge into the front-right middle slot while restoring the first layer.', recognition: 'Match the front sticker of the UF edge to the front center; its upper sticker must match the right center.', tips: 'If the wanted edge is trapped in the middle, first use an insertion to release it.' },
  { id: 'middle-left', name: 'Middle edge · left', family: 'Beginner', level: 'Beginner', moves: "U' L' U L U F U' F'", description: 'Mirror the middle-layer insertion into the front-left slot.', recognition: 'Match the front sticker of the UF edge to F; its upper sticker must match L.', tips: 'Keep the completed first layer on D throughout the insertion.' },
  { id: 'top-cross-line', name: 'Top cross · line', family: 'Beginner', level: 'Beginner', moves: "F R U R' U' F'", description: 'Orient the last-layer edge stickers from the prepared line case.', recognition: 'Before the algorithm, the two already oriented U edges lie at UL and UR.', tips: 'Look only at the four upper edges. Corner orientation is a later step.' },
  { id: 'top-cross-elbow', name: 'Top cross · elbow', family: 'Beginner', level: 'Beginner', moves: "F U R U' R' F'", description: 'Orient the last-layer edges from the prepared elbow case.', recognition: 'Load the case and identify the two neighboring upper-facing edge stickers.', tips: 'Recognition includes orientation: rotate U to match the prepared case before executing.' },
  { id: 'f2l-right', name: 'F2L · right insertion', family: 'F2L', level: 'Intermediate', moves: "U R U' R'", description: 'Insert a prepared corner-edge pair into the front-right F2L slot.', recognition: 'The case loader prepares a matched pair ready to insert. Pair first when solving a different state.', tips: 'Follow both pieces, not just the D-colored corner.' },
  { id: 'f2l-left', name: 'F2L · left insertion', family: 'F2L', level: 'Intermediate', moves: "U' L' U L", description: 'Insert the mirrored prepared pair into the front-left F2L slot.', recognition: 'Watch the matching side colors join the left-front slot.', tips: 'Use this to practice a balanced left and right hand repertoire.' },
  { id: 'f2l-front', name: 'F2L · front insertion', family: 'F2L', level: 'Intermediate', moves: "U' F' U F", description: 'Insert a prepared pair with the front face as the working face.', recognition: 'The two side stickers of the pair must match the destination centers.', tips: 'Compare the final state with the R-based insertion, then choose a comfortable grip.' },
  { id: 'corner-commutator', name: 'Corner commutator', family: 'Commutators', level: 'Advanced', moves: "[R U R', D]", description: 'A three-corner cycle built from two short sequences and their inverses.', recognition: 'Read [A,B] as A B A′ B′. The cycle graph reveals which three corners move.', tips: 'Watch the overlap between the support of A and D; the non-overlapping changes cancel.' },
  { id: 'conjugate-study', name: 'Move the working area', family: 'Commutators', level: 'Advanced', moves: "[U: R' F R F']", description: 'A setup move, a trigger, and the inverse setup demonstrate conjugation.', recognition: 'Read [S:A] as S A S′. The setup changes where the trigger acts.', tips: 'Undo setup moves in reverse order, with each turn inverted.' },
  { id: 'checkerboard', name: 'Checkerboard', family: 'Patterns', level: 'Beginner', moves: 'M2 E2 S2', description: 'A symmetric checkerboard pattern on a 3×3.', recognition: 'Start solved. Each face alternates its own color with its opposite color.', tips: 'Run the same sequence again to return to solved.' },
  { id: 'six-spots', name: 'Six spots', family: 'Patterns', level: 'Intermediate', moves: "U D' R L' F B' U D'", description: 'Explore a center-focused decorative cube pattern.', recognition: 'A pattern exercise for studying how slices and centers relate.', tips: 'Use the inverse button to restore the exact starting state.' },
].map(algorithmRecord);

const oll = STANDARD_CASES.oll.map(caseData => algorithmRecord({
  id: `oll-${caseData.name}`, name: `OLL ${String(caseData.name).padStart(2, '0')}${OLL_NAMES[caseData.name] ? ` · ${OLL_NAMES[caseData.name]}` : ''}`,
  family: 'OLL', level: caseData.name >= 21 && caseData.name <= 27 ? 'Intermediate' : 'Advanced',
  moves: caseData.moves, group: caseData.group, caseNumber: caseData.name,
  description: `Orient every last-layer sticker from this ${caseData.group.toLowerCase()} case, preserving the completed first two layers.`,
  recognition: `Start with the ${caseData.group.toLowerCase()} family. Match both the upper-face shape and the side-facing U stickers to the loaded case.`,
  tips: 'Learn the trigger chunks, then hide the moves and recognize the case from several U angles. OLL does not necessarily permute the last layer.',
  source: 'https://jperm.net/algs/oll',
}));

const pll = STANDARD_CASES.pll.map(caseData => algorithmRecord({
  id: `pll-${caseData.name.toLowerCase()}`, name: `${caseData.name} permutation`, family: 'PLL', level: ['H', 'Ua', 'Ub', 'Z', 'Aa', 'T', 'Y'].includes(caseData.name) ? 'Intermediate' : 'Advanced',
  moves: caseData.moves, group: caseData.group, caseName: caseData.name,
  description: PLL_DESCRIPTION[caseData.name],
  recognition: `All upper stickers already face up. Compare the side bars, matching corner pairs and piece cycles with the prepared ${caseData.name} case.`,
  tips: 'A different real solve can require a U adjustment before and after the algorithm. The prepared case uses the exact inverse and therefore finishes solved.',
  source: 'https://jperm.net/algs/pll',
}));

export const algorithms = [...fundamentals, ...oll, ...pll];
export const algorithmFamilies = [...new Set(algorithms.map(a => a.family))];
const alg = id => algorithms.find(a => a.id === id)?.moves || '';

export const references = [
  { title: 'WCA · notation and official regulations', url: 'https://www.worldcubeassociation.org/regulations/#article-12-notation', description: 'Face turns, wide moves, puzzle notation and competition procedures.' },
  { title: 'J Perm · beginner 3×3 guide', url: 'https://jperm.net/3x3', description: 'An additional visual reference for the layer-by-layer method.' },
  { title: 'J Perm · CFOP and finger tricks', url: 'https://jperm.net/3x3/cfop', description: 'Cross, first two layers, orientation and permutation.' },
  { title: 'J Perm · all 57 OLL cases', url: 'https://jperm.net/algs/oll', description: 'Reference for the standard OLL sequences included in this studio.' },
  { title: 'J Perm · all 21 PLL cases', url: 'https://jperm.net/algs/pll', description: 'Reference for the standard PLL sequences included in this studio.' },
  { title: 'CubeSkills · OLL algorithms', url: 'https://www.cubeskills.com/tutorials/oll-algorithms', description: 'Independent algorithm reference by Feliks Zemdegs and Andy Klise.' },
  { title: 'CubeSkills · PLL algorithms', url: 'https://www.cubeskills.com/tutorials/pll-algorithms', description: 'Permutation families and execution demonstrations.' },
  { title: 'Conrad Rider · ZZ tutorial', url: 'https://cube.rider.biz/zz.php?v=beginner', description: 'Edge orientation, EOLine and rotation-free block building.' },
  { title: 'John Scheopner · Roux guide', url: 'https://www.scheopner.com/cube/', description: 'First and second blocks, CMLL and last six edges.' },
  { title: 'J Perm · blindfolded foundations', url: 'https://jperm.net/bld', description: 'Sticker targets, setup moves, memo and parity.' },
  { title: 'J Perm · 4×4 reduction', url: 'https://jperm.net/4x4', description: 'Centers, edge pairing and parity cases.' },
  { title: 'Herbert Kociemba · the cubie model', url: 'https://kociemba.org/math/cubielevel.htm', description: 'Permutation, corner twist and edge-flip conventions.' },
];

function lesson(record) {
  const algorithm = record.algorithm || '';
  return {
    size: 3, ...record,
    algorithm,
    setup: record.setup ?? (algorithm ? invertAlgorithm(algorithm).join(' ') : ''),
    steps: record.steps.map(step => ({ ...step, ...(step.algorithm && !step.setup ? { setup: invertAlgorithm(step.algorithm).join(' ') } : {}) })),
  };
}

export const lessons = [
  lesson({ id: 'meet-the-cube', title: 'Meet your cube', subtitle: 'Make sense of the pieces before you make a move.', level: 'Beginner', stage: 'Foundations', minutes: 3, algorithm: 'R', goals: ['Tell centers, edges and corners apart', 'Find a piece using both the cube and its graph'], steps: [
    { title: 'Six faces, three kinds of pieces', body: 'A 3×3 has six centers, twelve edges with two stickers each, and eight corners with three. Stickers belong to physical pieces: a turn never separates a corner’s three colors.' },
    { title: 'Centers give the color frame', body: 'This studio starts with ivory on U, yellow on D, teal on F and coral on R. An outer face turn leaves its center in place. A whole-cube rotation changes your view of the frame.' },
    { title: 'Follow one edge', body: 'Select a two-color circle in the piece graph. Find those same two stickers on the 3D cube and unfolded net. Its two colors tell you where it belongs when solved.', tip: 'The graph draws every physical cubie, including all six centers.' },
    { title: 'Make one turn, then undo', body: 'Play R and watch the right layer. Four edges and four corners change slots. Undo returns every piece to its previous position; Reset starts with a solved cube.', algorithm: 'R' },
  ] }),
  lesson({ id: 'read-notation', title: 'Learn the language of turns', subtitle: 'Read any algorithm without guessing a direction.', level: 'Beginner', stage: 'Foundations', minutes: 5, algorithm: alg('right-trigger'), goals: ['Read face letters, primes and double turns', 'Understand inverse sequences'], steps: [
    { title: 'A letter names a face', body: 'U, R, F, D, L and B mean up, right, front, down, left and back. Clockwise is judged while looking directly at the face being turned—not always from your current camera angle.' },
    { title: 'Two small marks, two different jobs', body: 'R turns the right face 90° clockwise. R′ turns it 90° counterclockwise. R2 turns it 180°. A double turn reaches the same state in either direction.' },
    { title: 'Read left to right', body: 'R U R′ U′ means four consecutive turns. Step through them slowly. Do not turn the entire cube when a face letter changes.', algorithm: alg('right-trigger') },
    { title: 'Reverse the path', body: 'To undo an algorithm, reverse its order and invert every move. The inverse of R U R′ U′ is U R U′ R′. Repeated groups such as (R U R′ U′)6 are accepted in the editor.' },
    { title: 'Slices, wide turns and rotations', body: 'M, E and S move middle slices on odd cubes. Rw (or r) turns two right layers together. x, y and z rotate the whole puzzle like R, U and F. These are different operations.', tip: 'On even cubes, use wide moves instead of an ambiguous single middle slice.' },
  ] }),
  lesson({ id: 'first-cross', title: 'Build your first cross', subtitle: 'Four edges. Two matching colors on every one.', level: 'Beginner', stage: 'First solve', minutes: 7, algorithm: 'F2 R2', goals: ['Solve the four D-color edges', 'Match all four side centers'], steps: [
    { title: 'Choose the bottom color', body: 'We build the yellow D cross in the default frame. Find the four edges containing yellow. Ignore corners for now: the target is four correct edges around the D center.' },
    { title: 'Find the other sticker', body: 'The yellow–teal edge belongs between the yellow and teal centers. A yellow cross with mismatched side colors is not finished. Use the cross graph to see each edge and its home target.' },
    { title: 'Use the upper layer as a workbench', body: 'Bring a target edge to U without destroying one already solved. Match its side color with the corresponding center, then a half turn can carry it to D.', tip: 'For this prepared example, F2 solves the front edge and R2 solves the right edge.' },
    { title: 'Solve the prepared case', body: 'Step through F2 R2. After each move, see which outer graph node reaches its target. In a new scramble, plan from the edge locations instead of reusing these two moves blindly.', algorithm: 'F2 R2' },
    { title: 'Check the cross', body: 'Look underneath and at all four side faces. Each D sticker faces down and the other sticker matches its center. Once all four graph targets are solved, keep this cross on the bottom.' },
  ] }),
  lesson({ id: 'first-corners', title: 'Complete the first layer', subtitle: 'Place and orient the four bottom corners.', level: 'Beginner', stage: 'First solve', minutes: 8, algorithm: alg('right-trigger'), goals: ['Recognize a corner’s three-color home', 'Insert a corner without abandoning the cross'], steps: [
    { title: 'Find the correct corner', body: 'Choose a corner containing the D color. Its two other stickers identify the two side centers it must sit between. A face of one color alone does not prove its corners are in the right places.' },
    { title: 'Work above the destination', body: 'Keep the completed cross on D. Put the destination slot at front-right, then move the wanted corner above that slot using U turns.' },
    { title: 'Insert and inspect', body: 'Use the right-hand trigger R U R′ U′ with the target in the correct working position. Depending on the corner’s orientation, repeated triggers can place it correctly. Inspect the D sticker after each complete trigger.', algorithm: alg('right-trigger') },
    { title: 'Release a trapped corner', body: 'If the correct corner is in a bottom slot but twisted or misplaced, use the trigger at that slot to bring it to U. Reposition it above its own home before inserting.' },
    { title: 'Finish all four', body: 'Repeat for each D-color corner. The complete first layer has matching side strips as well as a uniform bottom face. Do not move on with a corner that only looks correct from below.' },
  ] }),
  lesson({ id: 'second-layer', title: 'Solve the middle layer', subtitle: 'Insert edges to the right or to the left.', level: 'Beginner', stage: 'First solve', minutes: 9, algorithm: alg('middle-right'), goals: ['Choose the correct middle-layer edge', 'Use mirrored insertions'], steps: [
    { title: 'Find an edge without the upper color', body: 'Search U for an edge that does not contain the U color. Those four non-U, non-D edges belong in the middle layer.' },
    { title: 'Match the front sticker', body: 'Turn U until the edge’s front-facing sticker matches the front center. Its upper sticker tells you whether the edge must enter the right or left slot.' },
    { title: 'Insert to the right', body: 'If the upper sticker matches the right center, use U R U′ R′ U′ F′ U F. The first layer is temporarily opened, then restored.', algorithm: alg('middle-right') },
    { title: 'Mirror to the left', body: 'For the left slot use U′ L′ U L U F U′ F′. The logic is the same; the working hand and directions change.', algorithm: alg('middle-left') },
    { title: 'Fix an edge already in the middle', body: 'Insert another edge into its slot to release it. Then align and insert the wanted edge correctly. Finish only when both lower layers match the side centers all the way around.' },
  ] }),
  lesson({ id: 'last-layer-cross', title: 'Make the upper cross', subtitle: 'Orient the four upper edges; leave corners for later.', level: 'Beginner', stage: 'First solve', minutes: 6, algorithm: alg('top-cross-line'), goals: ['Recognize dot, elbow and line', 'Preserve the first two layers'], steps: [
    { title: 'Look at edge stickers only', body: 'The upper layer’s edge orientation forms a dot, an elbow, a line or a cross. Ignore the four corners when naming the case.' },
    { title: 'Line case', body: 'Hold the two upper-facing edge stickers at UL and UR, so they make a horizontal line. Use F R U R′ U′ F′.', algorithm: alg('top-cross-line') },
    { title: 'Elbow case', body: 'Match the prepared elbow case and use F U R U′ R′ F′. The case preview gives the exact orientation; a U adjustment changes where the elbow points.', algorithm: alg('top-cross-elbow') },
    { title: 'Dot case', body: 'Use one edge-orientation sequence to create a line or elbow. Recognize the new case before choosing the next sequence. Stop when all four upper edge stickers point up.' },
    { title: 'Verify preservation', body: 'The top side colors may still be misplaced. That is expected: orientation and permutation are separate. The lower two layers must remain solved.' },
  ] }),
  lesson({ id: 'last-layer-orientation', title: 'Finish the upper face', subtitle: 'Recognize corner orientation and learn Sune.', level: 'Beginner', stage: 'First solve', minutes: 8, algorithm: alg('oll-27'), goals: ['Distinguish orientation from permutation', 'Solve a prepared Sune case'], steps: [
    { title: 'Keep the cross', body: 'The four U edge stickers already point up. Now orient the four corners while retaining the solved first two layers and the upper cross.' },
    { title: 'Recognize the prepared Sune', body: 'Load the case and inspect every U-colored corner sticker, including those on the side faces. Matching only the top shape is not enough; the side stickers distinguish mirrored cases.' },
    { title: 'Play the seven turns', body: 'Execute R U R′ U R U2 R′. The upper face becomes uniform. Watch the corner paths in the cycle graph.', algorithm: alg('oll-27') },
    { title: 'Recognize again before repeating', body: 'Other states may need a different U adjustment or a different corner-orientation algorithm. The seven Cross-family OLL cases, 21–27, cover the possible corner orientations once edges are oriented.' },
    { title: 'A face is not yet a solve', body: 'All U stickers face up, but their side colors can still be in the wrong order. The next lessons position the last-layer pieces without changing their orientation.' },
  ] }),
  lesson({ id: 'last-layer-corners', title: 'Position the last corners', subtitle: 'Use matching corner pairs as recognition clues.', level: 'Beginner', stage: 'First solve', minutes: 8, algorithm: alg('pll-t'), goals: ['Recognize matching corner pairs', 'Place all upper corners'], steps: [
    { title: 'Inspect the side stickers', body: 'The upper face is complete. Around its sides, look for two corners with matching outward stickers on one face. Cubers often call this a pair of headlights.' },
    { title: 'Corners may need an upper adjustment', body: 'Try to understand which U adjustment would align a matching pair with its center. This separates a rotated solved corner set from a corner permutation that still needs work.' },
    { title: 'Study an adjacent swap', body: 'The prepared T-permutation swaps two corners and two edges. It is useful in a two-look last layer because edges can be solved afterward.', algorithm: alg('pll-t') },
    { title: 'Learn the diagonal option', body: 'The Y-permutation is a useful partner for diagonal corner cases. Match its prepared orientation before executing; do not apply T repeatedly without checking what remains.', algorithm: alg('pll-y') },
    { title: 'Check all four corners', body: 'After the appropriate algorithm and U adjustment, every corner’s side stickers match their centers. Only the four upper edges may remain unsolved.' },
  ] }),
  lesson({ id: 'last-layer-edges', title: 'Finish your first solve', subtitle: 'Cycle the remaining edges and align the last turn.', level: 'Beginner', stage: 'First solve', minutes: 8, algorithm: alg('pll-ua'), goals: ['Recognize an edge cycle', 'Finish with correct side alignment'], steps: [
    { title: 'Keep the corners solved', body: 'Choose an edge-only permutation. Ua, Ub, H and Z leave all corners unchanged. A U adjustment before the algorithm may be needed to match the case.' },
    { title: 'Trace where an edge belongs', body: 'Use the side color on each upper edge to identify its destination center. The cycle graph distinguishes a three-edge cycle from two independent swaps.' },
    { title: 'Solve the three-edge cycle', body: 'Load Ua and step through its M/U sequence. Ub moves the corresponding edge cycle the other way. Match the direction rather than guessing.', algorithm: alg('pll-ua') },
    { title: 'Use H or Z for paired swaps', body: 'H exchanges opposite edge pairs; Z exchanges adjacent pairs. Both are in the algorithm library and can be loaded as exact prepared cases.', algorithm: alg('pll-h') },
    { title: 'Align, then celebrate', body: 'Finish any remaining U adjustment so every side strip meets its center. A solved cube has six uniform faces. Repeat the full beginner path until each stage is a decision you understand.' },
  ] }),
  lesson({ id: 'efficient-cross', title: 'Plan an efficient cross', subtitle: 'Solve on the bottom and see further ahead.', level: 'Intermediate', stage: 'CFOP', minutes: 10, algorithm: 'F2 R2 D L2', goals: ['Plan a complete cross before turning', 'Track edges through shared moves'], steps: [
    { title: 'Plan instead of reacting', body: 'Use inspection to locate all four D edges. Trace one planned turn mentally and update the other three edge locations. A single turn often helps more than one piece.' },
    { title: 'Work relative to the centers', body: 'You can build a cross with the bottom layer temporarily offset, then align it once at the end. Know the required color order so a final D turn can repair that offset.' },
    { title: 'Compare candidate solutions', body: 'Try two solutions to the same setup. Record their face-turn count and how comfortable the grip feels. Fewer turns and faster execution are related, but not identical.' },
    { title: 'Study the prepared cross', body: 'This controlled example has a four-move return path. Step through F2 R2 D L2 and track every D edge after each turn; it is a study case, not a general cross algorithm.', algorithm: 'F2 R2 D L2' },
    { title: 'Add one piece of lookahead', body: 'Once you can execute a planned cross without searching, watch a first-pair corner during those same moves. Do not sacrifice cross accuracy just to turn faster.' },
  ] }),
  lesson({ id: 'intuitive-f2l', title: 'Pair the first two layers', subtitle: 'Turn a corner and an edge into one useful block.', level: 'Intermediate', stage: 'CFOP', minutes: 12, algorithm: alg('f2l-right'), goals: ['Pair a corner and its matching edge', 'Insert without breaking solved slots'], steps: [
    { title: 'Find a matching pair', body: 'Pick an unsolved D-color corner and the middle-layer edge with the same two side colors. Their shared colors identify the destination slot.' },
    { title: 'Use free space', body: 'Bring the two pieces to U while protecting finished slots. If they are joined incorrectly, separate them into free space; do not repeatedly dismantle a solved pair.' },
    { title: 'Make matching sides touch', body: 'Arrange the corner and edge so their matching side stickers line up as a vertical pair. Track which sticker faces you, because different orientations need different setups.' },
    { title: 'Insert the pair', body: 'In the prepared right insertion, U R U′ R′ places both pieces at once. Use the left or front variants to explore the same idea from another working slot.', algorithm: alg('f2l-right') },
    { title: 'Repeat with awareness', body: 'Solve four slots. During the end of one insertion, look for the next corner or edge. Learn intuitive cases first, then use efficient algorithms for awkward cases you repeatedly encounter.' },
  ] }),
  lesson({ id: 'two-look-oll', title: 'Two-look OLL', subtitle: 'One decision for edges. One for corners.', level: 'Intermediate', stage: 'CFOP', minutes: 12, algorithm: alg('oll-26'), goals: ['Recognize upper edge patterns', 'Distinguish the seven oriented-edge OLL cases'], steps: [
    { title: 'Orient edges first', body: 'Complete the U cross using the dot, line or elbow edge case. Do not mix corner recognition into this first decision.' },
    { title: 'Count upper-facing corners', body: 'With the cross complete, inspect the four corners and their side stickers. There are seven non-solved orientation cases up to U rotations.' },
    { title: 'Learn Sune and Anti-Sune as a pair', body: 'The two cases look related but turn corner orientation in opposite ways. Compare OLL 27 with OLL 26 before speeding up.', algorithm: alg('oll-26') },
    { title: 'Add the remaining five', body: 'Use OLL 21–25 from the library for H, Pi, headlights, chameleon and bowtie-style cases. Learn recognition and execution together.' },
    { title: 'Train the decisions', body: 'Load a case, inspect it, hide the sequence and name it before playing. Accurate recognition with a small algorithm set is more useful than rushed recall of many sequences.' },
  ] }),
  lesson({ id: 'two-look-pll', title: 'Two-look PLL', subtitle: 'Place corners, then finish the edges.', level: 'Intermediate', stage: 'CFOP', minutes: 12, algorithm: alg('pll-ub'), goals: ['Separate corner and edge decisions', 'Recognize Ua, Ub, H and Z'], steps: [
    { title: 'Preserve the oriented face', body: 'Every PLL keeps last-layer orientation. First recognize the corner arrangement; apply a corner-solving sequence that may move edges as well.' },
    { title: 'Choose the corner case', body: 'Adjacent and diagonal corner cases need different choices. Use the prepared T and Y cases to see the difference in their corner cycles.' },
    { title: 'Recognize the edge-only remainder', body: 'Once corners are positioned, compare the remaining edges with Ua, Ub, H or Z. If the whole top layer is only offset, a U adjustment is sufficient.' },
    { title: 'Practice the opposite cycle', body: 'Step through Ub and compare the arrow direction with Ua. The three moved pieces are similar; their destinations make the distinction.', algorithm: alg('pll-ub') },
    { title: 'Remove the pause', body: 'After execution becomes reliable, practice recognizing the second stage while finishing the first. Keep the correct pre- and post-algorithm U adjustments in your timing.' },
  ] }),
  lesson({ id: 'full-pll', title: 'Master all 21 PLLs', subtitle: 'Recognize bars and headlights from two faces.', level: 'Advanced', stage: 'Speed solving', minutes: 18, algorithm: alg('pll-jb'), goals: ['Build a complete 21-case repertoire', 'Recognize without rotating the whole cube'], steps: [
    { title: 'Organize by what moves', body: 'Start with edge-only cases, then corner cycles, then mixed corner-and-edge cases. The four G cases are related double cycles, but their block positions differ.' },
    { title: 'Inspect two neighboring sides', body: 'Read bars and matching corner pairs on the visible front and right faces. Learn to infer the hidden pieces instead of rotating the cube repeatedly.' },
    { title: 'Chunk the sequence', body: 'Choose Jb in the library. Break it into familiar trigger sections and practice the transitions between them. Avoid regripping simply because a memorized line ends.', algorithm: alg('pll-jb') },
    { title: 'Include the final alignment', body: 'A PLL is not complete until the last U adjustment is done. Predict where a recognizable bar will finish, so you can make that adjustment immediately.' },
    { title: 'Train weak recognition', body: 'Use the complete 21-case catalog to revisit cases that look alike. Alternate recognition-only reviews with timed execution; memorizing moves and identifying a case are separate skills.' },
  ] }),
  lesson({ id: 'full-oll', title: 'Build your 57-case OLL library', subtitle: 'Learn shape families, then the details that distinguish them.', level: 'Advanced', stage: 'Speed solving', minutes: 18, algorithm: alg('oll-33'), goals: ['Recognize all OLL families', 'Retain algorithms through retrieval practice'], steps: [
    { title: 'Learn a family at a time', body: 'The catalog includes all 57 standard OLL cases. Start from the seven oriented-edge cases, then add squares, T shapes, lightning bolts and other visual families.' },
    { title: 'Read top and side information', body: 'Two cases can have similar upper silhouettes but different U-colored stickers on the sides. Recognition must account for those side stickers.' },
    { title: 'Connect familiar triggers', body: 'OLL 33 joins the right-hand trigger with a sledgehammer. Seeing reusable motions makes the sequence easier to understand and execute.', algorithm: alg('oll-33') },
    { title: 'Practice both recall and orientation', body: 'Recognize a case, predict the U adjustment, then execute without the move text. Rotate the case with U so you do not memorize a single camera picture.' },
    { title: 'Keep older cases alive', body: 'Review a small mixed group every session. Add new cases only when earlier ones are reliably recognized and executed; the goal is a usable repertoire, not a checked box.' },
  ] }),
  lesson({ id: 'finger-tricks', title: 'Smooth, deliberate finger tricks', subtitle: 'Find a repeatable grip before chasing turning speed.', level: 'Intermediate', stage: 'Speed solving', minutes: 10, algorithm: '(R U R\' U\')6', goals: ['Execute clean triggers', 'Reduce unnecessary regrips'], steps: [
    { title: 'Practice on a physical cube too', body: 'The simulator teaches state changes and timing, but real finger tricks depend on your hands and hardware. Use these animations as a motion reference, then test a comfortable grip.' },
    { title: 'Separate recognition from execution', body: 'First identify the case with no time pressure. Then drill only the turns. This reveals whether a slow solve comes from searching, recall, or hand movement.' },
    { title: 'Use short loops', body: 'Six right-hand triggers return to the same state. Begin slowly and keep every turn aligned; only increase speed when the entire loop stays clean.', algorithm: '(R U R\' U\')6' },
    { title: 'Practice the joins', body: 'Hesitation often happens between familiar chunks. Loop the end of one chunk and the start of the next, then reassemble the complete algorithm.' },
    { title: 'Choose consistency', body: 'A stable average is a better training signal than one lucky fast execution. Use the timer history to compare repeated attempts of the same drill.' },
  ] }),
  lesson({ id: 'lookahead', title: 'See the next pair', subtitle: 'Trade pauses for a steadier solve.', level: 'Advanced', stage: 'Speed solving', minutes: 10, algorithm: alg('f2l-right'), goals: ['Track a piece while executing a known insertion', 'Reduce pauses between F2L pairs'], steps: [
    { title: 'Make the current insertion automatic', body: 'If you still need to watch every move to finish a pair, keep practicing that insertion. Lookahead requires enough confidence to shift your eyes away.' },
    { title: 'Slow the turns on purpose', body: 'Choose a turning pace at which you can follow an unsolved piece throughout the current insertion. A slower continuous solve can beat fast bursts separated by long searches.' },
    { title: 'Track one piece first', body: 'During the prepared pair insertion, select a different corner and predict its next slot. Verify using the piece graph after each turn.', algorithm: alg('f2l-right') },
    { title: 'Add its partner', body: 'Once tracking one piece is comfortable, locate its matching edge. Decide what their relationship will be when the current insertion finishes.' },
    { title: 'Measure pauses, not only turns', body: 'Review a solve’s move timeline. Notice the transitions that caused uncertainty, then repeat those situations with a specific tracking goal.' },
  ] }),
  lesson({ id: 'practice-session', title: 'Train with a purpose', subtitle: 'Use inspection, averages and focused drills.', level: 'Intermediate', stage: 'Speed solving', minutes: 8, goals: ['Read session statistics', 'Choose a productive practice goal'], steps: [
    { title: 'Warm up deliberately', body: 'Begin with slow solves and a few reliable triggers. Choose one focus for the session: cross planning, one difficult F2L case, recognition or turning accuracy.' },
    { title: 'Inspect before starting', body: 'Competition-style inspection gives time to plan before the solve. For learning, allow more inspection when needed and keep that practice separate from timed sessions.' },
    { title: 'Understand averages', body: 'An average of five removes one best and one worst attempt and averages the middle three. An average of twelve removes one best and one worst and averages the other ten. A single DNF can be discarded as the worst; two make the average DNF.' },
    { title: 'Keep the scramble context', body: 'Save attempts with their scramble and any +2 or DNF result. Revisit a poor solve to understand the decisions, rather than repeatedly chasing a new personal best.' },
    { title: 'End with a small review', body: 'Write down the case or transition that caused the biggest pause. Use the algorithm studio or a prepared lesson case to work on that exact skill next time.' },
  ] }),
  lesson({ id: 'roux', title: 'Explore Roux block building', subtitle: 'Two blocks, four corners, then the last six edges.', level: 'Advanced', stage: 'Other methods', minutes: 15, algorithm: "M U M' U'", goals: ['Understand the Roux stages', 'Study M/U moves while preserving side blocks'], steps: [
    { title: 'Build a first block', body: 'Make a 1×2×3 block in the lower-left part of the cube. Think in connected pieces rather than a complete cross. This leaves more freedom for efficient solutions.' },
    { title: 'Build the opposite block', body: 'Make a matching 1×2×3 block on the right while retaining the first. The U layer and middle slice stay free for the later stages.' },
    { title: 'Solve the remaining corners', body: 'CMLL orients and permutes the four upper corners without needing to preserve the middle-slice edges. A full CMLL repertoire has 42 cases; this studio introduces the method rather than including that separate full catalog.' },
    { title: 'Finish the last six edges', body: 'The final stage uses M and U to orient the six remaining edges, place the side upper edges, and finish the middle slice. Try this M/U study sequence and verify that the two lower side blocks stay intact.', algorithm: "M U M' U'" },
    { title: 'Compare decision styles', body: 'Roux rewards block recognition and edge tracking. Compare its free blocks with the cross-and-pair structure of CFOP, then use the linked Roux guide to continue the method-specific course.' },
  ] }),
  lesson({ id: 'zz', title: 'Explore ZZ edge orientation', subtitle: 'Prepare the edges, then build with R, U and L.', level: 'Advanced', stage: 'Other methods', minutes: 15, algorithm: "R U L' U'", goals: ['Understand EOLine', 'Observe an orientation-preserving move set'], steps: [
    { title: 'Fix a reference frame', body: 'Edge orientation is defined relative to an axis convention. Keep your front and up reference stable while identifying good and bad edges; rotating the whole cube changes the viewpoint used for recognition.' },
    { title: 'Orient the edges', body: 'ZZ begins by orienting all twelve edges. In the standard convention used in the cycle graph, U, D, R and L turns preserve edge orientation; quarter F and B turns can change it.' },
    { title: 'Build the line', body: 'EOLine also solves the DF and DB edges. From there, build left and right blocks while preserving the line and oriented edges.' },
    { title: 'Study the reduced move set', body: 'The prepared R U L′ U′ sequence demonstrates moves that preserve edge orientation. Observe the edge badges in the cycle graph while stepping.', algorithm: "R U L' U'" },
    { title: 'Finish a simpler last layer', body: 'Once F2L is complete, last-layer edges are already oriented. You can use corner orientation plus PLL, or study larger last-layer sets later. The linked ZZ tutorial supplies a full recognition course.' },
  ] }),
  lesson({ id: 'commutators', title: 'Understand commutators', subtitle: 'Build precise effects from reversible actions.', level: 'Master', stage: 'Cube theory', minutes: 15, algorithm: alg('corner-commutator'), goals: ['Read [A,B] and [S:A]', 'Connect algorithms to permutation cycles'], steps: [
    { title: 'Name the two actions', body: 'Let A be R U R′ and B be D. A commutator [A,B] is A B A′ B′. The order matters; swapping A and B reverses the commutator.' },
    { title: 'Notice the shared support', body: 'A and B each move several pieces, but much of that work is restored by their inverses. The remaining effect lives where their actions interact.' },
    { title: 'Watch the three-corner cycle', body: 'Run [R U R′, D]. The cycle graph exposes the net effect after the complete sequence: three corners move and the other physical cubies return.', algorithm: alg('corner-commutator') },
    { title: 'Move the effect with a setup', body: 'A conjugate [S:A] means S A S′. First move the desired pieces into a useful working area, perform the known action, then undo the setup.' },
    { title: 'Verify the complete state', body: 'A diagram of locations alone cannot prove correctness. Check orientations too: a corner can be in its own slot but twisted. The graph’s badges show these orientation values on 3×3.' },
  ] }),
  lesson({ id: 'blindfold-foundations', title: 'Blindfolded thinking', subtitle: 'Trace sticker targets and turn cycles into memory.', level: 'Master', stage: 'Other methods', minutes: 20, algorithm: alg('pll-t'), goals: ['Understand a buffer and target cycle', 'Distinguish sticker memo from piece locations'], steps: [
    { title: 'Choose a consistent sticker scheme', body: 'Assign a letter to each edge sticker and corner sticker. A piece has multiple possible sticker targets; memorizing only its colors loses its orientation information.' },
    { title: 'Trace from a buffer', body: 'Choose a buffer sticker. Find where the sticker currently in the buffer belongs, then follow the sticker occupying that target. Continue until the cycle closes.' },
    { title: 'Break into a new cycle', body: 'If unsolved pieces remain after returning to the buffer, choose an unvisited target and trace that cycle. Keep edge and corner memo separate.' },
    { title: 'Study a controlled swap', body: 'The T-permutation moves two edges and two corners. Old Pochmann-style methods use setup moves and controlled side effects; T alone is not an arbitrary single-edge swap.', algorithm: alg('pll-t') },
    { title: 'Handle orientation and parity explicitly', body: 'Twisted corners, flipped edges and an odd number of swaps need method-specific handling. This is a foundation lesson, not a complete blindfold solution system; continue with the linked full tutorial before blind attempts.' },
  ] }),
  lesson({ id: 'two-by-two', title: 'Solve the 2×2', subtitle: 'A corner-only puzzle with familiar last-layer ideas.', level: 'Intermediate', stage: 'Other puzzles', minutes: 10, size: 2, algorithm: alg('oll-27'), goals: ['Build a complete first layer', 'Reuse corner orientation and permutation'], steps: [
    { title: 'Create a color frame', body: 'A 2×2 has no centers. Use the color relationships of its corners to establish the frame. In the simulator, the default palette follows the same opposite-color pairs as the 3×3.' },
    { title: 'Build a complete layer', body: 'Make one face with correctly matching side colors, not just four stickers of one color. This gives a reliable first layer for a layer-by-layer solve.' },
    { title: 'Orient the upper corners', body: 'Familiar corner-orientation algorithms such as Sune work on the 2×2 too. Load this corner-only case and follow R U R′ U R U2 R′.', algorithm: alg('oll-27') },
    { title: 'Permute the remaining corners', body: 'With the top face oriented, position the corners and align the layer. At the next level, Ortega solves a face, orients the opposite face, then permutes both layers.' },
    { title: 'Choose a speed-solving path', body: 'After a reliable beginner solve, explore Ortega and then CLL or EG. Those are separate case sets, beyond the 3×3 OLL/PLL library included here.' },
  ] }),
  lesson({ id: 'big-cubes', title: 'Understand bigger cubes', subtitle: 'Centers and paired edges reduce the puzzle to a 3×3.', level: 'Advanced', stage: 'Other puzzles', minutes: 15, size: 4, algorithm: "Rw U Rw'", goals: ['Understand center and edge reduction', 'Distinguish reduction parity from a 3×3 case'], steps: [
    { title: 'Build the centers', body: 'On a 4×4 or larger cube, construct a center block for each face. Even cubes have no fixed center sticker, so preserve the intended opposite colors and their relative order.' },
    { title: 'Pair matching edge pieces', body: 'Bring the wing pieces with matching color pairs together. Restore center structure after pairing so completed pairs act as single 3×3 edges.' },
    { title: 'Understand wide moves', body: 'Rw turns the two rightmost layers together. Use the prepared Rw U Rw′ demonstration to see wings and center pieces travel as a block; it is a movement study rather than a complete pairing algorithm.', algorithm: "Rw U Rw'" },
    { title: 'Solve the reduced cube', body: 'When centers are complete and all edge groups are paired, apply your 3×3 method using outer turns. Some reduced states on even cubes need parity algorithms that do not exist on a physical 3×3.' },
    { title: 'Learn parity as its own case', body: 'A seemingly flipped reduced edge or an edge-pair swap must be recognized before choosing the appropriate larger-cube algorithm. The linked 4×4 guide supplies the exact parity sequences and holding orientations.' },
  ] }),
  lesson({ id: 'cube-state-space', title: 'Read the cube as a graph', subtitle: 'Separate physical pieces, permutations and whole states.', level: 'Master', stage: 'Cube theory', minutes: 12, algorithm: "R U R' U'", goals: ['Distinguish four graph meanings', 'Understand why state graphs are sampled'], steps: [
    { title: 'The physical topology graph', body: 'Each node is one cubie and each line joins face-adjacent cubies in the current puzzle. A 3×3 has 26 visible cubies and 48 such connections. This graph includes every physical piece.' },
    { title: 'The cross target graph', body: 'Four particular D-color edges are linked to their home targets. It answers a local planning question: where is each wanted edge, and does its orientation match?' },
    { title: 'The permutation graph', body: 'Arrows map each piece from its home slot to its current slot. Closed paths are permutation cycles. Corner-twist and edge-flip badges add information that a location-only diagram would miss.' },
    { title: 'The whole-state graph', body: 'Here a node is an entire cube arrangement. An edge means applying a legal move. The explorer shows the exact neighborhood reached by R, U and F up to two moves from the current state.' },
    { title: 'Why the graph is a sample', body: 'The fixed-center 3×3 has 43,252,003,274,489,856,000 reachable states. A useful view must choose a neighborhood, a subgroup, or a reduced problem. The studio never labels a small sample as the complete state graph.' },
  ] }),
];

export const learningStages = [...new Set(lessons.map(l => l.stage))];

/** A model-derived top view for case cards. U stickers are highlighted for OLL. */
export function algorithmPreviewSVG(algorithm, { size = algorithm.size || 3, width = 94, orientationOnly = algorithm.family === 'OLL' } = {}) {
  const cube = new CubeState(size).applyAlgorithm(invertAlgorithm(algorithm.moves));
  const faces = cube.facelets();
  const n = size, tile = 16, pad = 16, extent = n * tile + pad * 2;
  const upperColor = n % 2 ? faces.U[Math.floor(n * n / 2)] : 'U';
  const color = facelet => orientationOnly && facelet !== upperColor ? '#dce4dd' : COLORS[facelet];
  let svg = `<svg viewBox="0 0 ${extent} ${extent}" width="${width}" height="${width}" role="img" aria-label="Prepared ${algorithm.name.replace(/[&<>"']/g, '')} case, viewed from above">`;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) svg += `<rect x="${pad + c * tile}" y="${pad + r * tile}" width="${tile - 2}" height="${tile - 2}" rx="2.5" fill="${color(faces.U[r * n + c])}" stroke="#cdd8cf" stroke-width=".6"/>`;
  for (let i = 0; i < n; i++) {
    const strips = [
      [pad + i * tile, 7, tile - 2, 5, faces.B[n - 1 - i]],
      [pad + i * tile, pad + n * tile + 4, tile - 2, 5, faces.F[i]],
      [7, pad + i * tile, 5, tile - 2, faces.L[i]],
      [pad + n * tile + 4, pad + i * tile, 5, tile - 2, faces.R[n - 1 - i]],
    ];
    for (const [x, y, w, h, facelet] of strips) svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${color(facelet)}"/>`;
  }
  return svg + '</svg>';
}
