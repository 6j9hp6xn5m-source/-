
// ========== DATA ==========
var S = {workers:[],clients:[],logs:[],expenses:[]};
var CFG = {pauseOn:false,pauseMin:30};

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function today(){return new Date().toISOString().split('T')[0];}
function initials(n){return (n||'?').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2)||'?';}
function fmt(v){return '\u20ac'+(+v).toFixed(2);}

function persist(){
  try{localStorage.setItem('wf_s',JSON.stringify(S));}catch(e){}
}
function persistCFG(){
  try{localStorage.setItem('wf_cfg',JSON.stringify(CFG));}catch(e){}
}
function loadData(){
  try{var d=localStorage.getItem('wf_s');if(d){var p=JSON.parse(d);if(p&&p.workers)S=p;}}catch(e){}
  try{var c=localStorage.getItem('wf_cfg');if(c){var p=JSON.parse(c);if(p)CFG=Object.assign(CFG,p);}}catch(e){}
}

// ========== NAV ==========
function goPage(id, btn){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
  var p = document.getElementById('p-'+id);
  if(p) p.classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='dashboard') renderDash();
  if(id==='workers') renderWorkers();
  if(id==='clients') renderClients();
  if(id==='log') renderLog();
  if(id==='expenses') renderExp();
  if(id==='report') renderReport('workers');
}

// ========== MODALS ==========
function openM(id){
  var el = document.getElementById(id);
  if(el) el.classList.add('open');
}
function closeM(id){
  var el = document.getElementById(id);
  if(el) el.classList.remove('open');
}
// Close on backdrop click
document.querySelectorAll('.overlay').forEach(function(o){
  o.addEventListener('click', function(e){
    if(e.target === o) o.classList.remove('open');
  });
});

// ========== CONFIRM ==========
var _confirmCB = null;
document.getElementById('confirm-yes').addEventListener('click', function(){
  closeM('m-confirm');
  if(_confirmCB){ _confirmCB(); _confirmCB = null; }
});
function confirm2(msg, cb){
  document.getElementById('confirm-txt').textContent = msg;
  _confirmCB = cb;
  openM('m-confirm');
}

// ========== SETTINGS ==========
function saveSettings(){
  CFG.pauseOn = document.getElementById('s-pause-on').checked;
  CFG.pauseMin = parseInt(document.getElementById('s-pause-min').value);
  persistCFG();
}
function applySettings(){
  document.getElementById('s-pause-on').checked = CFG.pauseOn;
  document.getElementById('s-pause-min').value = CFG.pauseMin;
}
function clearAll(){
  confirm2('Изтрий ВСИЧКИ данни?', function(){
    S={workers:[],clients:[],logs:[],expenses:[]};
    persist();
    renderDash();
    closeM('m-settings');
  });
}
function exportData(){
  var blob = new Blob([JSON.stringify({S:S,CFG:CFG,date:new Date().toISOString()},null,2)],{type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'workflow-backup-'+today()+'.json';
  a.click();
}
function importData(inp){
  var file = inp.files[0]; if(!file) return;
  var r = new FileReader();
  r.onload = function(e){
    try{
      var d = JSON.parse(e.target.result);
      confirm2('Импортирай и замести сегашните данни?', function(){
        if(d.S && d.S.workers) S = d.S;
        if(d.CFG) CFG = Object.assign(CFG, d.CFG);
        persist(); persistCFG(); applySettings();
        renderDash(); closeM('m-settings');
        alert('✅ Импортирано успешно!');
      });
    }catch(ex){alert('❌ Грешка при импортиране.');}
  };
  r.readAsText(file);
  inp.value='';
}

// ========== HOURS CALC ==========
function calcHrs(){
  var f = document.getElementById('l-from').value;
  var t = document.getElementById('l-to').value;
  var pauseOn = document.getElementById('l-pause').checked;
  if(!f||!t){document.getElementById('hrs-res').textContent='Избери часове';return;}
  var fm=parseInt(f.split(':')[0])*60+parseInt(f.split(':')[1]);
  var tm=parseInt(t.split(':')[0])*60+parseInt(t.split(':')[1]);
  var diff=tm-fm;
  if(diff<=0){document.getElementById('hrs-res').textContent='⚠️ Невалидни часове';return;}
  var pm=pauseOn?CFG.pauseMin:0;
  var net=diff-pm;
  if(net<=0){document.getElementById('hrs-res').textContent='⚠️ Паузата е по-голяма от смяната';return;}
  var h=Math.round(net/60*100)/100;
  document.getElementById('l-hours').value=h;
  document.getElementById('hrs-res').innerHTML=f+' \u2192 '+t+' = '+diff+'мин'+(pauseOn?' \u2212 '+pm+'мин пауза':'')+' = <b>'+h+'ч</b>';
}

// ========== WORKER TYPE ==========
function setWType(type){
  document.getElementById('w-type').value=type;
  document.getElementById('topt-w').className='topt'+(type==='worker'?' tw':'');
  document.getElementById('topt-b').className='topt'+(type==='boss'?' tb':'');
  document.getElementById('w-rate-grp').style.display=type==='worker'?'block':'none';
  document.getElementById('boss-info').style.display=type==='boss'?'block':'none';
  document.getElementById('w-rate').required=type==='worker';
}

// ========== WORKERS ==========
function openWorkerModal(id){
  document.getElementById('w-id').value='';
  document.getElementById('w-name').value='';
  document.getElementById('w-rate').value='';
  document.getElementById('wm-title').textContent='Добави работник';
  setWType('worker');
  if(id){
    var w=S.workers.find(function(x){return x.id===id;});
    if(w){
      document.getElementById('w-id').value=w.id;
      document.getElementById('w-name').value=w.name;
      document.getElementById('wm-title').textContent='Редактирай';
      setWType(w.type||'worker');
      if(w.type!=='boss') document.getElementById('w-rate').value=w.rate;
    }
  }
  openM('m-worker');
}
function saveWorker(){
  var id=document.getElementById('w-id').value;
  var name=document.getElementById('w-name').value.trim();
  var type=document.getElementById('w-type').value;
  var rate=parseFloat(document.getElementById('w-rate').value);
  if(!name){alert('Въведи име!');return;}
  if(type==='worker'&&(!rate||isNaN(rate))){alert('Въведи ставка!');return;}
  if(id){
    var w=S.workers.find(function(x){return x.id===id;});
    if(w){w.name=name;w.type=type;w.rate=type==='boss'?null:rate;}
  }else{
    S.workers.push({id:uid(),name:name,type:type,rate:type==='boss'?null:rate});
  }
  persist();closeM('m-worker');renderWorkers();renderDash();
}
function deleteWorker(id){
  var w=S.workers.find(function(x){return x.id===id;});
  if(!w) return;
  confirm2('Изтрий "'+w.name+'"?', function(){
    S.workers=S.workers.filter(function(x){return x.id!==id;});
    persist();renderWorkers();renderDash();
  });
}
function renderWorkers(){
  var el=document.getElementById('workers-list');
  if(!S.workers.length){el.innerHTML='<div class="empty"><h3>Няма работници</h3><p>Добави първия работник</p></div>';return;}
  el.innerHTML=S.workers.map(function(w){
    var isBoss=w.type==='boss';
    var logs=S.logs.filter(function(l){return l.wId===w.id;});
    var h=logs.reduce(function(s,l){return s+l.hours;},0);
    var e=logs.reduce(function(s,l){return s+l.hours*l.wRate;},0);
    return '<div class="pcard">'+
      '<div class="pcard-top">'+
        '<div class="avatar '+(isBoss?'av-b':'av-w')+'">'+initials(w.name)+'</div>'+
        '<div><div class="pname">'+w.name+'</div>'+
          '<div class="prate">'+(isBoss?'⭐ Шеф':'\u20ac'+w.rate+'/ч')+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
        '<span class="badge '+(isBoss?'bgold':'bp')+'">'+h.toFixed(1)+'ч</span>'+
        '<span class="badge bg">'+fmt(e)+'</span>'+
      '</div>'+
      '<div class="pcard-btns">'+
        '<button class="btn btn-secondary btn-sm" onclick="openWorkerModal(\''+w.id+'\')">✏️ Редактирай</button>'+
        '<button class="btn btn-danger btn-sm" onclick="deleteWorker(\''+w.id+'\')">🗑 Изтрий</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

// ========== CLIENTS ==========
var _notesClientId=null;
function openClientModal(id){
  document.getElementById('c-id').value='';
  document.getElementById('c-name').value='';
  document.getElementById('c-rate').value='';
  document.getElementById('c-notes').value='';
  if(id){
    var c=S.clients.find(function(x){return x.id===id;});
    if(c){document.getElementById('c-id').value=c.id;document.getElementById('c-name').value=c.name;document.getElementById('c-rate').value=c.rate;document.getElementById('c-notes').value=c.notes||'';}
  }
  openM('m-client');
}
function saveClient(){
  var id=document.getElementById('c-id').value;
  var name=document.getElementById('c-name').value.trim();
  var rate=parseFloat(document.getElementById('c-rate').value);
  var notes=document.getElementById('c-notes').value;
  if(!name){alert('Въведи име!');return;}
  if(!rate||isNaN(rate)){alert('Въведи ставка!');return;}
  if(id){var c=S.clients.find(function(x){return x.id===id;});if(c){c.name=name;c.rate=rate;c.notes=notes;}}
  else S.clients.push({id:uid(),name:name,rate:rate,notes:notes,paid:false});
  persist();closeM('m-client');renderClients();renderDash();
}
function deleteClient(id){
  var c=S.clients.find(function(x){return x.id===id;});
  if(!c) return;
  confirm2('Изтрий "'+c.name+'"?', function(){
    S.clients=S.clients.filter(function(x){return x.id!==id;});
    persist();renderClients();renderDash();
  });
}
function togglePaid(id){
  var c=S.clients.find(function(x){return x.id===id;});
  if(!c) return;
  if(c.paid){
    if(!confirm('Премахни платено?')) return;
    c.paid=false; c.paidDate=null;
  } else {
    var d=prompt('Дата на плащане (ГГГГ-ММ-ДД):', today());
    if(!d) return;
    c.paid=true; c.paidDate=d;
  }
  persist(); renderClients(); renderDash();
}
function openNotes(id){
  var c=S.clients.find(function(x){return x.id===id;});
  if(!c) return;
  _notesClientId=id;
  document.getElementById('notes-title').textContent='Бележки — '+c.name;
  document.getElementById('notes-txt').value=c.notes||'';
  openM('m-notes');
}
function saveNotes(){
  var c=S.clients.find(function(x){return x.id===_notesClientId;});
  if(c){c.notes=document.getElementById('notes-txt').value;persist();renderClients();}
  closeM('m-notes');
}
function renderClients(){
  var el=document.getElementById('clients-list');
  if(!S.clients.length){el.innerHTML='<div class="empty"><h3>Няма клиенти</h3><p>Добави първия клиент</p></div>';return;}
  var out='';
  S.clients.forEach(function(c){
    var logs=S.logs.filter(function(l){return l.cId===c.id;});
    var exps=S.expenses.filter(function(e){return e.cId===c.id;});
    var pd=c.paidDate||null;
    var uLogs=pd?logs.filter(function(l){return l.date>pd;}):logs;
    var uExps=pd?exps.filter(function(e){return e.date>pd;}):exps;
    var pAmt=pd?(logs.filter(function(l){return l.date<=pd;}).reduce(function(s,l){return s+l.hours*l.cRate;},0)+exps.filter(function(e){return e.date<=pd;}).reduce(function(s,e){return s+e.amount;},0)):0;
    var h=logs.reduce(function(s,l){return s+l.hours;},0);
    var owes=uLogs.reduce(function(s,l){return s+l.hours*l.cRate;},0)+uExps.reduce(function(s,e){return s+e.amount;},0);
    var cid = c.id;
    out+='<div class="pcard">'+
      '<div class="pcard-top">'+
        '<div class="avatar av-c">'+initials(c.name)+'</div>'+
        '<div><div class="pname">'+c.name+'</div><div class="prate">€'+c.rate+'/ч</div></div>'+
      '</div>'+
      (c.notes?'<div style="background:var(--bg);border-radius:6px;padding:8px;font-size:12px;color:var(--muted);white-space:pre-wrap">'+c.notes+'</div>':'')+
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+
        '<span class="badge bo">'+h.toFixed(1)+'ч</span>'+
        (pd?'<span class="badge bg">&#10003; Платено '+pd+': '+fmt(pAmt)+'</span>':'')+
      '</div>'+
      '<div style="background:#fee2e2;border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
        '<div style="font-size:13px;color:#ef4444;font-weight:700">&#128176; Дължи'+(pd?' след '+pd:'')+'</div>'+
        '<div style="font-weight:800;font-size:18px;color:#ef4444">'+fmt(owes)+'</div>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'+
        '<div style="font-weight:700;font-size:14px">Дължи: '+fmt(owes)+'</div>'+
        '<button class="paid-btn '+(c.paid?'paid-y':'paid-n')+'" onclick="togglePaid(\''+cid+'\')">'+(c.paid?'&#10003; '+pd:'&#128176; Неплатено')+'</button>'+
      '</div>'+
      '<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">'+
        '<button class="btn btn-primary btn-sm" onclick="openInvoice(\''+cid+'\')" style="flex:1;min-width:100px;">&#128196; Сметка</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="openNotes(\''+cid+'\')" style="flex:1">&#128221; Бел</button>'+
        '<button class="btn btn-secondary btn-sm" onclick="openClientModal(\''+cid+'\')" style="flex:1">&#9998;</button>'+
        '<button class="btn btn-danger btn-sm" onclick="deleteClient(\''+cid+'\')" style="flex:1">&#128465;</button>'+
      '</div></div>';
  });
  el.innerHTML=out;
}
// ========== LOG ==========
var _logFilter='all';
function addWorkerRow(wId,wRate){
  var con=document.getElementById('workers-container');
  var n=con.querySelectorAll('.worker-row').length;
  if(n>=4){alert('Максимум 4!');return;}
  var rid='wr'+Date.now()+n;
  var opts='<option value="">—Работник—</option>'+S.workers.map(function(w){return '<option value="'+w.id+'"'+(w.id===wId?' selected':'')+'>'+w.name+' (€'+(w.rate||0)+')</option>';}).join('');
  var d=document.createElement('div');
  d.className='worker-row';d.id=rid;
  d.style.cssText='display:flex;gap:8px;align-items:center;margin-bottom:8px';
  d.innerHTML='<select class="fi wr-sel" onchange="autoFRate(this)" style="flex:2;margin-bottom:0">'+opts+'</select>'+
    '<input type="number" class="fi wr-rate" placeholder="€/ч" value="'+(wRate||'')+'" step="0.5" style="width:80px;flex:0 0 80px;margin-bottom:0">'+
    '<button type="button" onclick="rmWRow(\''+rid+'\')" style="flex-shrink:0;width:36px;height:40px;border-radius:8px;border:none;background:#fee2e2;color:#ef4444;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>';
  con.appendChild(d);
  updWBtn();
}
function rmWRow(id){var e=document.getElementById(id);if(e)e.remove();updWBtn();}
function updWBtn(){
  var n=document.getElementById('workers-container').querySelectorAll('.worker-row').length;
  var b=document.getElementById('add-worker-btn');
  if(b)b.style.display=n>=4?'none':'inline-flex';
}
function autoFRate(sel){
  var row=sel.closest('.worker-row');
  var inp=row.querySelector('.wr-rate');
  var w=S.workers.find(function(x){return x.id===sel.value;});
  if(w&&inp&&!inp.value)inp.value=w.rate;
}
function openLogModal(id){
  var cOpts='<option value="">— Избери —</option>'+S.clients.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  document.getElementById('l-client').innerHTML=cOpts;
  document.getElementById('l-id').value='';
  document.getElementById('l-date').value=today();
  document.getElementById('l-from').value='';
  document.getElementById('l-to').value='';
  document.getElementById('l-pause').checked=CFG.pauseOn;
  document.getElementById('pause-lbl').textContent=CFG.pauseMin;
  document.getElementById('hrs-res').textContent='Избери часове';
  document.getElementById('l-hours').value='';
  document.getElementById('l-client').value='';
  document.getElementById('l-crate').value='';
  document.getElementById('l-note').value='';
  document.getElementById('boss-note').style.display='none';
  document.getElementById('workers-container').innerHTML='';
  if(id){
    var l=S.logs.find(function(x){return x.id===id;});
    if(l){
      document.getElementById('l-id').value=l.id;
      document.getElementById('l-date').value=l.date||'';
      document.getElementById('l-from').value=l.tFrom||'';
      document.getElementById('l-to').value=l.tTo||'';
      document.getElementById('l-hours').value=l.hours||'';
      document.getElementById('l-client').value=l.cId||'';
      document.getElementById('l-crate').value=l.cRate||'';
      document.getElementById('l-note').value=l.note||'';
      addWorkerRow(l.wId,l.wRate);
    }
  }else{addWorkerRow();}
  updWBtn();
  openM('m-log');
}
function onWChange(){}
function onCChange(){
  var cId=document.getElementById('l-client').value;
  var c=S.clients.find(function(x){return x.id===cId;});
  if(c)document.getElementById('l-crate').value=c.rate;
}
function saveLog(){
  var id=document.getElementById('l-id').value;
  var date=document.getElementById('l-date').value;
  var cId=document.getElementById('l-client').value;
  var hours=parseFloat(document.getElementById('l-hours').value);
  var cRate=parseFloat(document.getElementById('l-crate').value)||0;
  var note=document.getElementById('l-note').value.trim();
  var tFrom=document.getElementById('l-from').value;
  var tTo=document.getElementById('l-to').value;
  if(!date||!cId||!hours||isNaN(hours)){alert('Попълни дата, клиент и часове!');return;}
  var rows=document.getElementById('workers-container').querySelectorAll('.worker-row');
  var workers=[];
  rows.forEach(function(row){
    var wId=row.querySelector('.wr-sel').value;
    var wRate=parseFloat(row.querySelector('.wr-rate').value)||0;
    if(wId)workers.push({wId:wId,wRate:wRate});
  });
  if(!workers.length){alert('Избери поне един работник!');return;}
  if(id){
    var idx=S.logs.findIndex(function(x){return x.id===id;});
    if(idx>=0)S.logs[idx]={id:id,date:date,wId:workers[0].wId,wRate:workers[0].wRate,cId:cId,hours:hours,cRate:cRate,note:note,tFrom:tFrom,tTo:tTo};
  }else{
    workers.forEach(function(wr){S.logs.push({id:uid(),date:date,wId:wr.wId,wRate:wr.wRate,cId:cId,hours:hours,cRate:cRate,note:note,tFrom:tFrom,tTo:tTo});});
  }
  persist();closeM('m-log');renderLog();renderDash();
}
function deleteLog(id){
  confirm2('Изтрий записа?', function(){
    S.logs=S.logs.filter(function(x){return x.id!==id;});
    persist();renderLog();renderDash();
  });
}
function setLogFilter(type,btn){
  _logFilter=type;
  document.querySelectorAll('.itabs .itab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  var wrap=document.getElementById('lf-sel-wrap');
  var sel=document.getElementById('lf-sel');
  if(type==='all'){wrap.style.display='none';renderLog();return;}
  wrap.style.display='block';
  if(type==='worker') sel.innerHTML=S.workers.map(function(w){return '<option value="'+w.id+'">'+w.name+'</option>';}).join('');
  if(type==='client') sel.innerHTML=S.clients.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  renderLog();
}
function renderLog(){
  var tbody=document.getElementById('log-tbody');
  var logs=S.logs.slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  var from=document.getElementById('lf-from').value;
  var to=document.getElementById('lf-to').value;
  if(from) logs=logs.filter(function(l){return l.date>=from;});
  if(to) logs=logs.filter(function(l){return l.date<=to;});
  if(_logFilter==='worker'){var id=document.getElementById('lf-sel').value;if(id)logs=logs.filter(function(l){return l.wId===id;});}
  if(_logFilter==='client'){var id=document.getElementById('lf-sel').value;if(id)logs=logs.filter(function(l){return l.cId===id;});}
  if(!logs.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Няма записи</td></tr>';return;}
  tbody.innerHTML=logs.map(function(l){
    var w=S.workers.find(function(x){return x.id===l.wId;});
    var c=S.clients.find(function(x){return x.id===l.cId;});
    var isBoss=w&&w.type==='boss';
    var ts=l.tFrom&&l.tTo?'<div style="font-size:11px;color:var(--muted)">'+l.tFrom+'\u2192'+l.tTo+'</div>':'';
    return '<tr>'+
      '<td>'+l.date+ts+'</td>'+
      '<td>'+(w?'<span class="badge '+(isBoss?'bgold':'bp')+'">'+(isBoss?'⭐':'')+w.name+'</span>':'—')+'</td>'+
      '<td>'+(c?'<span class="badge bo">'+c.name+'</span>':'—')+'</td>'+
      '<td><b>'+l.hours+'ч</b></td>'+
      '<td style="font-size:11px;color:var(--muted)">W:\u20ac'+l.wRate+' C:\u20ac'+l.cRate+'</td>'+
      '<td><div style="font-size:12px"><div>'+fmt(l.hours*l.wRate)+'</div><div style="color:var(--orange)">'+fmt(l.hours*l.cRate)+'</div></div></td>'+
      '<td style="font-size:11px;color:var(--muted);max-width:100px">'+(l.note||'—')+'</td>'+
      '<td><div style="display:flex;gap:4px">'+
        '<button class="btn btn-secondary btn-sm" onclick="openLogModal(\''+l.id+'\')">✏️</button>'+
        '<button class="btn btn-danger btn-sm" onclick="deleteLog(\''+l.id+'\')">🗑</button>'+
      '</div></td>'+
    '</tr>';
  }).join('');
}

// ========== EXPENSES ==========
var _expFilter='all';
function openExpModal(id){
  document.getElementById('e-id').value='';
  document.getElementById('e-date').value=today();
  document.getElementById('e-amount').value='';
  document.getElementById('e-desc').value='';
  document.getElementById('e-note').value='';
  var sel=document.getElementById('e-client');
  sel.innerHTML='<option value="">-- Клиент --</option>'+S.clients.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  if(id){
    var e=S.expenses.find(function(x){return x.id===id;});
    if(e){document.getElementById('e-id').value=e.id;document.getElementById('e-date').value=e.date;document.getElementById('e-amount').value=e.amount;document.getElementById('e-desc').value=e.desc;document.getElementById('e-note').value=e.note||'';sel.value=e.cId;}
  }
  openM('m-exp');
}
function saveExp(){
  var id=document.getElementById('e-id').value;
  var date=document.getElementById('e-date').value;
  var cId=document.getElementById('e-client').value;
  var amount=parseFloat(document.getElementById('e-amount').value);
  var desc=document.getElementById('e-desc').value.trim();
  var note=document.getElementById('e-note').value;
  if(!date||!cId||!amount||!desc){alert('Попълни всички полета!');return;}
  var entry={id:id||uid(),date:date,cId:cId,amount:amount,desc:desc,note:note};
  if(id){var i=S.expenses.findIndex(function(x){return x.id===id;});if(i>=0)S.expenses[i]=entry;}
  else S.expenses.push(entry);
  persist();closeM('m-exp');renderExp();renderDash();
}
function deleteExp(id){
  confirm2('Изтрий разхода?', function(){
    S.expenses=S.expenses.filter(function(x){return x.id!==id;});
    persist();renderExp();renderDash();
  });
}
function setExpFilter(type,btn){
  _expFilter=type;
  document.querySelectorAll('#p-expenses .itab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  var wrap=document.getElementById('ef-sel-wrap');
  if(type==='all'){wrap.style.display='none';renderExp();return;}
  wrap.style.display='block';
  document.getElementById('ef-sel').innerHTML=S.clients.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  renderExp();
}
function renderExp(){
  var tbody=document.getElementById('exp-tbody');
  var exps=S.expenses.slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  var from=document.getElementById('ef-from').value;
  var to=document.getElementById('ef-to').value;
  if(from) exps=exps.filter(function(e){return e.date>=from;});
  if(to) exps=exps.filter(function(e){return e.date<=to;});
  if(_expFilter==='client'){var id=document.getElementById('ef-sel').value;if(id)exps=exps.filter(function(e){return e.cId===id;});}
  if(!exps.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Няма разходи</td></tr>';return;}
  tbody.innerHTML=exps.map(function(e){
    var c=S.clients.find(function(x){return x.id===e.cId;});
    return '<tr>'+
      '<td>'+e.date+'</td>'+
      '<td>'+(c?'<span class="badge bo">'+c.name+'</span>':'—')+'</td>'+
      '<td><b>'+e.desc+'</b></td>'+
      '<td><b style="color:var(--orange)">'+fmt(e.amount)+'</b></td>'+
      '<td style="font-size:11px;color:var(--muted)">'+(e.note||'—')+'</td>'+
      '<td><div style="display:flex;gap:4px">'+
        '<button class="btn btn-secondary btn-sm" onclick="openExpModal(\''+e.id+'\')">✏️</button>'+
        '<button class="btn btn-danger btn-sm" onclick="deleteExp(\''+e.id+'\')">🗑</button>'+
      '</div></td>'+
    '</tr>';
  }).join('');
}


// ========== INVOICE / PDF ==========
var _currentInvText = '';
function openInvoice(cId){
  var c = S.clients.find(function(x){return x.id===cId;});
  if(!c) return;
  var logs=S.logs.filter(function(l){return l.cId===c.id;}).sort(function(a,b){return a.date.localeCompare(b.date);});
  var exps=S.expenses.filter(function(e){return e.cId===c.id;}).sort(function(a,b){return a.date.localeCompare(b.date);});
  var pd=c.paidDate||null;
  var uL=pd?logs.filter(function(l){return l.date>pd;}):logs;
  var uE=pd?exps.filter(function(e){return e.date>pd;}):exps;

  var labor = uL.reduce(function(s,l){return s+l.hours*l.cRate;},0);
  var mat = uE.reduce(function(s,e){return s+e.amount;},0);
  var total = labor + mat;

  if(total === 0) {
    alert('Няма неплатени задължения (след '+ (pd?pd:'началото') +') за този клиент.');
    return;
  }

  var dStr = today().split('-').reverse().join('.');
  var h = '<div class="inv-head">СМЕТКА ЗА ПЛАЩАНЕ</div>';
  h += '<div style="margin-bottom:6px;"><b>Клиент:</b> '+c.name+'</div>';
  h += '<div style="margin-bottom:16px;"><b>Дата:</b> '+dStr+' г.</div>';

  var txt = 'Сметка за: '+c.name+'\nДата: '+dStr+'\n\n';

  if(uL.length){
    h += '<div style="font-weight:800;font-size:15px;margin-bottom:4px;color:var(--primary);margin-top:10px;">&#9881;&#65039; ТРУД:</div>';
    txt += 'ТРУД:\n';
    uL.forEach(function(l){
      var dL = l.date.split('-').slice(1).reverse().join('.');
      h += '<div class="inv-row"><div>'+dL+' <span style="color:#6b7280;font-size:12px;margin-left:4px">'+l.hours+'ч x €'+l.cRate+'</span></div><b>€'+(l.hours*l.cRate).toFixed(2)+'</b></div>';
      txt += '- '+dL+': '+l.hours+'ч x €'+l.cRate+' = €'+(l.hours*l.cRate).toFixed(2)+'\n';
    });
    h += '<div class="inv-row" style="background:#f3f4f6; font-weight:800; padding:6px; border-radius:4px; margin-top:4px;"><span>Общо труд:</span><span>€'+labor.toFixed(2)+'</span></div>';
    txt += 'Общо труд: €'+labor.toFixed(2)+'\n\n';
  }

  if(uE.length){
    h += '<div style="font-weight:800;font-size:15px;margin-bottom:4px;color:var(--orange);margin-top:16px;">&#128176; МАТЕРИАЛИ:</div>';
    txt += 'МАТЕРИАЛИ:\n';
    uE.forEach(function(e){
      var dE = e.date.split('-').slice(1).reverse().join('.');
      h += '<div class="inv-row"><div>'+dE+' <span style="color:#6b7280;font-size:12px;margin-left:4px">'+e.desc+'</span></div><b>€'+e.amount.toFixed(2)+'</b></div>';
      txt += '- '+dE+': '+e.desc+' = €'+e.amount.toFixed(2)+'\n';
    });
    h += '<div class="inv-row" style="background:#fef3c7; font-weight:800; padding:6px; border-radius:4px; margin-top:4px;"><span>Общо материали:</span><span>€'+mat.toFixed(2)+'</span></div>';
    txt += 'Общо материали: €'+mat.toFixed(2)+'\n\n';
  }

  h += '<div class="inv-total">ОБЩО ЗА ПЛАЩАНЕ: €'+total.toFixed(2)+'</div>';
  if(pd) h += '<div style="text-align:right;font-size:11px;color:#6b7280;margin-top:4px;">(неплатени след '+pd.split('-').reverse().join('.')+')</div>';

  txt += 'ОБЩО ЗА ПЛАЩАНЕ: €'+total.toFixed(2);

  document.getElementById('invoice-print-area').innerHTML = h;
  _currentInvText = txt;

  document.getElementById('inv-share-btn').onclick = function(){
    if(navigator.share){
      navigator.share({
        title: 'Сметка - '+c.name,
        text: _currentInvText
      }).catch(function(e){});
    } else {
      var ta = document.createElement('textarea');
      ta.value = _currentInvText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Текстът на сметката е копиран! Отворете Viber или WhatsApp и го поставете (Paste).');
    }
  };

  openM('m-invoice');
}

// ========== DASHBOARD ==========
function getMonths(){
  var m={};
  S.logs.forEach(function(l){m[l.date.slice(0,7)]=1;});
  S.expenses.forEach(function(e){m[e.date.slice(0,7)]=1;});
  return Object.keys(m).sort().reverse();
}
function renderDash(){
  var mSel=document.getElementById('dash-month');
  var cur=mSel.value;
  var months=getMonths();
  mSel.innerHTML='<option value="">Всички</option>'+months.map(function(m){return '<option value="'+m+'">'+m+'</option>';}).join('');
  if(cur) mSel.value=cur;
  var selM=mSel.value;
  var logs=S.logs;
  var exps=S.expenses;
  if(selM){logs=logs.filter(function(l){return l.date.startsWith(selM);});exps=exps.filter(function(e){return e.date.startsWith(selM);});}
  var totalH=logs.reduce(function(s,l){return s+l.hours;},0);
  var totalW=logs.reduce(function(s,l){return s+l.hours*l.wRate;},0);
  var totalC=logs.reduce(function(s,l){return s+l.hours*l.cRate;},0);
  var totalE=exps.reduce(function(s,e){return s+e.amount;},0);
  var unpaid=S.clients.filter(function(c){return !c.paid;}).length;
  document.getElementById('kpis').innerHTML=
    '<div class="kpi"><div class="kpi-label">Часове</div><div class="kpi-val">'+totalH.toFixed(1)+'</div><div class="kpi-sub">'+logs.length+' записа</div></div>'+
    '<div class="kpi"><div class="kpi-label">Разход труд</div><div class="kpi-val" style="font-size:1.2rem">'+fmt(totalW)+'</div></div>'+
    '<div class="kpi"><div class="kpi-label">Фактури</div><div class="kpi-val" style="font-size:1.2rem;color:var(--orange)">'+fmt(totalC)+'</div></div>'+
    '<div class="kpi"><div class="kpi-label">Печалба</div><div class="kpi-val" style="font-size:1.2rem;color:var(--green)">'+fmt(totalC-totalW)+'</div></div>'+
    '<div class="kpi"><div class="kpi-label">Рехнунги</div><div class="kpi-val" style="font-size:1.2rem">'+fmt(totalE)+'</div></div>'+
    '<div class="kpi"><div class="kpi-label">Общо дължи</div><div class="kpi-val" style="font-size:1.2rem;color:var(--orange)">'+fmt(totalC+totalE)+'</div></div>'+
    '<div class="kpi"><div class="kpi-label">Неплатени</div><div class="kpi-val" style="color:var(--red)">'+unpaid+'</div><div class="kpi-sub">клиента</div></div>';
  var rLogs=S.logs.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).slice(0,5);
  document.getElementById('dash-logs').innerHTML=rLogs.length?rLogs.map(function(l){
    var w=S.workers.find(function(x){return x.id===l.wId;});var c=S.clients.find(function(x){return x.id===l.cId;});
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">'+
      '<div style="font-size:13px"><div>'+(w?w.name:'?')+' \u2192 '+(c?c.name:'?')+'</div><div style="font-size:11px;color:var(--muted)">'+l.date+' · '+l.hours+'ч</div></div>'+
      '<div style="font-weight:700;color:var(--orange)">'+fmt(l.hours*l.cRate)+'</div></div>';
  }).join(''):'<p style="color:var(--muted);font-size:13px">Няма записи</p>';
  var rExps=S.expenses.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).slice(0,5);
  document.getElementById('dash-exps').innerHTML=rExps.length?rExps.map(function(e){
    var c=S.clients.find(function(x){return x.id===e.cId;});
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">'+
      '<div style="font-size:13px"><div>'+e.desc+'</div><div style="font-size:11px;color:var(--muted)">'+e.date+' · '+(c?c.name:'?')+'</div></div>'+
      '<div style="font-weight:700;color:var(--orange)">'+fmt(e.amount)+'</div></div>';
  }).join(''):'<p style="color:var(--muted);font-size:13px">Няма разходи</p>';
  var allM=getMonths();
  if(!allM.length){document.getElementById('dash-monthly').innerHTML='<p style="color:var(--muted);font-size:13px">Няма данни</p>';return;}
  document.getElementById('dash-monthly').innerHTML='<div class="tbl-wrap"><table><thead><tr><th>Месец</th><th>Часове</th><th>Фактури</th><th>Труд</th><th>Разходи</th><th>Печалба</th></tr></thead><tbody>'+
    allM.map(function(m){
      var ml=S.logs.filter(function(l){return l.date.startsWith(m);});
      var me=S.expenses.filter(function(e){return e.date.startsWith(m);});
      var h=ml.reduce(function(s,l){return s+l.hours;},0);
      var inv=ml.reduce(function(s,l){return s+l.hours*l.cRate;},0);
      var wc=ml.reduce(function(s,l){return s+l.hours*l.wRate;},0);
      var exp=me.reduce(function(s,e){return s+e.amount;},0);
      return '<tr><td><b>'+m+'</b></td><td>'+h.toFixed(1)+'ч</td><td>'+fmt(inv)+'</td><td>'+fmt(wc)+'</td><td>'+fmt(exp)+'</td><td style="color:var(--green);font-weight:700">'+fmt(inv-wc)+'</td></tr>';
    }).join('')+
  '</tbody></table></div>';
}

// ========== REPORT ==========
function showReport(type,btn){
  document.querySelectorAll('#p-report .itab').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderReport(type);
}
function renderReport(type){
  var el=document.getElementById('report-out');
  if(type==='workers'){
    var html='';
    S.workers.forEach(function(w){
      var isBoss=w.type==='boss';
      var logs=S.logs.filter(function(l){return l.wId===w.id;}).sort(function(a,b){return a.date.localeCompare(b.date);});
      var h=logs.reduce(function(s,l){return s+l.hours;},0);
      var e=logs.reduce(function(s,l){return s+l.hours*l.wRate;},0);
      html+='<div class="card" style="margin-bottom:16px">'+
        '<div style="font-weight:700;font-size:15px;margin-bottom:12px">'+(isBoss?'⭐':'👷')+' '+w.name+' — '+(isBoss?'Шеф':'\u20ac'+w.rate+'/ч')+'</div>'+
        '<div class="tbl-wrap"><table><thead><tr><th>Дата</th><th>Клиент</th><th>Часове</th><th>Ставка</th><th>Сума</th><th>Бел.</th></tr></thead><tbody>'+
        logs.map(function(l){var c=S.clients.find(function(x){return x.id===l.cId;});var ts=l.tFrom&&l.tTo?' ('+l.tFrom+'\u2192'+l.tTo+')':'';
          return '<tr><td>'+l.date+ts+'</td><td>'+(c?c.name:'—')+'</td><td>'+l.hours+'ч</td><td>\u20ac'+l.wRate+'</td><td>'+fmt(l.hours*l.wRate)+'</td><td style="font-size:11px">'+(l.note||'—')+'</td></tr>';
        }).join('')+
        '<tr class="total-row"><td colspan="2"><b>ОБЩО</b></td><td><b>'+h.toFixed(2)+'ч</b></td><td></td><td><b>'+fmt(e)+'</b></td><td></td></tr>'+
        '</tbody></table></div></div>';
    });
    el.innerHTML=html||'<div class="empty"><h3>Няма работници</h3></div>';
  }else if(type==='clients'){
    var rhtml='';
    S.clients.forEach(function(c){
      var logs=S.logs.filter(function(l){return l.cId===c.id;}).sort(function(a,b){return a.date.localeCompare(b.date);});
      var exps=S.expenses.filter(function(e){return e.cId===c.id;}).sort(function(a,b){return a.date.localeCompare(b.date);});
      var pd=c.paidDate||null;
      var pL=pd?logs.filter(function(l){return l.date<=pd;}):[];
      var pE=pd?exps.filter(function(e){return e.date<=pd;}):[];
      var uL=pd?logs.filter(function(l){return l.date>pd;}):logs;
      var uE=pd?exps.filter(function(e){return e.date>pd;}):exps;
      function mSec(ls,es,lbl,col){
        if(!ls.length&&!es.length)return '';
        var lab=ls.reduce(function(s,l){return s+l.hours*l.cRate;},0);
        var mat=es.reduce(function(s,e){return s+e.amount;},0);
        return '<p style="font-weight:700;font-size:13px;color:'+col+';margin:10px 0 6px">'+lbl+'</p>'+
          '<div class="tbl-wrap" style="margin-bottom:8px"><table><thead><tr><th>Дата</th><th>Работник</th><th>Час</th><th>Ставка</th><th>Сума</th></tr></thead><tbody>'+
          ls.map(function(l){var w=S.workers.find(function(x){return x.id===l.wId;});var ts=l.tFrom&&l.tTo?' ('+l.tFrom+'→'+l.tTo+')':'';
            return '<tr><td>'+l.date+ts+'</td><td>'+(w?w.name:'—')+'</td><td>'+l.hours+'ч</td><td>€'+l.cRate+'</td><td>'+fmt(l.hours*l.cRate)+'</td></tr>';}).join('')+
          '<tr class="total-row"><td colspan="2"><b>Труд</b></td><td><b>'+ls.reduce(function(s,l){return s+l.hours;},0).toFixed(2)+'ч</b></td><td></td><td><b>'+fmt(lab)+'</b></td></tr>'+
          '</tbody></table></div>'+
          (es.length?'<div class="tbl-wrap" style="margin-bottom:8px"><table><thead><tr><th>Дата</th><th>Описание</th><th>Сума</th><th>Бел.</th></tr></thead><tbody>'+
          es.map(function(e){return '<tr><td>'+e.date+'</td><td>'+e.desc+'</td><td>'+fmt(e.amount)+'</td><td style="font-size:11px">'+(e.note||'—')+'</td></tr>';}).join('')+
          '<tr class="total-row"><td><b>Общо</b></td><td></td><td><b>'+fmt(mat)+'</b></td><td></td></tr>'+
          '</tbody></table></div>':'')+
          '<div style="background:'+col+'22;border-radius:8px;padding:10px;display:flex;justify-content:space-between;margin-bottom:4px"><b>Общо:</b><b>'+fmt(lab+mat)+'</b></div>';
      }
      var uTotal=uL.reduce(function(s,l){return s+l.hours*l.cRate;},0)+uE.reduce(function(s,e){return s+e.amount;},0);
      rhtml+='<div class="card" style="margin-bottom:16px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
          '<div style="font-weight:700;font-size:15px">&#128196; '+c.name+' — €'+c.rate+'/ч</div>'+
          '<span class="badge '+(c.paid?'bg':'br')+'">'+(c.paid?'&#10003; Платено '+pd:'&#128176; Неплатено')+'</span>'+
        '</div>'+
        (c.notes?'<div style="background:var(--bg);padding:8px;border-radius:6px;font-size:12px;margin-bottom:12px">'+c.notes+'</div>':'')+
        mSec(pL,pE,'&#10003; Платено'+(pd?' до '+pd:''),'#10b981')+
        mSec(uL,uE,'&#128176; Дължи'+(pd?' след '+pd:''),'#ef4444')+
        '<div style="background:var(--orange-light);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
          '<span style="font-weight:700">&#128176; ДЪЛЖИ СЕГА:</span>'+
          '<span style="font-size:1.3rem;font-weight:800;color:var(--orange)">'+fmt(uTotal)+'</span>'+
        '</div></div>';
    });
    el.innerHTML=rhtml||'<div class="empty"><h3>Няма клиенти</h3></div>';
  }else{
    var exps=S.expenses.slice().sort(function(a,b){return a.date.localeCompare(b.date);});
    var total=exps.reduce(function(s,e){return s+e.amount;},0);
    el.innerHTML='<div class="card">'+
      '<div class="tbl-wrap"><table><thead><tr><th>Дата</th><th>Клиент</th><th>Описание</th><th>Сума</th><th>Бел.</th></tr></thead><tbody>'+
      exps.map(function(e){var c=S.clients.find(function(x){return x.id===e.cId;});
        return '<tr><td>'+e.date+'</td><td>'+(c?c.name:'—')+'</td><td>'+e.desc+'</td><td>'+fmt(e.amount)+'</td><td style="font-size:11px">'+(e.note||'—')+'</td></tr>';
      }).join('')+
      '<tr class="total-row"><td colspan="3"><b>ОБЩО</b></td><td><b>'+fmt(total)+'</b></td><td></td></tr>'+
      '</tbody></table></div></div>';
  }
}



// iPhone Safari touch fallback for taps
(function(){
  document.addEventListener('touchstart', function(ev){
    var t = ev.target.closest('button, .tab, .itab, .icon-btn, .modal-close, .topt, .paid-btn');
    if(!t) return;
    t.style.opacity = '0.85';
    setTimeout(function(){ t.style.opacity=''; }, 120);
  }, {passive:true});
})();

// ========== INIT ==========
loadData();
applySettings();
renderDash();
</script>

<script>
if('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('./sw.js').catch(function(e){console.log('SW err',e);});
  });
}
