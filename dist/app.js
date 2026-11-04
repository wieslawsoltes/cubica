import { CubeState, COLORS, FACES, FACE_NAMES, FACE_NORMALS, parseAlgorithm, invertAlgorithm, invertMove, getMoveSpec, generateScramble, describeMove, normalFace } from './modules/cube.js';
import { CubeRenderer } from './modules/renderer.js';
import * as Solver from './modules/solver.js';
import { lessons, algorithms, references, algorithmPreviewSVG } from './modules/curriculum.js';
import { renderGraph, renderCubeNet, createGraphData, pieceLabel } from './modules/graphs.js';
import { effectiveTime, formatTime, formatAverage, sessionStats, inspectionPenalty, csvForSolves } from './modules/practice.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  cube:'M12 3 3.5 7.8v8.4L12 21l8.5-4.8V7.8L12 3Zm0 9v9m-8.5-13.2L12 12l8.5-4.2M7.7 5.4l8.6 4.5',
  book:'M4 4.5h5.5A3 3 0 0 1 12 6a3 3 0 0 1 2.5-1.5H20v15h-5.5A3 3 0 0 0 12 21a3 3 0 0 0-2.5-1.5H4Zm8 1.5v15',
  grid:'M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z',
  nodes:'M6 6a2.5 2.5 0 1 0 0 .1M18 5a2.5 2.5 0 1 0 0 .1M12 18a2.5 2.5 0 1 0 0 .1M8 6h7M7 8l3.5 7.5M17 7l-3.5 8.5',
  timer:'M10 2h4m-2 3v2m6-1 2 2M12 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3v4l2.5 1.5',
  sparkles:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM19 2v4m-2-2h4',
  help:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-2.5 6a2.5 2.5 0 1 1 4.3 1.7c-1.3.8-1.8 1.3-1.8 2.8m0 3h.01',
  sprout:'M12 21v-9M12 15C5 15 3 11 3 5c7 0 10 3 9 10Zm0-4C12 5 16 3 21 3c0 6-3 9-9 8Z',
  keyboard:'M3 5h18v14H3ZM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8',
  play:'m9 5 11 7-11 7V5Z',pause:'M9 5v14m6-14v14',
  menu:'M4 6h16M4 12h16M4 18h16',download:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  reset:'M3 11a9 9 0 1 1 2.7 7.1M3 4v7h7',orbit:'M20 11c0 5-4 9-8 9S4 16 4 11 8 2 12 2s8 4 8 9ZM2 14c2 4 6 3 11 1s9-5 8-7-5-1-10 1-9 4-9 5Z',
  expand:'M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5M9 9l-5-5m11 5 5-5M9 15l-5 5m11-5 5 5',
  layers:'m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',camera:'M3 7h4l2-3h6l2 3h4v14H3ZM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  shuffle:'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4',
  undo:'M3 9h11a7 7 0 0 1 0 14M3 9l5-5M3 9l5 5',redo:'M21 9H10a7 7 0 0 0 0 14m11-14-5-5m5 5-5 5',
  skipback:'M5 5v14m14-14L8 12l11 7V5Z',chevronleft:'m15 5-7 7 7 7',chevronright:'m9 5 7 7-7 7',
  arrowright:'M4 12h16m-6-6 6 6-6 6',arrowup:'M6 18 18 6M6 6h12v12',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 2',
  net:'M8 2h8v6h6v8h-6v6H8v-6H2V8h6Zm0 6h8v8H8Zm0 8v6m8-14h6',code:'m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18',
  search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5',
  star:'m12 3 2.8 5.7 6.3.9-4.5 4.5 1 6.3-5.6-3-5.6 3 1-6.3L3 9.6l6.2-.9L12 3Z',
  close:'m6 6 12 12M6 18 18 6',check:'m5 12 4 4L19 6',upload:'M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5',
  target:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 3v2',
  trophy:'M8 3h8v9a4 4 0 0 1-8 0V3Zm0 2H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5m-4 3v5m-4 0h8',
  chart:'M4 3v17h17M7 14l4-5 4 3 6-8',folder:'M3 5h7l2 3h9v12H3V5Z'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.cube}"/></svg>`;
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }

const navigation = [
  { id:'playground', name:'Playground', icon:'cube' },
  { id:'learning', name:'Learning path', icon:'book' },
  { id:'algorithms', name:'Algorithm library', icon:'grid' },
  { id:'graphs', name:'Graph explorer', icon:'nodes' },
  { id:'timer', name:'Speed trainer', icon:'timer' },
  { id:'solver', name:'Solve my cube', icon:'sparkles' }
];
navigation.forEach((item,i) => { $(i < 4 ? '#primary-nav' : '#practice-nav').insertAdjacentHTML('beforeend', `<button class="nav-item ${i===0?'active':''}" data-action="navigate" data-view="${item.id}" title="${item.name}">${icon(item.icon)}<span class="nav-text">${item.name}</span></button>`); });

const STORAGE = 'cubica.studio.v1';
let stored = {};
try { stored = JSON.parse(localStorage.getItem(STORAGE) || '{}'); if(!stored||typeof stored!=='object'||Array.isArray(stored))stored={}; } catch { /* Private browsing and stale data remain usable. */ }
let cube,restoredCube=true;
try { cube = stored.cube ? CubeState.fromSnapshot(stored.cube) : new CubeState(3); } catch { cube = new CubeState(3);restoredCube=false; }
if (!stored.cube) cube.applyAlgorithm("R U R' U' F2 D");
let view = 'playground', selectedPiece = null, busy = false, playing = false, prime = false, doubleTurn = false;
let exploded = false, xray = false, animationMs = 300, sequence = null, redoMoves = [];
let moveLog = [...(cube.history || [])].slice(-1000);
try{if(restoredCube&&Array.isArray(stored.moveLog)){const log=parseAlgorithm(stored.moveLog.slice(-1000));log.forEach(m=>getMoveSpec(m,cube.size));moveLog=log;}}catch{/* Recover with the verified model history. */}
let completed = new Set(Array.isArray(stored.completed) ? stored.completed : []);
let favorites = new Set(Array.isArray(stored.favorites) ? stored.favorites : []);
let solves = Array.isArray(stored.solves) ? stored.solves.filter(s=>s && Number.isFinite(s.ms) && s.ms>=0 && s.ms<86400000 && ['none','plus2','dnf'].includes(s.penalty)).slice(-1000) : [];
let lessonFilter='All', algorithmFilter='All', algorithmSearch='', graphMode='pieces', lessonId=null, lessonStep=0;
let paintColor='U', paintFaces=new CubeState(3).facelets(), editorMessage='', solveController=null, activeDrill=null;
let timerState='idle', timerStarted=0, inspectionStarted=0, timerPenalty='none', timerFrame=0, timerHolding=false, timerArmedAt=0;
let useInspection=!!stored.inspection, timerSize=3, currentScramble=generateScramble(3), toastTimeout, graphCleanup=[], lastSaved=true;
let drillerStarted=0, drillTimes=stored.drillTimes && typeof stored.drillTimes==='object' ? stored.drillTimes : {};
let renderer;
let manualQueue=[],manualDraining=false;

function save() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify({cube:cube.snapshot(),moveLog:moveLog.slice(-1000),completed:[...completed],favorites:[...favorites],solves,inspection:useInspection,drillTimes}));
    lastSaved=true;
  } catch { lastSaved=false; }
  $('.saved-status').innerHTML=`<span class="tiny-dot"></span> ${lastSaved?'All changes saved':'Session memory only'}`;
}
function toast(message, duration=3200) {
  clearTimeout(toastTimeout); $('#toast').textContent=message; $('#toast').classList.add('toast-visible');
  toastTimeout=setTimeout(()=>$('#toast').classList.remove('toast-visible'),duration);
}
function setBusy(next) { busy=next; $$('[data-action="reset"],[data-action="scramble"],[data-action="solve"],[data-action="undo"],[data-action="redo"],#cube-size').forEach(el=>el.disabled=next); }
function navigationTo(next, {focus=false}={}) {
  if (!navigation.some(n=>n.id===next)) next='playground';
  if(next!=='playground'&&next!=='graphs'&&playing)playing=false;
  if(next!=='timer'&&timerHolding){timerHolding=false;if(timerState==='idle')cancelAnimationFrame(timerFrame);}
  const previousView=view;view=next;
  $$('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  $$('.nav-item').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('#breadcrumb-current').textContent=navigation.find(n=>n.id===view).name;
  setMobileNavigation(false);
  history.replaceState(null,'',`#${view}`);
  if(view==='learning') renderLearning();
  if(view==='algorithms') renderAlgorithms();
  if(view==='graphs') renderGraphView();
  if(view==='timer') renderTimer();
  if(view==='solver') renderSolver();
  if(view==='playground') { if(!busy)renderer?.setCube(cube); updateCubeUI(); }
  if(previousView!==view)window.scrollTo({top:0,behavior:'auto'});
  if(focus) $('#main-content').focus({preventScroll:true});
}
function heading(eyebrow,title,subtitle,extra='') { return `<div class="page-heading"><div><div class="eyebrow"><span class="tiny-dot"></span>${eyebrow}</div><h1>${title}<span class="accent-period">.</span></h1><p>${subtitle}</p></div>${extra}</div>`; }
function updateJourney() {
  const n=lessons.filter(l=>completed.has(l.id)).length, pct=Math.round(n/lessons.length*100);
  $('#journey-copy').textContent=n?`${n} of ${lessons.length} lessons explored.`:'Your first solve starts here.';
  $('#journey-progress').style.width=`${pct}%`;
}
function refreshMoveButtons() {
  $('#move-controls').innerHTML=['R','U','F','L','D','B'].map(f=>`<button class="move-button" data-action="move" data-move="${f}${doubleTurn?'2':prime?"'":''}" style="--face-color:${COLORS[f]}" title="Turn ${FACE_NAMES[f].toLowerCase()} face${prime?' counterclockwise':''}${doubleTurn?' 180 degrees':''}">${f}${doubleTurn?'2':prime?'′':''}</button>`).join('');
}
function selectedInfo() {
  const p=cube.cubies.find(c=>c.id===selectedPiece);
  if(!p) return '<p>Select any node or sticker to trace a physical piece through the whole studio.</p>';
  const kind=['','Center','Edge','Corner'][p.stickers.length];
  const aligned=createGraphData(cube,'pieces').nodes.find(n=>n.pieceId===p.id)?.solved;
  return `<div class="selected-piece-box"><h4>${escape(pieceLabel(p))} · ${kind} piece</h4><div class="selection-swatches">${p.stickers.map(s=>`<span style="--sticker:${COLORS[s.color]}" title="${FACE_NAMES[s.color]}"></span>`).join('')}</div><p>Position (${p.position.join(', ')})<br>${aligned?'At home and correctly oriented.':'Follow the highlighted piece back to its home.'}</p><button class="text-link" data-action="navigate" data-view="playground" style="margin-top:10px">Find it in 3D ↗</button></div>`;
}
function selectPiece(id) {
  selectedPiece=selectedPiece===id?null:id; renderer?.setHighlight(selectedPiece); updateCubeUI();
  if(view==='graphs') renderGraphView();
  if(selectedPiece&&view==='playground') {const p=cube.cubies.find(c=>c.id===selectedPiece);if(p)toast(`${pieceLabel(p)} ${['','center','edge','corner'][p.stickers.length]} selected. Follow it in the net and graph.`,2200);}
}
function updateCubeUI() {
  $('#cube-size').value=String(cube.size);
  $('#state-pill').textContent=cube.isSolved()?'Beautifully solved ✓':`${cube.size} × ${cube.size} · ${selectedPiece?'Piece selected':'Keep exploring'}`;
  $('#piece-count-label').textContent=`${cube.cubies.length} pieces. One system.`;
  $('#move-count').textContent=sequence?`${sequence.cursor} / ${sequence.moves.length} moves`:`${moveLog.length} ${moveLog.length===1?'move':'moves'}`;
  $('#timeline-title').textContent=sequence?sequence.title.toUpperCase():'MOVE JOURNEY';
  const offset=sequence?Math.max(0,sequence.cursor-24):0;
  const visible=sequence?sequence.moves.slice(offset,offset+64):moveLog.slice(-40);
  $('#move-timeline').innerHTML=visible.length?visible.map((move,i)=>`<span class="move-chip ${sequence?(i+offset<sequence.cursor?'done':'')+(i+offset===sequence.cursor?' current':''):'done'}" title="${escape(describeMove(move,cube.size))}">${escape(move.replaceAll("'",'′'))}</span>`).join(''):'<span class="empty-timeline">Make a move. See what changes.</span>';
  $('#move-explanation').textContent=sequence?(sequence.cursor<sequence.moves.length?`Next: ${describeMove(sequence.moves[sequence.cursor],cube.size)}`:cube.isSolved()?'Solved. Take a moment to see how the pieces came home.':'Sequence complete. Explore how it changed the cube.'):moveLog.length?describeMove(moveLog.at(-1),cube.size):'Every letter is a face. Every turn tells a story.';
  $('[data-action="play"]').innerHTML=icon(playing?'pause':'play');
  $('[data-action="play"]').setAttribute('aria-label',playing?'Pause sequence':'Play sequence');
  for (const cleanup of graphCleanup) cleanup?.(); graphCleanup=[];
  graphCleanup.push(renderGraph($('#mini-graph'),{cube,mode:'pieces',selectedPiece,onSelect:selectPiece}));
  graphCleanup.push(renderCubeNet($('#cube-net'),cube,{selectedPiece,onSelect:selectPiece}));
  const chip=$('.move-chip.current');if(chip){const track=$('#move-timeline'),c=chip.getBoundingClientRect(),t=track.getBoundingClientRect();if(c.right>t.right)track.scrollLeft+=c.right-t.right+8;else if(c.left<t.left)track.scrollLeft-=t.left-c.left+8;}
  if(!busy) {$('[data-action="undo"]').disabled=!moveLog.length;$('[data-action="redo"]').disabled=!redoMoves.length;}
  updateJourney();
}
async function performMoves(moves,{record=true,onStep=null}={}) {
  if(busy) {toast('Let this turn finish first.');return false;}
  const tokens=parseAlgorithm(moves);
  for(const token of tokens)getMoveSpec(token,cube.size);
  setBusy(true);
  try {
    for(const token of tokens) {
      const finished=await renderer.animateMove(getMoveSpec(token,cube.size),matchMedia('(prefers-reduced-motion: reduce)').matches?0:animationMs);
      if(!finished){playing=false;return false;}
      cube.applyMove(token);
      if(record)moveLog.push(token);
      renderer.setCube(cube);
      onStep?.(token);
      updateCubeUI();
      if(view==='graphs')renderGraphView();
      if(playing===false && onStep)break;
    }
    save();
    if(cube.isSolved()&&tokens.length) {
      if(activeDrill&&drillerStarted) {
        const elapsed=performance.now()-drillerStarted;
        const list=Array.isArray(drillTimes[activeDrill])?drillTimes[activeDrill]:[];
        list.push(elapsed);drillTimes[activeDrill]=list.slice(-100);save();
        toast(`Case solved in ${formatTime(elapsed)}. Nice work!`,5000); drillerStarted=0;activeDrill=null;
      } else toast('That satisfying moment: solved. ✓');
    }
    return true;
  } catch(error) { toast(error.message,5000);return false; }
  finally {setBusy(false);updateCubeUI();if(!manualDraining&&manualQueue.length)setTimeout(drainManualQueue,0);}
}
async function manualMove(token) {
  try{
    const tokens=parseAlgorithm(token);tokens.forEach(m=>getMoveSpec(m,cube.size));
    if(manualQueue.length+tokens.length>64){toast('Let the queued moves finish first.');return;}
    manualQueue.push(...tokens);if(playing)playing=false;
    await drainManualQueue();
  }catch(error){toast(error.message,5000);}
}
async function drainManualQueue(){
  if(busy||manualDraining||!manualQueue.length)return;
  manualDraining=true;sequence=null;redoMoves=[];
  try{while(manualQueue.length){if(activeDrill&&!drillerStarted)drillerStarted=performance.now();const token=manualQueue.shift();if(!await performMoves([token])){manualQueue=[];break;}}}
  finally{manualDraining=false;}
}
function replaceCube(next,{log=[],clearSequence=true}={}) {
  if(busy){toast('Pause playback and let the current turn finish.');return false;}
  cube=next;moveLog=log;redoMoves=[];manualQueue=[];selectedPiece=null;renderer.setHighlight(null);renderer.setCube(cube);
  if(clearSequence)sequence=null;playing=false;activeDrill=null;drillerStarted=0;
  updateCubeUI();save();return true;
}
function resetCube(size=cube.size) { if(replaceCube(new CubeState(size)))toast(`${size} × ${size} reset. A fresh perspective.`); }
function scrambleCube() {
  const moves=generateScramble(cube.size);if(replaceCube(new CubeState(cube.size).applyAlgorithm(moves),{log:[...moves]}))toast('A new practice scramble is ready.');
}
function loadSequence(moves,title,{setup=null,size=3,replace=false,drill=false}={}) {
  if(busy){toast('Pause playback and let the current turn finish.');return;}
  const tokens=parseAlgorithm(moves);
  if(!tokens.length){toast('Add at least one move.');return;}
  const next=replace?new CubeState(size):cube.clone();
  tokens.forEach(m=>getMoveSpec(m,next.size));
  if(setup)next.applyAlgorithm(setup);
  if(replace||setup)replaceCube(next,{log:[...(next.history||[])]});
  sequence={title,moves:tokens,cursor:0,base:cube.snapshot(),baseLog:[...moveLog]};playing=false;activeDrill=null;drillerStarted=0;
  navigationTo('playground');updateCubeUI();
  if(drill){activeDrill=drill;drillerStarted=0;toast('Recognition drill ready. Your first manual turn starts the case timer. Auto-play is a demonstration.',5000);}
  else toast(`${title} loaded. Step through it or press play.`);
}
async function sequenceStep(direction=1) {
  if(busy)return;
  if(!sequence){toast('Load an algorithm or ask for a solution first.');return;}
  activeDrill=null;drillerStarted=0;
  if(direction>0&&sequence.cursor<sequence.moves.length) {const ok=await performMoves([sequence.moves[sequence.cursor]]);if(ok)sequence.cursor++;}
  else if(direction<0&&sequence.cursor>0) {const ok=await performMoves([invertMove(sequence.moves[sequence.cursor-1])]);if(ok)sequence.cursor--;}
  updateCubeUI();
}
async function playSequence() {
  if(playing){playing=false;updateCubeUI();return;}
  if(busy)return;
  if(!sequence){try{loadSequence($('#algorithm-input').value,'Your sequence',{size:cube.size});}catch(error){toast(error.message,5000);return;}}
  if(!sequence)return;
  if(sequence.cursor===sequence.moves.length){cube=CubeState.fromSnapshot(sequence.base);moveLog=[...sequence.baseLog];sequence.cursor=0;renderer.setCube(cube);}
  activeDrill=null;drillerStarted=0;playing=true;
  await performMoves(sequence.moves.slice(sequence.cursor),{onStep:()=>sequence.cursor++});
  playing=false;updateCubeUI();
}
function rewindSequence(){if(busy)return;if(!sequence){toast('Load a sequence first.');return;}cube=CubeState.fromSnapshot(sequence.base);moveLog=[...sequence.baseLog];sequence.cursor=0;renderer.setCube(cube);save();updateCubeUI();}
async function undoMove(){if(busy||!moveLog.length)return;activeDrill=null;drillerStarted=0;const token=moveLog.at(-1);sequence=null;if(await performMoves([invertMove(token)],{record:false})){moveLog.pop();redoMoves.push(token);save();updateCubeUI();}}
async function redoMove(){if(busy||!redoMoves.length)return;activeDrill=null;drillerStarted=0;const token=redoMoves.pop();sequence=null;await performMoves([token]);}

function showDialog(title,subtitle,body){$('#dialog-content').innerHTML=`<div class="dialog-head"><div><h2>${escape(title)}</h2>${subtitle?`<p>${escape(subtitle)}</p>`:''}</div><button class="icon-button" data-action="close-dialog" aria-label="Close dialog">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;if(!$('#app-dialog').open)$('#app-dialog').showModal();}
async function requestSolution(cross=false) {
  if(busy||manualQueue.length||solveController){toast('Let the current moves finish first.');return;}
  if(cross&&cube.size!==3){toast('The cross planner uses a 3 × 3 cube.');return;}
  if(cube.isSolved()){toast('This cube is already solved. Try a scramble.');return;}
  const before=cube.signature();solveController=new AbortController();
  showDialog(cross?'Find a shorter cross':'Bring every piece home',cross?'An exact search through the four-edge cross.':'An offline search, checked against your actual cube.',`<div class="feedback-bar"><span class="busy-pulse">${icon('sparkles')}</span><span id="solver-progress">Preparing the solver…</span></div><p>${cross?'The planner finds the shortest face-turn sequence for the yellow D cross. Other pieces may move.':cube.size<=3?'The solver finds a valid solution and explains each turn. Use the learning path for human method strategies.':'For 4 × 4 through 7 × 7, this replays a verified inverse of your recorded moves.'}</p><button class="button light" data-action="cancel-solve">Cancel search</button>`);
  try {
    const options={signal:solveController.signal,onProgress:p=>{const el=$('#solver-progress');if(el)el.textContent=p.message;}};
    const result=await (cross?Solver.solveCross(cube,{...options,color:'D'}):Solver.solveCube(cube,options));
    if(before!==cube.signature())throw new Error('The cube changed during the search. Please solve the new position.');
    $('#app-dialog').close();
    if(!result.moves.length){toast(cross?'The bottom cross is already solved.':'Already solved.');return;}
    loadSequence(result.moves,cross?'Shortest bottom cross':'Your solution',{size:cube.size});
    toast(`${result.moves.length} moves · ${result.method}. Play or step to see why each turn matters.`,6000);
  }catch(error){if(error.name==='AbortError')toast('Search cancelled. Your cube is unchanged.');else showDialog('Let’s check this cube','Your state is unchanged.',`<p class="error-copy">${escape(error.message)}</p><button class="button dark" data-action="close-dialog">Back to the cube</button>`);}
  finally{solveController=null;}
}

function referencesMarkup(){return `<details class="references"><summary>Sources, conventions &amp; further learning</summary><ul>${references.map(r=>`<li><a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">${escape(r.title)} ↗</a></li>`).join('')}</ul><p style="font-size:10px;margin-top:10px">Original lessons and live diagrams. Standard move notation. Default color frame: ivory U, yellow D, teal F. Practice scrambles use random moves; they are not official competition random-state scrambles.</p></details>`;}
function renderLearning(){
  const done=lessons.filter(l=>completed.has(l.id)).length;
  const shown=lessons.filter(l=>lessonFilter==='All'||(lessonFilter==='Completed'?completed.has(l.id):String(l.level).toLowerCase().includes(lessonFilter.toLowerCase())));
  $('#view-learning').innerHTML=heading('YOUR JOURNEY, ONE IDEA AT A TIME','From your first turn to your best solve','Build understanding before speed. Every lesson has something you can try.')+`<div class="progress-overview"><div class="progress-ring" style="--progress:${done/lessons.length*100}%"><span>${done}/${lessons.length}</span></div><div><h3>Good solvers see patterns. Great solvers understand them.</h3><p>Follow the path in order, or explore the idea you’re curious about.</p></div><button class="button dark" data-action="continue-learning">${done?'Continue learning':'Start at the beginning'} ${icon('arrowright')}</button></div><div class="section-toolbar"><div class="filter-tabs" role="group" aria-label="Lesson level">${['All','Beginner','Intermediate','Advanced','Master','Completed'].map(f=>`<button class="filter-tab ${lessonFilter===f?'active':''}" data-action="lesson-filter" data-filter="${f}">${f}</button>`).join('')}</div><span class="mini-metric">${shown.length} lessons to explore</span></div><div class="lesson-list">${shown.map((l)=>`<button class="panel lesson-card ${completed.has(l.id)?'completed':''}" data-action="open-lesson" data-id="${escape(l.id)}"><span class="lesson-number">${String(lessons.indexOf(l)+1).padStart(2,'0')}</span><span class="lesson-level">${escape(l.level)}</span><h3>${escape(l.title)}</h3><p>${escape(l.subtitle)}</p><div class="card-bottom"><span>${icon('clock')} ${l.minutes||5} min · ${(l.steps||[]).length} steps</span><span>${completed.has(l.id)?'Revisit': 'Explore lesson'} ↗</span></div></button>`).join('')||'<div class="empty-state"><h3>Your next discovery is waiting.</h3><p>Completed lessons appear here. Open a lesson and work through its steps.</p></div>'}</div>${referencesMarkup()}`;
}
function openLesson(id,step=0){lessonId=id;lessonStep=step;renderLesson();}
function renderLesson(){
  const lesson=lessons.find(l=>l.id===lessonId);if(!lesson)return;
  lessonStep=Math.max(0,Math.min(lesson.steps.length-1,lessonStep));
  const step=lesson.steps[lessonStep],algorithm=step.algorithm||null;
  showDialog(lesson.title,`${lesson.level} · ${lesson.minutes||5} minutes · ${lesson.subtitle}`,`<div class="lesson-progress-dots">${lesson.steps.map((_,i)=>`<span class="${i<lessonStep?'done':i===lessonStep?'active':''}"></span>`).join('')}</div><div class="lesson-step-label">STEP ${lessonStep+1} OF ${lesson.steps.length}</div><h3 class="lesson-step-title">${escape(step.title)}</h3><p>${escape(step.body).replaceAll('\n','<br>')}</p>${algorithm?`<div class="modal-alg-code">${escape(algorithm)}</div><button class="button outlined" data-action="lesson-demo">${icon('play')} Try this prepared case in 3D</button>`:''}${step.tip?`<div class="lesson-tip"><strong>Notice this.</strong> ${escape(step.tip)}</div>`:''}${lessonStep===0&&lesson.goals?`<ul class="goals-list">${lesson.goals.map(g=>`<li>${escape(g)}</li>`).join('')}</ul>`:''}<div class="lesson-navigation"><button class="button light" data-action="lesson-prev" ${lessonStep===0?'disabled':''}>${icon('chevronleft')} Back</button><span class="lesson-nav-caption">Go at your own pace.</span><div>${lessonStep<lesson.steps.length-1?`<button class="button dark" data-action="lesson-next">Next idea ${icon('arrowright')}</button>`:`<button class="button dark" data-action="lesson-complete">${icon('check')} Mark complete</button>`}</div></div>`);
}
function lessonDemo(){
  const l=lessons.find(x=>x.id===lessonId),step=l?.steps[lessonStep];if(!step?.algorithm)return;
  $('#app-dialog').close();const size=l.size||step.size||3;
  loadSequence(step.algorithm,step.title,{setup:step.setup||invertAlgorithm(step.algorithm),replace:true,size});
  const prior=$('#lesson-return-banner');prior?.remove();
  $('#view-playground').insertAdjacentHTML('afterbegin',`<div class="feedback-bar" id="lesson-return-banner">${icon('book')}<span>Learning: ${escape(l.title)} · Step ${lessonStep+1}</span><button class="button light small" data-action="return-lesson">Back to lesson ${icon('arrowright')}</button><button class="icon-button" data-action="dismiss-lesson-banner" aria-label="Dismiss lesson banner">${icon('close')}</button></div>`);
}

function algorithmMatches(a){
  const text=`${a.name} ${a.family} ${a.description} ${a.moves}`.toLowerCase();
  const family=String(a.family).toLowerCase(),filter=algorithmFilter.toLowerCase();
  return(!algorithmSearch||text.includes(algorithmSearch.toLowerCase()))&&(algorithmFilter==='All'||algorithmFilter==='Saved'&&favorites.has(a.id)||filter==='beginner'&&String(a.level).toLowerCase().includes('beginner')||family.includes(filter));
}
function renderAlgorithms(){
  const filtered=algorithms.filter(algorithmMatches);
  $('#view-algorithms').innerHTML=heading('THE ALGORITHM LAB','Patterns become second nature','Explore a case. Watch the pieces. Practice until your hands understand.')+`<div class="section-toolbar"><div class="filter-tabs" role="group" aria-label="Algorithm family">${['All','Beginner','F2L','OLL','PLL','Saved'].map(f=>`<button class="filter-tab ${algorithmFilter===f?'active':''}" data-action="algorithm-filter" data-filter="${f}">${f}${f==='Saved'?` (${favorites.size})`:''}</button>`).join('')}</div><div class="search-wrap">${icon('search')}<input class="search-input" id="algorithm-search" type="search" aria-label="Search algorithms" placeholder="Search a case or sequence…" value="${escape(algorithmSearch)}"></div></div><div class="library-count">${filtered.length} algorithms · Full 57 OLL and 21 PLL catalogs, plus foundational patterns.</div><div class="algorithm-grid">${filtered.map(a=>`<article class="panel algorithm-card ${favorites.has(a.id)?'favorited':''}"><div class="algorithm-card-top"><h3>${escape(a.name)}</h3><span class="family-badge">${escape(a.family)}</span></div><div class="case-preview">${algorithmPreviewSVG(a,{width:96})}<span>VIEW FROM ABOVE</span></div><p class="algorithm-description">${escape(a.description||a.recognition||'Explore the pieces, then put the pattern into practice.')}</p><div class="alg-code">${escape(a.moves)}</div><div class="algorithm-buttons"><button class="button dark" data-action="algorithm-demo" data-id="${escape(a.id)}">${icon('play')} Explore case</button><button class="button outlined" data-action="algorithm-drill" data-id="${escape(a.id)}">${icon('target')} Train</button><button class="icon-button favorite-button" data-action="favorite" data-id="${escape(a.id)}" aria-label="${favorites.has(a.id)?'Unsave':'Save'} ${escape(a.name)}" aria-pressed="${favorites.has(a.id)}">${icon('star')}</button></div><button class="text-link" data-action="algorithm-detail" data-id="${escape(a.id)}" style="margin-top:14px;font-size:9px">Recognition &amp; technique ↗</button></article>`).join('')||'<div class="panel empty-state"><h3>No patterns found yet.</h3><p>Try a different search or save a few favorites.</p></div>'}</div>${referencesMarkup()}`;
}
function loadAlgorithm(id,drill=false){const a=algorithms.find(x=>x.id===id);if(!a)return;$('#app-dialog').close();loadSequence(a.moves,a.name,{replace:true,size:a.size||3,setup:a.setup||invertAlgorithm(a.moves),drill:drill?a.id:false});}
function showAlgorithm(id){const a=algorithms.find(x=>x.id===id);if(!a)return;const times=drillTimes[id]||[];showDialog(a.name,`${a.family} · ${a.level}`,`<div class="detail-case-preview">${algorithmPreviewSVG(a,{width:160})}</div><h3>Recognize the pattern</h3><p>${escape(a.recognition||a.description)}</p><div class="modal-alg-code">${escape(a.moves)}</div><h3>Make it flow</h3><p>${escape(Array.isArray(a.tips)?a.tips.join(' '):a.tips||'Start slowly. Group moves into familiar triggers, and watch the affected pieces before trying to turn faster.')}</p>${times.length?`<p>${times.length} practice attempts · Best ${formatTime(Math.min(...times))}</p>`:''}<div class="study-mode-row"><button class="button dark" data-action="algorithm-demo" data-id="${escape(id)}">${icon('play')} Explore the prepared case</button><button class="button outlined" data-action="algorithm-drill" data-id="${escape(id)}">${icon('target')} Practice recognition</button></div><p style="font-size:10px;margin-top:18px">Each demo starts from the inverse of this algorithm, so the displayed sequence returns the cube to solved. In a full solve, recognize the case and adjust U or your viewing angle first.</p>`);}

function graphCopy(){return {
  pieces:{title:'The whole cube, connected',description:'Every node is one physical piece. A line joins pieces that currently share a face boundary. Concentric rings organize centers, edges, and corners.',note:'This is the complete physical piece graph for the current cube size. Turn a face to change its connections.'},
  cross:{title:'Four edges. One clear goal.',description:'The yellow D center anchors this cross. Each colored edge connects its current location to its matching home. Both sticker orientation and side-center alignment matter.',note:'The lesson uses yellow on the bottom. The strategy is the same for a white cross or any starting color.'},
  states:{title:'A map of possible next moves',description:'Each circle is a distinct reachable cube state. Lines are labeled with the move that connects them. Explore the local neighborhood of your current position.',note:'A finite local state graph, not the entire cube group. The full 3×3 group is too large to draw; this view deliberately shows a bounded sample.'},
  cycles:{title:'Follow the permutation',description:'A directed cycle tells you which piece occupies the next piece’s home. Position and sticker orientation are different: a piece may sit at home and still need a twist or flip.',note:'Whole-cube rotations change the color frame. Use Reset camera for the view alone, or x/y/z notation to physically rotate the cube.'}
}[graphMode];}
function renderGraphView(){
  const copy=graphCopy(),data=createGraphData(cube,graphMode);
  $('#view-graphs').innerHTML=heading('LOOK BENEATH THE COLORS','Everything is connected','Discover the structure behind the puzzle. Your diagrams move with your cube.',`<button class="button light" data-action="navigate" data-view="playground">${icon('cube')} Back to 3D</button>`)+`<div class="section-toolbar"><div class="filter-tabs" role="group" aria-label="Graph type">${[['pieces','Piece topology'],['cross','Cross map'],['cycles','Permutation cycles'],['states','State space']].map(([id,label])=>`<button class="filter-tab ${id===graphMode?'active':''}" data-action="graph-mode" data-mode="${id}">${label}</button>`).join('')}</div><span class="mini-metric">${cube.size} × ${cube.size} · Linked to your live cube</span></div><div class="graph-layout"><article class="panel large-graph-panel"><div class="graph-head"><h2>${escape(data.title||copy.title)}</h2><span>${data.nodes.length} nodes · ${data.edges.length} connections</span></div><div id="large-graph" class="large-graph"></div><div class="graph-explanation">${escape(data.subtitle||copy.description)}</div></article><aside class="panel graph-detail"><h3>${copy.title}</h3><p>${copy.description}</p>${selectedInfo()}<div class="graph-stat"><span>Physical pieces</span><strong>${cube.cubies.length}</strong></div><div class="graph-stat"><span>Graph nodes</span><strong>${data.nodes.length}</strong></div><div class="graph-stat"><span>Connections</span><strong>${data.edges.length}</strong></div><div class="graph-legend-row"><span class="legend-circle" style="--legend-color:#92b777"></span>Aligned piece / target reached</div><div class="graph-legend-row"><span class="legend-circle" style="--legend-color:#d6ae66"></span>Piece still finding its place</div><div class="notice">${copy.note}</div>${graphMode==='cross'?'<button class="button dark" data-action="solve-cross">Plan the shortest cross ↗</button>':''}<div class="graph-controls">${['R','U','F'].map(m=>`<button class="move-button" data-action="move" data-move="${m}">${m}</button>`).join('')}<button class="move-button" data-action="scramble" title="Scramble">${icon('shuffle')}</button></div><div id="graph-view-net" class="graph-view-net"></div></aside></div>`;
  renderGraph($('#large-graph'),{cube,mode:graphMode,selectedPiece,onSelect:selectPiece,onMove:manualMove});
  renderCubeNet($('#graph-view-net'),cube,{selectedPiece,onSelect:selectPiece});
}

function currentSessionSolves(){return solves.filter(s=>(s.size||3)===timerSize);}
function renderTimer(){
  const session=currentSessionSolves(),stats=sessionStats(session);
  $('#view-timer').innerHTML=heading('LESS RUSH. MORE FLOW.','Find your rhythm','A quiet place for deliberate practice, good habits, and personal bests.',`<label><span class="sr-only">Practice cube size</span><select id="timer-size" class="small-select">${[2,3,4,5,6,7].map(s=>`<option value="${s}" ${s===timerSize?'selected':''}>${s} × ${s}</option>`).join('')}</select></label>`)+`<div class="timer-layout"><div><article class="panel timer-card"><div class="scramble-label">YOUR NEXT PRACTICE SCRAMBLE</div><div class="scramble-code" id="timer-scramble">${escape(currentScramble.join(' '))}</div><button class="timer-display" id="timer-display" data-action="timer-toggle" aria-label="Start or stop solve timer">${timerState==='idle'&&session.length?formatTime(effectiveTime(session.at(-1))):'0.00'}</button><div class="timer-status" id="timer-status">${timerState==='idle'?'Take a breath. You’ve got this.':''}</div><div class="timer-help"><kbd>Space</kbd> Hold to get ready. Release to start. Press again to stop.</div><div class="timer-bottom"><label class="toggle-label"><input id="inspection-toggle" type="checkbox" ${useInspection?'checked':''}>15-second inspection</label><button class="button light small" data-action="timer-scramble">${icon('shuffle')} New scramble</button><button class="icon-button" data-action="timer-cube" aria-label="Preview this scramble in 3D" title="Preview this scramble">${icon('cube')}</button></div></article><div class="session-stats"><div class="stat-card"><span>PERSONAL BEST</span><strong>${formatTime(stats.best)}</strong></div><div class="stat-card"><span>AVERAGE OF 5</span><strong>${formatAverage(stats.ao5)}</strong></div><div class="stat-card"><span>AVERAGE OF 12</span><strong>${formatAverage(stats.ao12)}</strong></div></div><article class="panel timer-chart"><h3>Your progress, one solve at a time</h3>${timerChart(session)}</article><p class="timer-note">Practice scrambles are random-move sequences, not official WCA random-state scrambles. Averages of 5 and 12 remove the best and worst results; two DNFs make an average DNF. Timing continues if you switch tabs. Inspection adds +2 at 15 seconds and DNF at 17 seconds.</p></div><aside class="panel times-panel"><div class="panel-header"><div class="panel-title">${icon('clock')}<h2>Your session</h2></div><span class="quiet-label">${session.length} ${session.length===1?'SOLVE':'SOLVES'}</span></div><div class="times-list">${session.length?session.slice().reverse().map((s,i)=>`<div class="time-row"><span>${session.length-i}</span><strong>${formatTime(effectiveTime(s))}${s.penalty==='plus2'?'+':''}</strong><small>${new Date(s.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small><button data-action="penalty" data-id="${s.id}" data-penalty="plus2" class="${s.penalty==='plus2'?'selected':''}" aria-label="Toggle two-second penalty for solve ${session.length-i}">+2</button><button data-action="penalty" data-id="${s.id}" data-penalty="dnf" class="${s.penalty==='dnf'?'selected':''}" aria-label="Toggle DNF for solve ${session.length-i}">DNF</button></div>`).join(''):'<div class="times-empty">Every personal best starts<br>with a first attempt.<br><br>Yours goes here.</div>'}</div><div class="times-actions"><button class="text-link" data-action="export-times">Export CSV ↗</button><button class="text-link" data-action="delete-last-time" ${session.length?'':'disabled'}>Remove last</button></div><div style="padding:12px 20px 24px"><h3 style="font-size:11px;color:#809c65">Practice with intention</h3><p style="font-size:10px;color:#a0b08d;margin-top:8px">Look ahead during slow solves. A smooth transition is often worth more than a faster turn.</p></div></aside></div>`;
  if(timerState!=='idle')updateTimerDisplay();
}
function timerChart(session){
  const recent=session.slice(-30);const values=recent.map(effectiveTime);const finite=values.filter(Number.isFinite);
  if(finite.length<2)return '<svg viewBox="0 0 600 125" role="img" aria-label="Your time chart will appear after two completed solves"><path d="M30 100h550M30 60h550M30 20h550" stroke="#edf2e4" stroke-dasharray="4 6"/><text x="300" y="68" text-anchor="middle" fill="#afbe9b" font-size="11">Your story takes shape after two solves.</text></svg>';
  const lo=Math.min(...finite)*.9,hi=Math.max(...finite)*1.1;const x=i=>30+i/(recent.length-1)*540,y=v=>100-(v-lo)/(hi-lo||1)*80;
  const paths=[];let current=[];values.forEach((v,i)=>{if(Number.isFinite(v))current.push(`${current.length?'L':'M'}${x(i)},${y(v)}`);else{if(current.length)paths.push(current.join(' '));current=[];}});if(current.length)paths.push(current.join(' '));
  return `<svg viewBox="0 0 600 125" role="img" aria-label="Solve times from oldest to newest, in seconds"><path d="M30 100h540M30 60h540M30 20h540" stroke="#edf2e4" stroke-dasharray="4 6"/>${paths.map(p=>`<path d="${p}" fill="none" stroke="#a5c085" stroke-width="2"/>`).join('')}${values.map((v,i)=>Number.isFinite(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="3.2" fill="#7da55d"><title>Solve ${session.length-recent.length+i+1}: ${formatTime(v)}</title></circle>`:`<text x="${x(i)}" y="110" text-anchor="middle" fill="#c69b7c" font-size="8">DNF</text>`).join('')}<text x="30" y="122" fill="#aabb95" font-size="8">Older</text><text x="570" y="122" text-anchor="end" fill="#aabb95" font-size="8">Latest</text><text x="5" y="24" fill="#aabb95" font-size="8">${(hi/1000).toFixed(0)}s</text><text x="5" y="104" fill="#aabb95" font-size="8">${(lo/1000).toFixed(0)}s</text></svg>`;
}
function updateTimerDisplay(){
  const el=$('#timer-display'),status=$('#timer-status');if(!el)return;
  if(timerState==='inspection') {const t=performance.now()-inspectionStarted;el.textContent=String(Math.max(0,Math.ceil((15000-t)/1000)));status.textContent=t>=17000?'Inspection expired · DNF':t>=15000?'Inspection overtime · +2 penalty':'Inspect the cube. Press Space or tap when ready.';el.classList.remove('running');el.classList.add('armed');}
  else if(timerState==='running'){el.textContent=formatTime(performance.now()-timerStarted);status.textContent='Find the flow. Press Space or tap to finish.';el.classList.add('running');el.classList.remove('armed');}
  else if(timerHolding){el.classList.toggle('armed',performance.now()-timerArmedAt>=300);status.textContent=performance.now()-timerArmedAt>=300?'Ready. Release Space.':'Hold for a moment…';}
}
function timerTick(){updateTimerDisplay();if(timerState!=='idle'||timerHolding)timerFrame=requestAnimationFrame(timerTick);}
function toggleTimer(){
  if(timerState==='idle'){
    if(useInspection){timerState='inspection';inspectionStarted=performance.now();timerPenalty='none';}
    else {timerState='running';timerStarted=performance.now();timerPenalty='none';}
    cancelAnimationFrame(timerFrame);timerTick();
  } else if(timerState==='inspection'){timerPenalty=inspectionPenalty(performance.now()-inspectionStarted);timerState='running';timerStarted=performance.now();}
  else {const ms=performance.now()-timerStarted;timerState='idle';cancelAnimationFrame(timerFrame);solves.push({id:crypto.randomUUID(),ms,penalty:timerPenalty,scramble:currentScramble.join(' '),size:timerSize,date:new Date().toISOString()});solves=solves.slice(-1000);currentScramble=generateScramble(timerSize);save();renderTimer();}
}
function newTimerScramble(){if(timerState!=='idle'){toast('Finish this attempt before changing the scramble.');return;}currentScramble=generateScramble(timerSize);renderTimer();}

function renderSolver(){
  const counts=Object.fromEntries(FACES.map(f=>[f,0]));Object.values(paintFaces).flat().forEach(c=>counts[c]++);
  $('#view-solver').innerHTML=heading('A WAY FORWARD, FROM ANY POSITION','Let’s solve your cube','Bring in a real 3 × 3, or pick up exactly where you left off.')+`<div class="solver-layout"><article class="panel solver-editor"><h2>Tell the studio what you see</h2><p>Choose a color, then paint its stickers. Hold ivory on top and teal in front. Centers stay fixed. The net’s back face is viewed straight on from behind the cube.</p><div class="paint-palette" role="group" aria-label="Sticker color">${FACES.map(f=>`<button class="paint-color ${paintColor===f?'active':''}" data-action="paint-color" data-color="${f}" style="--sticker:${COLORS[f]}" aria-label="Paint ${f} ${colorName(f)}" aria-pressed="${paintColor===f}">${paintColor===f?'':f}</button>`).join('')}</div><div class="face-editor">${FACES.map(f=>`<div class="edit-face" data-face="${f}" aria-label="${FACE_NAMES[f]} face">${paintFaces[f].map((color,i)=>`<button class="paint-sticker" style="--sticker:${COLORS[color]}" data-action="paint-sticker" data-face="${f}" data-index="${i}" aria-label="${FACE_NAMES[f]} face row ${Math.floor(i/3)+1} column ${i%3+1}: ${colorName(color)}" ${i===4?'disabled':''}>${i===4?f:''}</button>`).join('')}</div>`).join('')}</div><div class="face-counts">${FACES.map(f=>`<span class="${counts[f]!==9?'invalid':''}"><i style="--sticker:${COLORS[f]}"></i>${counts[f]}/9</span>`).join('')}</div>${editorMessage?`<div class="${editorMessage.startsWith('✓')?'solver-success':'solver-error'}">${escape(editorMessage)}</div>`:''}<div class="solver-editor-actions"><button class="button dark" data-action="solve-painted">${icon('sparkles')} Check &amp; solve</button><button class="button outlined" data-action="editor-current">Use playground cube</button><button class="button light" data-action="editor-reset">Clear to solved</button></div><details style="margin-top:25px"><summary style="font-size:10px;color:#95aa7e;cursor:pointer">Import a facelet string</summary><p style="font-size:10px;margin-top:12px">Paste 54 letters in URFDLB order: 9 facelets per face, row by row. Letters are U R F D L B.</p><textarea id="facelet-input" class="source-input" rows="3" aria-label="54-character facelet string" placeholder="UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"></textarea><button class="button light small" data-action="import-facelets">Load facelets</button></details></article><aside class="panel solver-info">${icon('sparkles')}<h3>Understand the way<br>back to solved.</h3><p>Your cube is checked before searching. Impossible twists, flipped edges, and parity errors are explained, so you can correct the stickers.</p><ul><li>Full legal-state validation</li><li>Offline two-phase search</li><li>Animated move-by-move playback</li><li>Live diagrams for every turn</li><li>No images or data uploaded</li></ul><button class="button outlined" data-action="import">${icon('upload')} Import a saved cube</button><p style="font-size:10px">The automatic solver supports any legal 3 × 3 or 2 × 2 position. Larger cubes use their verified studio move history. Human solving methods are taught in Learning path.</p></aside></div>`;
}
function colorName(f){return {U:'ivory',R:'coral',F:'teal',D:'yellow',L:'orange',B:'blue'}[f];}
async function solvePainted(){
  try{const next=CubeState.fromFacelets(paintFaces);if(!replaceCube(next))return;editorMessage='✓ This is a legal cube. Ready to find a solution.';renderSolver();if(next.isSolved())toast('Your painted cube is already solved.');else await requestSolution();}
  catch(error){editorMessage=error.message;renderSolver();}
}

function download(name,text,type='application/json'){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function exportCube(){download(`cubica-${cube.size}x${cube.size}.json`,JSON.stringify({app:'Cubica',version:1,cube:cube.snapshot(),moveLog,exportedAt:new Date().toISOString()},null,2));toast('Your cube snapshot is ready to keep.');}
function showHelp(notationOnly=false){showDialog(notationOnly?'The language of turns':'A few helpful shortcuts','Small controls. A world of possibilities.',`<table class="shortcut-table"><tbody><tr><td><kbd>R</kbd> <kbd>L</kbd> <kbd>U</kbd> <kbd>D</kbd> <kbd>F</kbd> <kbd>B</kbd></td><td>Turn the right, left, up, down, front, or back face clockwise as seen looking directly at that face.</td></tr><tr><td><kbd>Shift</kbd> + face key</td><td>Turn counterclockwise. A prime (′) means inverse.</td></tr><tr><td><kbd>Alt</kbd> + face key</td><td>A half turn (180°), written R2, U2, and so on.</td></tr><tr><td>x · y · z</td><td>Rotate the whole cube around the right, up, or front axis. The camera orbit leaves the cube state unchanged.</td></tr><tr><td>Rw · r · 3Rw</td><td>Turn two layers together, or three with an explicit width. M, E, S are middle slices on odd-layer cubes.</td></tr><tr><td>(R U R′ U′)6</td><td>Repeat a group. [A,B] expands to A B A′ B′; [A:B] expands to A B A′.</td></tr><tr><td>Drag · wheel</td><td>Orbit and zoom. Pinch to zoom on touch screens. Double-click a visible face to turn; Shift-click turns it inversely.</td></tr><tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Step backward or forward through a loaded sequence.</td></tr><tr><td><kbd>Space</kbd></td><td>Play or pause a sequence. In Speed trainer: hold, release to start, then press to stop.</td></tr><tr><td><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd></td><td>Undo. Add Shift to redo.</td></tr><tr><td><kbd>?</kbd></td><td>Open this guide.</td></tr></tbody></table><div class="help-grid" style="margin-top:24px"><div class="help-item"><h3>Ready for a first solve?</h3><p>Learning path explains the cube from the beginning, with prepared cases you can replay at your pace.</p></div><div class="help-item"><h3>Your studio stays yours.</h3><p>Progress, times, and cube state live in this browser. Save a cube file or export times to carry them elsewhere.</p></div></div>`);}

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  const action=target.dataset.action;
  try{
    if(action==='navigate')navigationTo(target.dataset.view);
    else if(action==='mobile-nav')setMobileNavigation(!$('.sidebar').classList.contains('open'));
    else if(action==='close-nav')setMobileNavigation(false);
    else if(action==='reset')resetCube();else if(action==='scramble')scrambleCube();
    else if(action==='move')await manualMove(target.dataset.move);
    else if(action==='prime'){prime=!prime;doubleTurn=false;target.setAttribute('aria-pressed',String(prime));$('[data-action="double"]').setAttribute('aria-pressed','false');refreshMoveButtons();}
    else if(action==='double'){doubleTurn=!doubleTurn;prime=false;target.setAttribute('aria-pressed',String(doubleTurn));$('[data-action="prime"]').setAttribute('aria-pressed','false');refreshMoveButtons();}
    else if(action==='explode'){exploded=!exploded;renderer.setExploded(exploded);target.setAttribute('aria-pressed',String(exploded));}
    else if(action==='xray'){xray=!xray;renderer.setXray(xray);target.setAttribute('aria-pressed',String(xray));}
    else if(action==='camera')renderer.resetView();
    else if(action==='undo')await undoMove();else if(action==='redo')await redoMove();
    else if(action==='play')await playSequence();else if(action==='step')await sequenceStep();else if(action==='step-back')await sequenceStep(-1);else if(action==='sequence-start')rewindSequence();
    else if(action==='solve')await requestSolution();else if(action==='solve-cross')await requestSolution(true);
    else if(action==='help')showHelp();else if(action==='notation')showHelp(true);
    else if(action==='close-dialog'){$('#app-dialog').close();solveController?.abort();}
    else if(action==='cancel-solve'){solveController?.abort();$('#app-dialog').close();}
    else if(action==='export')exportCube();else if(action==='import')$('#import-file').click();
    else if(action==='first-lesson')openLesson(lessons.find(l=>/cross/i.test(l.title))?.id||lessons[0].id);
    else if(action==='open-lesson')openLesson(target.dataset.id);
    else if(action==='continue-learning')openLesson(lessons.find(l=>!completed.has(l.id))?.id||lessons[0].id);
    else if(action==='lesson-filter'){lessonFilter=target.dataset.filter;renderLearning();}
    else if(action==='lesson-prev'){lessonStep--;renderLesson();}else if(action==='lesson-next'){lessonStep++;renderLesson();}
    else if(action==='lesson-complete'){completed.add(lessonId);save();updateJourney();$('#app-dialog').close();navigationTo('learning');toast('One more idea understood. Keep going.');}
    else if(action==='lesson-demo')lessonDemo();else if(action==='return-lesson')renderLesson();else if(action==='dismiss-lesson-banner')$('#lesson-return-banner')?.remove();
    else if(action==='algorithm-filter'){algorithmFilter=target.dataset.filter;renderAlgorithms();}
    else if(action==='favorite'){favorites.has(target.dataset.id)?favorites.delete(target.dataset.id):favorites.add(target.dataset.id);save();renderAlgorithms();}
    else if(action==='algorithm-demo')loadAlgorithm(target.dataset.id);
    else if(action==='algorithm-drill')loadAlgorithm(target.dataset.id,true);
    else if(action==='algorithm-detail')showAlgorithm(target.dataset.id);
    else if(action==='graph-mode'){graphMode=target.dataset.mode;renderGraphView();}
    else if(action==='timer-toggle')toggleTimer();else if(action==='timer-scramble')newTimerScramble();
    else if(action==='timer-cube'){if(replaceCube(new CubeState(timerSize).applyAlgorithm(currentScramble),{log:[...currentScramble]}))navigationTo('playground');}
    else if(action==='penalty'){const s=solves.find(s=>s.id===target.dataset.id);if(s){s.penalty=s.penalty===target.dataset.penalty?'none':target.dataset.penalty;save();renderTimer();}}
    else if(action==='export-times'){download(`cubica-${timerSize}x${timerSize}-session.csv`,csvForSolves(currentSessionSolves()),'text/csv');toast('Your session is ready as a CSV.');}
    else if(action==='delete-last-time'){const s=currentSessionSolves().at(-1);if(s){solves=solves.filter(x=>x.id!==s.id);save();renderTimer();toast('Last attempt removed from this session.');}}
    else if(action==='paint-color'){paintColor=target.dataset.color;renderSolver();}
    else if(action==='paint-sticker'){paintFaces[target.dataset.face][Number(target.dataset.index)]=paintColor;editorMessage='';renderSolver();}
    else if(action==='editor-current'){if(cube.size!==3){toast('The color editor is for 3 × 3 cubes. Select 3 × 3 in the playground first.');return;}paintFaces=cube.facelets();editorMessage='';renderSolver();}
    else if(action==='editor-reset'){paintFaces=new CubeState(3).facelets();editorMessage='';renderSolver();}
    else if(action==='solve-painted')await solvePainted();
    else if(action==='import-facelets'){try{paintFaces=CubeState.fromFacelets($('#facelet-input').value.replace(/\s/g,'').toUpperCase()).facelets();editorMessage='✓ Valid cube loaded. Choose Check & solve when ready.';}catch(error){editorMessage=error.message;}renderSolver();}
  }catch(error){toast(error.message||'That action could not be completed.',5000);}
});
document.addEventListener('change',event=>{
  if(event.target.id==='cube-size')resetCube(Number(event.target.value));
  else if(event.target.id==='animation-speed')animationMs=Number(event.target.value);
  else if(event.target.id==='inspection-toggle'){if(timerState!=='idle'){event.target.checked=useInspection;toast('Finish the current attempt to change inspection.');}else{useInspection=event.target.checked;save();}}
  else if(event.target.id==='timer-size'){if(timerState!=='idle'){event.target.value=timerSize;toast('Finish the current attempt first.');}else{timerSize=Number(event.target.value);currentScramble=generateScramble(timerSize);renderTimer();}}
});
document.addEventListener('input',event=>{if(event.target.id==='algorithm-search'){const start=event.target.selectionStart;algorithmSearch=event.target.value;renderAlgorithms();const input=$('#algorithm-search');input.focus();if(input.type!=='search')input.setSelectionRange(start,start);}});
$('#algorithm-form').addEventListener('submit',event=>{event.preventDefault();try{loadSequence($('#algorithm-input').value,'Your sequence',{size:cube.size});}catch(error){toast(error.message,5000);}});
$('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('Choose a cube snapshot smaller than 2 MB.');const parsed=JSON.parse(await file.text());const state=CubeState.fromSnapshot(parsed.cube||parsed);if(replaceCube(state,{log:[...(state.history||[])]})){navigationTo('playground');toast('Your saved cube is back.');}}catch(error){toast(`Could not import: ${error.message}`,6000);}event.target.value='';});
$('#app-dialog').addEventListener('click',event=>{if(event.target===$('#app-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){event.target.close();solveController?.abort();}}});
$('#app-dialog').addEventListener('cancel',()=>solveController?.abort());
function typingTarget(target){return target.matches('input,textarea,select,[contenteditable="true"]');}
document.addEventListener('keydown',event=>{
  if(typingTarget(event.target)||$('#app-dialog').open)return;
  if(event.key==='Escape')setMobileNavigation(false);
  if(event.key==='?'&&!event.ctrlKey&&!event.metaKey){event.preventDefault();showHelp();return;}
  if(view==='timer'&&event.code==='Space'){
    event.preventDefault();if(event.repeat)return;
    if(timerState==='running'){toggleTimer();timerHolding=false;return;}
    timerHolding=true;timerArmedAt=performance.now();cancelAnimationFrame(timerFrame);timerTick();return;
  }
  if(view!=='playground'&&view!=='graphs')return;
  if(event.code==='Space'){event.preventDefault();if(!event.repeat)playSequence();return;}
  if(event.key==='ArrowRight'){event.preventDefault();sequenceStep();return;}
  if(event.key==='ArrowLeft'){event.preventDefault();sequenceStep(-1);return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redoMove():undoMove();return;}
  if(event.ctrlKey||event.metaKey||event.repeat)return;
  const key=event.key.toUpperCase();if('URFDLBXYZMES'.includes(key)&&key.length===1){event.preventDefault();const face='XYZ'.includes(key)?key.toLowerCase():key;manualMove(face+(event.altKey?'2':event.shiftKey?"'":''));}
});
document.addEventListener('keyup',event=>{if(event.code==='Space'&&timerHolding){event.preventDefault();timerHolding=false;if(view==='timer'&&!$('#app-dialog').open){if(performance.now()-timerArmedAt>=300)toggleTimer();else{cancelAnimationFrame(timerFrame);renderTimer();if(timerState!=='idle')timerTick();}}}});
window.addEventListener('blur',()=>{if(timerHolding){timerHolding=false;if(timerState==='idle'){cancelAnimationFrame(timerFrame);if(view==='timer')renderTimer();}}});
window.addEventListener('hashchange',()=>navigationTo(location.hash.slice(1)));

const mobileQuery=matchMedia('(max-width:600px)');
function setMobileNavigation(open){const small=matchMedia('(max-width:600px)').matches;$('.sidebar').classList.toggle('open',open&&small);$('.sidebar').inert=small&&!open;$('#nav-backdrop').hidden=!(small&&open);$('[data-action="mobile-nav"]').setAttribute('aria-expanded',String(small&&open));}
mobileQuery.addEventListener('change',()=>setMobileNavigation(false));
setMobileNavigation(false);
hydrateIcons();refreshMoveButtons();
renderer=new CubeRenderer($('#cube-canvas'),{onBackend:name=>{$('#backend-badge').innerHTML=`<span class="tiny-dot"></span> ${escape(name)}`;$('#backend-badge').title=name==='WebGPU'?'Native WebGPU renderer':`Canvas 3D fallback: ${renderer?.fallbackReason||'a GPU adapter is unavailable in this browser'}`;},onPick:selectPiece,onTurn:manualMove});
try{await renderer.init();renderer.setCube(cube);}catch(error){toast(`3D initialization: ${error.message}`,8000);}
updateCubeUI();navigationTo(location.hash.slice(1)||'playground');save();
if('serviceWorker' in navigator)navigator.serviceWorker.register(new URL('./sw.js',import.meta.url)).catch(()=>{/* The studio still works when offline caching is unavailable. */});
