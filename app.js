const FILE = 'data/chains.jsonl';
let state = { pool: [], idx: 0, current: null };

document.getElementById('startBtn').onclick = start;
document.getElementById('nextBtn').onclick = nextQ;
document.getElementById('submitMcq').onclick = submitMcq;
document.getElementById('revealBtn').onclick = revealOpen;
document.getElementById('submitChain').onclick = submitChain;

async function start(){
 const res = await fetch(FILE);
 const txt = await res.text();
 state.pool = txt.split('\n').filter(Boolean).map(JSON.parse);
 shuffle(state.pool);
 state.idx = 0;
 document.getElementById('quizArea').style.display='block';
 render();
}

function render(){
 state.current = state.pool[state.idx];
 const q = state.current;
 document.getElementById('feedback').innerHTML='';
 document.getElementById('nextBtn').disabled=true;

 document.getElementById('qMeta').textContent = `${q.unit} • ${q.type}`;
 document.getElementById('qStem').textContent = q.stem;

 document.getElementById('mcqBlock').style.display = q.type==='mcq'?'block':'none';
 document.getElementById('openBlock').style.display = q.type==='open'?'block':'none';
 document.getElementById('chainBlock').style.display = q.type==='chain'?'block':'none';

 if(q.type==='mcq'){
  const box=document.getElementById('mcqChoices');
  box.innerHTML='';
  q.choices.forEach((c,i)=>{
    box.innerHTML+=`<label><input type="radio" name="mcq" value="${i}">${c}</label>`;
  });
 }
 if(q.type==='chain'){
  const pool=document.getElementById('chainPool');
  const picked=document.getElementById('chainPicked');
  pool.innerHTML=''; picked.innerHTML='';
  q._picked=[];
  q.steps.forEach((s,i)=>{
    const d=document.createElement('div');
    d.className='pill'; d.textContent=s;
    d.onclick=()=>{ q._picked.push(i); picked.appendChild(d); };
    pool.appendChild(d);
  });
 }
}

function submitMcq(){
 const sel=document.querySelector('input[name="mcq"]:checked');
 if(!sel) return alert('Pick one');
 const ok=Number(sel.value)===state.current.answer;
 document.getElementById('feedback').textContent = ok?'Correct':'Incorrect';
 document.getElementById('nextBtn').disabled=false;
}

function revealOpen(){
 document.getElementById('feedback').innerHTML=state.current.key_points.join('<br>');
 document.getElementById('nextBtn').disabled=false;
}

function submitChain(){
 const ok = JSON.stringify(state.current._picked)===JSON.stringify(state.current.correct_order);
 document.getElementById('feedback').textContent = ok?'Correct order':'Wrong order';
 document.getElementById('nextBtn').disabled=false;
}

function nextQ(){ state.idx++; if(state.idx>=state.pool.length){alert('Done'); return;} render(); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }
