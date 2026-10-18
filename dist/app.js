const DB_NAME='lexico-db',STORE_FOLDERS='folders',STORE_CARDS='cards';
const LANGUAGE_OPTIONS=[['en','Inglés'],['fr','Francés'],['de','Alemán'],['it','Italiano'],['pt','Portugués'],['ca','Catalán'],['ja','Japonés']];
let currentFolder=null,currentQueue=[],revealed=false,freeReview=false;
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;const folders=db.createObjectStore(STORE_FOLDERS,{keyPath:'id',autoIncrement:true});folders.createIndex('name','name');const cards=db.createObjectStore(STORE_CARDS,{keyPath:'id',autoIncrement:true});cards.createIndex('folderId','folderId');cards.createIndex('nextReview','nextReview')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbAll(store){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbPut(store,data){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store,'readwrite').objectStore(store).put(data);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbDelete(store,id){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store,'readwrite').objectStore(store).delete(id);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
const app=document.querySelector('#app'),context=document.querySelector('#topContext'),addTop=document.querySelector('#addCardTop');
const today=()=>new Date().toISOString().slice(0,10);const addDays=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};const escapeHTML=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function languageName(code){return LANGUAGE_OPTIONS.find(x=>x[0]===code)?.[1]||code}function dateLabel(date){return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short'}).format(new Date(`${date}T12:00:00`))}
document.querySelector('#homeButton').onclick=showHome;addTop.onclick=()=>currentFolder&&showCardModal(currentFolder);
async function showHome(){currentFolder=null;addTop.classList.add('hidden');context.textContent='mis cuadernos';const folders=await dbAll(STORE_FOLDERS),cards=await dbAll(STORE_CARDS);app.innerHTML=`<section class="home"><p class="eyebrow">Repetición espaciada, sin ruido</p><h1 class="hero-title">Palabras que se quedan contigo.</h1><p class="hero-subtitle">Elige un cuaderno y estudia únicamente lo que toca hoy.</p><div class="folder-list" id="folderList"></div><button class="new-folder" id="newFolder">＋ Crear un cuaderno de vocabulario</button>${folders.length?'':'<p class="empty">Aún no tienes cuadernos. Crea el primero y empieza con unas cuantas palabras que te apetezca recordar.</p>'}</section>`;const list=document.querySelector('#folderList');folders.sort((a,b)=>a.name.localeCompare(b.name,'es')).forEach(f=>{const pending=cards.filter(c=>c.folderId===f.id&&c.nextReview<=today()).length,e=document.querySelector('#folderTemplate').content.cloneNode(true),article=e.querySelector('article');article.querySelector('h3').textContent=f.name;article.querySelector('p').textContent=languageName(f.language);article.querySelector('.folder-count').textContent=pending?`${pending} hoy`:'al día';article.onclick=()=>openFolder(f);list.append(e)});document.querySelector('#newFolder').onclick=showFolderModal}
function overlay(content){const el=document.createElement('div');el.className='modal-layer';el.innerHTML=content;el.addEventListener('click',e=>{if(e.target===el)el.remove()});document.body.append(el);return el}
function showFolderModal(){const opts=LANGUAGE_OPTIONS.map(([id,n])=>`<option value="${id}">${n}</option>`).join(''),m=overlay(`<div class="modal"><button class="close" aria-label="Cerrar">×</button><h2>Nuevo cuaderno</h2><p class="modal-sub">Agrupa palabras de un mismo idioma o tema.</p><form id="folderForm"><label for="folderName">Nombre</label><input id="folderName" required maxlength="50" placeholder="Ej. Viaje a París" autofocus><label for="language">Idioma de las palabras</label><select id="language">${opts}</select><div class="form-actions"><button class="primary">Crear cuaderno</button><button type="button" class="secondary cancel">Cancelar</button></div></form></div>`);m.querySelector('.close').onclick=m.querySelector('.cancel').onclick=()=>m.remove();m.querySelector('form').onsubmit=async e=>{e.preventDefault();const name=m.querySelector('#folderName').value.trim();if(!name)return;const id=await dbPut(STORE_FOLDERS,{name,language:m.querySelector('#language').value,createdAt:Date.now()});m.remove();openFolder((await dbAll(STORE_FOLDERS)).find(x=>x.id===id))}}
async function openFolder(folder){currentFolder=folder;context.textContent=folder.name;addTop.classList.remove('hidden');freeReview=false;const cards=(await dbAll(STORE_CARDS)).filter(c=>c.folderId===folder.id),pending=cards.filter(c=>c.nextReview<=today()).length;app.innerHTML=`<section class="folder-home"><button class="back" id="back">← Todos los cuadernos</button><p class="eyebrow">${languageName(folder.language)} · ${cards.length} palabras</p><h1>${escapeHTML(folder.name)}</h1><p class="folder-intro">Elige cómo quieres continuar.</p><div class="choice-grid"><button class="choice-card" id="study"><span class="choice-symbol">◷</span><span><b>Estudiar tarjetas</b><small>${pending?`${pending} pendientes para hoy`:'No tienes repasos pendientes'}</small></span><i>→</i></button><button class="choice-card" id="words"><span class="choice-symbol">≡</span><span><b>Ver palabras</b><small>Busca, edita o añade vocabulario</small></span><i>→</i></button></div><button class="manage-link" id="quickAdd">Añadir una palabra</button></section>`;document.querySelector('#back').onclick=showHome;document.querySelector('#study').onclick=()=>startStudy(false);document.querySelector('#words').onclick=showWords;document.querySelector('#quickAdd').onclick=()=>showCardModal(folder)}
async function startStudy(isFree){freeReview=isFree;currentQueue=(await dbAll(STORE_CARDS)).filter(c=>c.folderId===currentFolder.id&&(isFree||c.nextReview<=today())).sort((a,b)=>a.nextReview.localeCompare(b.nextReview)||a.id-b.id);revealed=false;renderStudy()}
function renderStudy(){const f=currentFolder,card=currentQueue[0];app.innerHTML=`<section class="study"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>${freeReview?'Repaso libre':'Tarjetas de hoy'}</h1><p class="meta">${freeReview?'este modo no cambia tu progreso':`${languageName(f.language)} → Español`}</p></div></div><div id="studyBody"></div><div class="study-footer"><span>${currentQueue.length?`${currentQueue.length} por ver`:'sesión terminada'}</span><span>${freeReview?'modo libre':'se guarda automáticamente'}</span></div><button class="manage-link" id="manageWords">Ver todas las palabras</button></section>`;document.querySelector('#back').onclick=()=>openFolder(f);document.querySelector('#manageWords').onclick=showWords;const body=document.querySelector('#studyBody');if(!card){body.innerHTML=`<div class="done"><h2>¡Has terminado por hoy!</h2><p>${freeReview?'Has repasado todas las palabras sin modificar ninguna fecha ni estadística.':'Tus tarjetas pendientes ya están programadas para su próximo repaso.'}</p><button class="primary" id="replay">Volver a repasar</button></div>`;document.querySelector('#replay').onclick=()=>startStudy(true);return}body.innerHTML=`<article class="card" id="flashcard" tabindex="0" role="button" aria-label="Mostrar respuesta"><span class="card-tag">${revealed?'traducción':'palabra'}</span><div class="word">${escapeHTML(revealed?card.translation:card.word)}</div><span class="tap">${revealed?'Elige cómo te fue':'toca para revelar'}</span></article>${revealed?'<div class="answer-actions"><button class="dont-know" id="fail">No lo sabía</button><button class="know" id="success">Lo sabía</button></div>':''}`;const reveal=()=>{if(!revealed){revealed=true;renderStudy()}};document.querySelector('#flashcard').onclick=reveal;document.querySelector('#flashcard').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal()}};if(revealed){document.querySelector('#success').onclick=()=>review(card,true);document.querySelector('#fail').onclick=()=>review(card,false)}}
async function review(card,correct){if(freeReview){currentQueue.shift();revealed=false;renderStudy();return}let streak=card.correctStreak||0,failures=card.consecutiveFailures||0,interval;if(correct){streak++;failures=0;interval=[5,15,30,60,120][Math.min(streak-1,4)]}else{failures++;streak=0;interval=failures>=2?2:1}card.correctStreak=streak;card.consecutiveFailures=failures;card.nextReview=addDays(interval);card.history=[...(card.history||[]),{date:new Date().toISOString(),result:correct?'correct':'incorrect',intervalDays:interval}];await dbPut(STORE_CARDS,card);currentQueue.shift();revealed=false;renderStudy()}
async function showWords(){freeReview=false;const f=currentFolder,cards=(await dbAll(STORE_CARDS)).filter(c=>c.folderId===f.id).sort((a,b)=>a.word.localeCompare(b.word,languageName(f.language)));app.innerHTML=`<section class="words-view"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>Todas las palabras</h1><p class="meta">${cards.length} guardadas · ${languageName(f.language)} → Español</p></div><button class="primary compact" id="add">＋ Añadir</button></div><div class="search-wrap"><span>⌕</span><input id="search" placeholder="Buscar palabra o traducción" aria-label="Buscar palabra"></div><div class="word-list" id="wordList"></div></section>`;document.querySelector('#back').onclick=()=>openFolder(f);document.querySelector('#add').onclick=()=>showCardModal(f);const list=document.querySelector('#wordList');const render=query=>{const found=cards.filter(c=>`${c.word} ${c.translation}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));list.innerHTML=found.length?found.map(c=>`<article class="word-row"><div><b>${escapeHTML(c.word)}</b><span>${escapeHTML(c.translation)}</span></div><small>${c.nextReview<=today()?'hoy':`próx. ${dateLabel(c.nextReview)}`}</small><button class="row-edit" data-id="${c.id}" aria-label="Editar ${escapeHTML(c.word)}">Editar</button><button class="row-delete" data-id="${c.id}" aria-label="Eliminar ${escapeHTML(c.word)}">×</button></article>`).join(''):'<p class="empty-list">No se han encontrado palabras.</p>';list.querySelectorAll('.row-edit').forEach(b=>b.onclick=()=>showCardModal(f,cards.find(c=>c.id===+b.dataset.id)));list.querySelectorAll('.row-delete').forEach(b=>b.onclick=async()=>{const card=cards.find(c=>c.id===+b.dataset.id);if(confirm(`¿Eliminar “${card.word}”? Esta acción no se puede deshacer.`)){await dbDelete(STORE_CARDS,card.id);showWords()}})};render('');document.querySelector('#search').oninput=e=>render(e.target.value)}
function showCardModal(folder,card=null){const editing=Boolean(card),m=overlay(`<div class="modal"><button class="close" aria-label="Cerrar">×</button><h2>${editing?'Editar palabra':'Añadir palabra'}</h2><p class="modal-sub">${editing?'Los cambios se guardan automáticamente.':'Se programará para estudiarla ahora mismo.'}</p><form id="cardForm"><label for="word">Palabra en ${languageName(folder.language)}</label><input id="word" required maxlength="100" placeholder="Ej. bonjour" value="${editing?escapeHTML(card.word):''}"><label for="translation">Traducción al español</label><div class="translate-row"><input id="translation" required maxlength="140" placeholder="Ej. hola" value="${editing?escapeHTML(card.translation):''}"><button class="translate-button" type="button" id="translate">Traducir</button></div><p class="hint" id="translationHint">Escribe en español y pulsa «Traducir» para completar la palabra.</p><div class="form-actions"><button class="primary">${editing?'Guardar cambios':'Guardar palabra'}</button><button type="button" class="secondary cancel">Cancelar</button></div></form></div>`);m.querySelector('.close').onclick=m.querySelector('.cancel').onclick=()=>m.remove();const word=m.querySelector('#word'),translation=m.querySelector('#translation'),hint=m.querySelector('#translationHint');m.querySelector('#translate').onclick=async()=>{const source=translation.value.trim();if(!source){hint.textContent='Escribe primero una traducción en español.';translation.focus();return}hint.textContent='Traduciendo…';try{const response=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(source)}&langpair=es|${folder.language}`),data=await response.json(),result=data?.responseData?.translatedText;if(!result)throw Error();word.value=result;hint.textContent='Traducción añadida. Puedes ajustarla antes de guardar.'}catch{hint.textContent='No se pudo traducir automáticamente. Añade la palabra manualmente.'}};m.querySelector('form').onsubmit=async e=>{e.preventDefault();const data=editing?{...card,word:word.value.trim(),translation:translation.value.trim()}:{folderId:folder.id,word:word.value.trim(),translation:translation.value.trim(),nextReview:today(),correctStreak:0,consecutiveFailures:0,history:[],createdAt:Date.now()};await dbPut(STORE_CARDS,data);m.remove();showWords()}}
async function showWords(){
  freeReview=false;
  const f=currentFolder;
  const cards=(await dbAll(STORE_CARDS))
    .filter(card=>card.folderId===f.id)
    .sort((a,b)=>a.word.localeCompare(b.word,f.language));
  app.innerHTML=`<section class="words-view"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>Todas las palabras</h1><p class="meta">${cards.length} guardadas · ${languageName(f.language)} → Español</p></div><button class="primary compact" id="add">＋ Añadir</button></div><div class="search-wrap"><span>⌕</span><input id="search" placeholder="Buscar palabra o traducción" aria-label="Buscar palabra"></div><div class="word-list" id="wordList"></div></section>`;
  document.querySelector('#back').onclick=()=>openFolder(f);
  document.querySelector('#add').onclick=()=>showCardModal(f);
  const list=document.querySelector('#wordList');
  const render=query=>{
    const text=query.toLocaleLowerCase();
    const found=cards.filter(card=>`${card.word} ${card.translation}`.toLocaleLowerCase().includes(text));
    list.innerHTML=found.length?found.map(card=>`<article class="word-row"><div><b>${escapeHTML(card.word)}</b><span>${escapeHTML(card.translation)}</span></div><small>${card.nextReview<=today()?'hoy':`próx. ${dateLabel(card.nextReview)}`}</small><button class="row-edit" data-id="${card.id}">Editar</button><button class="row-delete" data-id="${card.id}">×</button></article>`).join(''):'<p class="empty-list">No se han encontrado palabras.</p>';
    list.querySelectorAll('.row-edit').forEach(button=>button.onclick=()=>showCardModal(f,cards.find(card=>card.id===+button.dataset.id)));
    list.querySelectorAll('.row-delete').forEach(button=>button.onclick=async()=>{const card=cards.find(item=>item.id===+button.dataset.id);if(confirm(`¿Eliminar “${card.word}”? Esta acción no se puede deshacer.`)){await dbDelete(STORE_CARDS,card.id);showWords()}});
  };
  render('');
  document.querySelector('#search').oninput=event=>render(event.target.value);
}
function showCardModal(folder,card=null){
  const editing=Boolean(card);
  const m=overlay(`<div class="modal"><button class="close" aria-label="Cerrar">×</button><h2>${editing?'Editar palabra':'Añadir palabra'}</h2><p class="modal-sub">${editing?'Los cambios se guardan automáticamente.':'Se programará para estudiarla ahora mismo.'}</p><form id="cardForm"><label for="word">Palabra en ${languageName(folder.language)}</label><input id="word" required maxlength="100" placeholder="Ej. bonjour" value="${editing?escapeHTML(card.word):''}"><label for="translation">Traducción al español</label><input id="translation" required maxlength="140" placeholder="Ej. hola" value="${editing?escapeHTML(card.translation):''}"><div class="form-actions"><button class="primary">${editing?'Guardar cambios':'Guardar palabra'}</button><button type="button" class="secondary cancel">Cancelar</button></div></form></div>`);
  m.querySelector('.close').onclick=m.querySelector('.cancel').onclick=()=>m.remove();
  m.querySelector('form').onsubmit=async event=>{
    event.preventDefault();
    const word=m.querySelector('#word').value.trim();
    const translation=m.querySelector('#translation').value.trim();
    const data=editing?{...card,word,translation}:{folderId:folder.id,word,translation,nextReview:today(),correctStreak:0,consecutiveFailures:0,history:[],createdAt:Date.now()};
    await dbPut(STORE_CARDS,data);
    m.remove();
    showWords();
  };
}
function speakFrench(text){
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='fr-FR';
  const voices=window.speechSynthesis.getVoices();
  const frenchVoices=voices.filter(voice=>voice.lang.toLowerCase().startsWith('fr'));
  utterance.voice=frenchVoices.find(voice=>voice.lang.toLowerCase()==='fr-fr'&&voice.localService)||frenchVoices.find(voice=>voice.lang.toLowerCase()==='fr-fr')||frenchVoices.find(voice=>voice.localService)||frenchVoices[0]||null;
  utterance.rate=.88;
  window.speechSynthesis.speak(utterance);
}
function renderStudy(){
  const f=currentFolder,card=currentQueue[0];
  app.innerHTML=`<section class="study"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>${freeReview?'Repaso libre':'Tarjetas de hoy'}</h1><p class="meta">${freeReview?'este modo no cambia tu progreso':`${languageName(f.language)} → Español`}</p></div></div><div id="studyBody"></div><div class="study-footer"><span>${currentQueue.length?`${currentQueue.length} por ver`:'sesión terminada'}</span><span>${freeReview?'modo libre':'se guarda automáticamente'}</span></div><button class="manage-link" id="manageWords">Ver todas las palabras</button></section>`;
  document.querySelector('#back').onclick=()=>openFolder(f);
  document.querySelector('#manageWords').onclick=showWords;
  const body=document.querySelector('#studyBody');
  if(!card){body.innerHTML=`<div class="done"><h2>¡Has terminado por hoy!</h2><p>${freeReview?'Has repasado todas las palabras sin modificar ninguna fecha ni estadística.':'Tus tarjetas pendientes ya están programadas para su próximo repaso.'}</p><button class="primary" id="replay">Volver a repasar</button></div>`;document.querySelector('#replay').onclick=()=>startStudy(true);return}
  const pronunciation=!revealed&&f.language==='fr'?'<button class="speaker" id="speakFrench" type="button" aria-label="Escuchar pronunciación en francés">🔊</button>':'';
  body.innerHTML=`<article class="card" id="flashcard" tabindex="0" role="button" aria-label="Mostrar respuesta"><span class="card-tag">${revealed?'traducción':'palabra'}</span>${pronunciation}<div class="word">${escapeHTML(revealed?card.translation:card.word)}</div><span class="tap">${revealed?'Elige cómo te fue':'toca para revelar'}</span></article>${revealed?'<div class="answer-actions"><button class="dont-know" id="fail">No lo sabía</button><button class="know" id="success">Lo sabía</button></div>':''}`;
  const reveal=()=>{if(!revealed){revealed=true;renderStudy()}};
  document.querySelector('#flashcard').onclick=reveal;
  document.querySelector('#flashcard').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal()}};
  const speaker=document.querySelector('#speakFrench');
  if(speaker){
    Object.assign(speaker.style,{position:'absolute',top:'15px',right:'15px',width:'40px',height:'40px',border:'1px solid var(--line)',borderRadius:'50%',background:'#fffdf9',fontSize:'17px',cursor:'pointer'});
    speaker.onclick=event=>{event.stopPropagation();speakFrench(card.word)};
  }
  if(revealed){document.querySelector('#success').onclick=()=>review(card,true);document.querySelector('#fail').onclick=()=>review(card,false)}
}
let sessionCards=[],sessionIndex=0;
const sessionAnswers=new Map();
async function startStudy(isFree){
  freeReview=isFree;
  sessionCards=(await dbAll(STORE_CARDS)).filter(card=>card.folderId===currentFolder.id&&(isFree||card.nextReview<=today())).sort((a,b)=>a.nextReview.localeCompare(b.nextReview)||a.id-b.id);
  sessionIndex=0;
  sessionAnswers.clear();
  revealed=false;
  renderStudy();
}
async function review(card,correct){
  if(sessionAnswers.has(card.id))return;
  sessionAnswers.set(card.id,correct);
  if(!freeReview){
    let streak=card.correctStreak||0,failures=card.consecutiveFailures||0,interval;
    if(correct){streak++;failures=0;interval=[5,15,30,60,120][Math.min(streak-1,4)]}else{failures++;streak=0;interval=failures>=2?2:1}
    card.correctStreak=streak;card.consecutiveFailures=failures;card.nextReview=addDays(interval);
    card.history=[...(card.history||[]),{date:new Date().toISOString(),result:correct?'correct':'incorrect',intervalDays:interval}];
    await dbPut(STORE_CARDS,card);
  }
  sessionIndex++;
  revealed=false;
  renderStudy();
}
function previousCard(){if(sessionIndex>0){sessionIndex--;revealed=false;renderStudy()}}
function nextCard(){if(sessionIndex<sessionCards.length){sessionIndex++;revealed=false;renderStudy()}}
function renderStudy(){
  const f=currentFolder,card=sessionCards[sessionIndex],remaining=Math.max(0,sessionCards.length-sessionIndex);
  app.innerHTML=`<section class="study"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>${freeReview?'Repaso libre':'Tarjetas de hoy'}</h1><p class="meta">${freeReview?'este modo no cambia tu progreso':`${languageName(f.language)} → Español`}</p></div></div><div id="studyBody"></div><div class="study-footer"><span>${remaining?`${remaining} por ver`:'sesión terminada'}</span><span>${freeReview?'modo libre':'se guarda automáticamente'}</span></div><button class="manage-link" id="manageWords">Ver todas las palabras</button></section>`;
  document.querySelector('#back').onclick=()=>openFolder(f);document.querySelector('#manageWords').onclick=showWords;
  const body=document.querySelector('#studyBody'),previous=`<button class="secondary session-previous" id="previous" ${sessionIndex===0?'disabled':''}>← Anterior</button>`;
  if(!card){body.innerHTML=`<div class="done"><h2>¡Has terminado por hoy!</h2><p>${freeReview?'Has repasado todas las palabras sin modificar ninguna fecha ni estadística.':'Tus tarjetas pendientes ya están programadas para su próximo repaso.'}</p><button class="primary" id="replay">Volver a repasar</button></div><div class="session-nav">${previous}</div>`;document.querySelector('#replay').onclick=()=>startStudy(true);document.querySelector('#previous').onclick=previousCard;return}
  const answered=sessionAnswers.has(card.id),answer=sessionAnswers.get(card.id),pronunciation=!revealed&&f.language==='fr'?'<button class="speaker" id="speakFrench" type="button" aria-label="Escuchar pronunciación en francés">🔊</button>':'',tapLabel=revealed?(answered?'Respuesta ya registrada':'Elige cómo te fue'):'toca para revelar';
  const afterReveal=answered?`<div class="recorded-answer">${answer?'Lo sabías':'No lo sabías'} · respuesta ya guardada</div>${sessionIndex<sessionCards.length-1?'<button class="secondary next-card" id="next">Siguiente →</button>':''}`:'<div class="answer-actions"><button class="dont-know" id="fail">No lo sabía</button><button class="know" id="success">Lo sabía</button></div>';
  body.innerHTML=`<article class="card" id="flashcard" tabindex="0" role="button" aria-label="Mostrar respuesta"><span class="card-tag">${revealed?'traducción':'palabra'}</span>${pronunciation}<div class="word">${escapeHTML(revealed?card.translation:card.word)}</div><span class="tap">${tapLabel}</span></article>${revealed?afterReveal:''}<div class="session-nav">${previous}</div>`;
  const reveal=()=>{if(!revealed){revealed=true;renderStudy()}};document.querySelector('#flashcard').onclick=reveal;document.querySelector('#flashcard').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal()}};
  const speaker=document.querySelector('#speakFrench');if(speaker){Object.assign(speaker.style,{position:'absolute',top:'15px',right:'15px',width:'40px',height:'40px',border:'1px solid var(--line)',borderRadius:'50%',background:'#fffdf9',fontSize:'17px',cursor:'pointer'});speaker.onclick=event=>{event.stopPropagation();speakFrench(card.word)}}
  document.querySelector('#previous').onclick=previousCard;
  if(revealed&&!answered){document.querySelector('#success').onclick=()=>review(card,true);document.querySelector('#fail').onclick=()=>review(card,false)}
  if(revealed&&answered&&document.querySelector('#next'))document.querySelector('#next').onclick=nextCard;
}
async function startStudy(isFree){
  freeReview=isFree;
  sessionCards=(await dbAll(STORE_CARDS)).filter(card=>card.folderId===currentFolder.id).sort((a,b)=>a.id-b.id);
  sessionIndex=0;
  sessionAnswers.clear();
  revealed=false;
  renderStudy();
}
function renderStudy(){
  const f=currentFolder,card=sessionCards[sessionIndex],remaining=Math.max(0,sessionCards.length-sessionIndex);
  app.innerHTML=`<section class="study"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>${freeReview?'Repaso libre':'Tarjetas de hoy'}</h1><p class="meta">${freeReview?'este modo no cambia tu progreso':`${languageName(f.language)} → Español`}</p></div></div><div id="studyBody"></div><div class="study-footer"><span>${remaining?`${remaining} por ver`:'sesión terminada'}</span><span>${freeReview?'modo libre':'se guarda automáticamente'}</span></div><button class="manage-link" id="manageWords">Ver todas las palabras</button></section>`;
  document.querySelector('#back').onclick=()=>openFolder(f);document.querySelector('#manageWords').onclick=showWords;
  const body=document.querySelector('#studyBody');
  const nav=`<div class="session-nav"><button class="secondary" id="previous" ${sessionIndex===0?'disabled':''}>← Anterior</button><button class="secondary" id="next" ${sessionIndex>=sessionCards.length-1?'disabled':''}>Siguiente →</button></div>`;
  if(!card){body.innerHTML=`<div class="done"><h2>¡Has terminado por hoy!</h2><p>${freeReview?'Has repasado todas las palabras sin modificar ninguna fecha ni estadística.':'Tus tarjetas pendientes ya están programadas para su próximo repaso.'}</p><button class="primary" id="replay">Volver a repasar</button></div>${nav}`;document.querySelector('#replay').onclick=()=>startStudy(true);document.querySelector('#previous').onclick=previousCard;return}
  const answered=sessionAnswers.has(card.id),answer=sessionAnswers.get(card.id),due=card.nextReview<=today(),canAnswer=freeReview||due,pronunciation=!revealed&&f.language==='fr'?'<button class="speaker" id="speakFrench" type="button" aria-label="Escuchar pronunciación en francés">🔊</button>':'',tapLabel=revealed?(answered?'Respuesta ya registrada':canAnswer?'Elige cómo te fue':`Programada para ${dateLabel(card.nextReview)}`):'toca para revelar';
  const afterReveal=answered?`<div class="recorded-answer">${answer?'Lo sabías':'No lo sabías'} · respuesta ya guardada</div>`:canAnswer?'<div class="answer-actions"><button class="dont-know" id="fail">No lo sabía</button><button class="know" id="success">Lo sabía</button></div>':'<div class="recorded-answer">Esta tarjeta aún no está pendiente; puedes consultarla sin modificar su programación.</div>';
  body.innerHTML=`<article class="card" id="flashcard" tabindex="0" role="button" aria-label="Mostrar respuesta"><span class="card-tag">${revealed?'traducción':'palabra'}</span>${pronunciation}<div class="word">${escapeHTML(revealed?card.translation:card.word)}</div><span class="tap">${tapLabel}</span></article>${revealed?afterReveal:''}${nav}`;
  const reveal=()=>{if(!revealed){revealed=true;renderStudy()}};document.querySelector('#flashcard').onclick=reveal;document.querySelector('#flashcard').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal()}};
  const speaker=document.querySelector('#speakFrench');if(speaker){Object.assign(speaker.style,{position:'absolute',top:'15px',right:'15px',width:'40px',height:'40px',border:'1px solid var(--line)',borderRadius:'50%',background:'#fffdf9',fontSize:'17px',cursor:'pointer'});speaker.onclick=event=>{event.stopPropagation();speakFrench(card.word)}}
  document.querySelector('#previous').onclick=previousCard;document.querySelector('#next').onclick=nextCard;
  if(revealed&&!answered&&canAnswer){document.querySelector('#success').onclick=()=>review(card,true);document.querySelector('#fail').onclick=()=>review(card,false)}
}
async function startStudy(isFree){
  freeReview=isFree;
  currentQueue=(await dbAll(STORE_CARDS)).filter(card=>card.folderId===currentFolder.id&&(isFree||card.nextReview<=today())).sort((a,b)=>a.nextReview.localeCompare(b.nextReview)||a.id-b.id);
  revealed=false;
  renderStudy();
}
async function review(card,correct){
  if(!freeReview){
    let streak=card.correctStreak||0,failures=card.consecutiveFailures||0,interval;
    if(correct){streak++;failures=0;interval=[5,15,30,60,120][Math.min(streak-1,4)]}else{failures++;streak=0;interval=failures>=2?2:1}
    card.correctStreak=streak;card.consecutiveFailures=failures;card.nextReview=addDays(interval);
    card.history=[...(card.history||[]),{date:new Date().toISOString(),result:correct?'correct':'incorrect',intervalDays:interval}];
    await dbPut(STORE_CARDS,card);
  }
  currentQueue.shift();
  revealed=false;
  renderStudy();
}
function renderStudy(){
  const f=currentFolder,card=currentQueue[0];
  app.innerHTML=`<section class="study"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>${freeReview?'Repaso libre':'Tarjetas de hoy'}</h1><p class="meta">${freeReview?'este modo no cambia tu progreso':`${languageName(f.language)} → Español`}</p></div></div><div id="studyBody"></div><div class="study-footer"><span>${currentQueue.length?`${currentQueue.length} por ver`:'sesión terminada'}</span><span>${freeReview?'modo libre':'se guarda automáticamente'}</span></div><button class="manage-link" id="manageWords">Ver todas las palabras</button></section>`;
  document.querySelector('#back').onclick=()=>openFolder(f);document.querySelector('#manageWords').onclick=showWords;
  const body=document.querySelector('#studyBody');
  if(!card){body.innerHTML=`<div class="done"><h2>¡Has terminado por hoy!</h2><p>${freeReview?'Has repasado todas las palabras sin modificar ninguna fecha ni estadística.':'Tus tarjetas pendientes ya están programadas para su próximo repaso.'}</p><button class="primary" id="replay">Volver a repasar</button></div>`;document.querySelector('#replay').onclick=()=>startStudy(true);return}
  const pronunciation=!revealed&&f.language==='fr'?'<button class="speaker" id="speakFrench" type="button" aria-label="Escuchar pronunciación en francés">🔊</button>':'';
  body.innerHTML=`<article class="card" id="flashcard" tabindex="0" role="button" aria-label="Mostrar respuesta"><span class="card-tag">${revealed?'traducción':'palabra'}</span>${pronunciation}<div class="word">${escapeHTML(revealed?card.translation:card.word)}</div><span class="tap">${revealed?'Elige cómo te fue':'toca para revelar'}</span></article>${revealed?'<div class="answer-actions"><button class="dont-know" id="fail">No lo sabía</button><button class="know" id="success">Lo sabía</button></div>':''}`;
  const reveal=()=>{if(!revealed){revealed=true;renderStudy()}};document.querySelector('#flashcard').onclick=reveal;document.querySelector('#flashcard').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal()}};
  const speaker=document.querySelector('#speakFrench');if(speaker){Object.assign(speaker.style,{position:'absolute',top:'15px',right:'15px',width:'40px',height:'40px',border:'1px solid var(--line)',borderRadius:'50%',background:'#fffdf9',fontSize:'17px',cursor:'pointer'});speaker.onclick=event=>{event.stopPropagation();speakFrench(card.word)}}
  if(revealed){document.querySelector('#success').onclick=()=>review(card,true);document.querySelector('#fail').onclick=()=>review(card,false)}
}
let pronunciationRate=1;
function speakFrench(text){
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='fr-FR';
  const frenchVoices=window.speechSynthesis.getVoices().filter(voice=>voice.lang.toLowerCase().startsWith('fr'));
  utterance.voice=frenchVoices.find(voice=>voice.lang.toLowerCase()==='fr-fr'&&voice.localService)||frenchVoices.find(voice=>voice.lang.toLowerCase()==='fr-fr')||frenchVoices.find(voice=>voice.localService)||frenchVoices[0]||null;
  utterance.rate=pronunciationRate;
  window.speechSynthesis.speak(utterance);
}
function renderStudy(){
  const f=currentFolder,card=currentQueue[0];
  app.innerHTML=`<section class="study"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>${freeReview?'Repaso libre':'Tarjetas de hoy'}</h1><p class="meta">${freeReview?'este modo no cambia tu progreso':`${languageName(f.language)} → Español`}</p></div></div><div id="studyBody"></div><div class="study-footer"><span>${currentQueue.length?`${currentQueue.length} por ver`:'sesión terminada'}</span><span>${freeReview?'modo libre':'se guarda automáticamente'}</span></div><button class="manage-link" id="manageWords">Ver todas las palabras</button></section>`;
  document.querySelector('#back').onclick=()=>openFolder(f);document.querySelector('#manageWords').onclick=showWords;
  const body=document.querySelector('#studyBody');
  if(!card){body.innerHTML=`<div class="done"><h2>¡Has terminado por hoy!</h2><p>${freeReview?'Has repasado todas las palabras sin modificar ninguna fecha ni estadística.':'Tus tarjetas pendientes ya están programadas para su próximo repaso.'}</p><button class="primary" id="replay">Volver a repasar</button></div>`;document.querySelector('#replay').onclick=()=>startStudy(true);return}
  const pronunciation=!revealed&&f.language==='fr'?`<div class="pronunciation-controls" id="pronunciationControls"><button class="speaker" id="speakFrench" type="button" aria-label="Escuchar pronunciación en francés">🔊</button><div class="speed-picker" aria-label="Velocidad de pronunciación"><button data-rate=".5">0,5x</button><button data-rate=".75">0,75x</button><button data-rate="1">1x</button></div></div>`:'';
  body.innerHTML=`<article class="card" id="flashcard" tabindex="0" role="button" aria-label="Mostrar respuesta"><span class="card-tag">${revealed?'traducción':'palabra'}</span>${pronunciation}<div class="word">${escapeHTML(revealed?card.translation:card.word)}</div><span class="tap">${revealed?'Elige cómo te fue':'toca para revelar'}</span></article>${revealed?'<div class="answer-actions"><button class="dont-know" id="fail">No lo sabía</button><button class="know" id="success">Lo sabía</button></div>':''}`;
  const reveal=()=>{if(!revealed){revealed=true;renderStudy()}};document.querySelector('#flashcard').onclick=reveal;document.querySelector('#flashcard').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal()}};
  const speaker=document.querySelector('#speakFrench');if(speaker){const controls=document.querySelector('#pronunciationControls'),picker=controls.querySelector('.speed-picker');Object.assign(controls.style,{position:'absolute',top:'15px',right:'15px',display:'grid',justifyItems:'end',gap:'7px'});Object.assign(speaker.style,{width:'40px',height:'40px',border:'1px solid var(--line)',borderRadius:'50%',background:'#fffdf9',fontSize:'17px',cursor:'pointer'});Object.assign(picker.style,{display:'flex',gap:'4px'});speaker.onclick=event=>{event.stopPropagation();speakFrench(card.word)};picker.querySelectorAll('button').forEach(button=>{const rate=Number(button.dataset.rate),active=rate===pronunciationRate;Object.assign(button.style,{border:'1px solid var(--line)',borderRadius:'6px',padding:'4px 6px',fontSize:'10px',cursor:'pointer',background:active?'var(--accent)':'#fffdf9',color:active?'#fff':'var(--ink)'});button.onclick=event=>{event.stopPropagation();pronunciationRate=rate;picker.querySelectorAll('button').forEach(item=>{const selected=Number(item.dataset.rate)===rate;item.style.background=selected?'var(--accent)':'#fffdf9';item.style.color=selected?'#fff':'var(--ink)'})}})}
  if(revealed){document.querySelector('#success').onclick=()=>review(card,true);document.querySelector('#fail').onclick=()=>review(card,false)}
}
async function openFolder(folder){
  currentFolder=folder;context.textContent=folder.name;addTop.classList.remove('hidden');freeReview=false;
  const cards=(await dbAll(STORE_CARDS)).filter(card=>card.folderId===folder.id),pending=cards.filter(card=>card.nextReview<=today()).length;
  app.innerHTML=`<section class="folder-home"><button class="back" id="back">← Todos los cuadernos</button><p class="eyebrow">${languageName(folder.language)} · ${cards.length} palabras</p><h1>${escapeHTML(folder.name)}</h1><p class="folder-intro">Elige cómo quieres continuar.</p><div class="choice-grid"><button class="choice-card" id="study"><span class="choice-symbol">◷</span><span><b>Estudiar tarjetas</b><small>${pending?`${pending} pendientes para hoy`:'No tienes repasos pendientes'}</small></span><i>→</i></button><button class="choice-card" id="words"><span class="choice-symbol">≡</span><span><b>Ver palabras</b><small>Busca, edita o añade vocabulario</small></span><i>→</i></button><button class="choice-card" id="progress"><span class="choice-symbol">↗</span><span><b>Mi progreso</b><small>Estadísticas y evolución</small></span><i>→</i></button></div><button class="manage-link" id="quickAdd">Añadir una palabra</button></section>`;
  document.querySelector('#back').onclick=showHome;document.querySelector('#study').onclick=()=>startStudy(false);document.querySelector('#words').onclick=showWords;document.querySelector('#progress').onclick=showProgress;document.querySelector('#quickAdd').onclick=()=>showCardModal(folder);
}
function historyDay(entry){return entry.date.slice(0,10)}
function statBox(label,value){return `<div style="border:1px solid var(--line);border-radius:11px;padding:14px;background:#fbf9f4"><span style="display:block;font:10px var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:7px">${label}</span><b style="font:500 27px var(--serif);letter-spacing:-1px">${value}</b></div>`}
function chartSVG(series){
  if(!series.length)return '<p class="empty-list">Todavía no hay actividad registrada para este periodo.</p>';
  const max=Math.max(...series.map(item=>item.count),1),width=560,height=150,barWidth=Math.max(10,Math.min(42,(width/series.length)-8));
  const bars=series.map((item,index)=>{const x=(width/series.length)*index+(width/series.length-barWidth)/2,h=(item.count/max)*104,y=122-h;return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="4" fill="#315a4b"/><text x="${x+barWidth/2}" y="142" text-anchor="middle" font-size="9" fill="#77746c">${item.day.slice(5)}</text>`}).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Respuestas registradas por día">${bars}</svg>`;
}
async function showProgress(){
  const f=currentFolder,cards=(await dbAll(STORE_CARDS)).filter(card=>card.folderId===f.id),entries=cards.flatMap(card=>(card.history||[]).map(item=>({...item,word:card.word,cardId:card.id})));
  const correct=entries.filter(item=>item.result==='correct').length,incorrect=entries.filter(item=>item.result==='incorrect').length,totalResponses=correct+incorrect,todayEntries=entries.filter(item=>historyDay(item)===today()),studiedToday=new Set(todayEntries.map(item=>item.cardId)).size;
  const days=[...new Set(entries.map(historyDay))].sort().reverse();let streak=0,expected=today();while(days.includes(expected)){streak++;const date=new Date(`${expected}T12:00:00`);date.setDate(date.getDate()-1);expected=date.toISOString().slice(0,10)}
  const errors=cards.map(card=>({word:card.word,count:(card.history||[]).filter(item=>item.result==='incorrect').length})).filter(item=>item.count).sort((a,b)=>b.count-a.count||a.word.localeCompare(b.word,f.language)).slice(0,5);
  app.innerHTML=`<section class="words-view"><div class="study-head"><div><button class="back" id="back">← ${escapeHTML(f.name)}</button><h1>Mi progreso</h1><p class="meta">Datos reales de tus repasos</p></div></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">${statBox('Palabras totales',cards.length)}${statBox('Aprendidas',cards.filter(card=>(card.correctStreak||0)>0).length)}${statBox('Pendientes',cards.filter(card=>card.nextReview<=today()).length)}${statBox('Aciertos',totalResponses?`${Math.round(correct/totalResponses*100)}%`:'—')}${statBox('Lo sabía',correct)}${statBox('No lo sabía',incorrect)}${statBox('Estudiadas hoy',studiedToday)}${statBox('Racha',`${streak} ${streak===1?'día':'días'}`)}</div><section style="margin-top:28px"><p class="eyebrow">Evolución</p><div style="display:flex;gap:7px;margin:0 0 12px"><button class="secondary period" data-period="7">7 días</button><button class="secondary period" data-period="30">30 días</button><button class="secondary period" data-period="all">Todo</button></div><div id="chart" style="border:1px solid var(--line);border-radius:12px;padding:13px;background:#fbf9f4"></div></section><section style="margin-top:28px"><p class="eyebrow">Más errores</p><div id="errors" style="border-top:1px solid var(--line)"></div></section></section>`;
  document.querySelector('#back').onclick=()=>openFolder(f);
  const renderPeriod=period=>{const cutoff=period==='all'?null:addDays(-Number(period)+1),daily=new Map();entries.filter(item=>!cutoff||historyDay(item)>=cutoff).forEach(item=>daily.set(historyDay(item),(daily.get(historyDay(item))||0)+1));document.querySelector('#chart').innerHTML=chartSVG([...daily].sort(([a],[b])=>a.localeCompare(b)).map(([day,count])=>({day,count})));document.querySelectorAll('.period').forEach(button=>{const active=button.dataset.period===period;button.style.background=active?'var(--accent)':'transparent';button.style.color=active?'#fff':'var(--ink)';button.style.borderColor=active?'var(--accent)':'var(--line)'})};
  document.querySelectorAll('.period').forEach(button=>button.onclick=()=>renderPeriod(button.dataset.period));renderPeriod('7');
  document.querySelector('#errors').innerHTML=errors.length?errors.map(item=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:13px 3px;border-bottom:1px solid var(--line)"><b style="font:500 18px var(--serif)">${escapeHTML(item.word)}</b><span style="font:11px var(--mono);color:var(--red)">${item.count} ${item.count===1?'fallo':'fallos'}</span></div>`).join(''):'<p class="empty-list">Aún no hay errores registrados.</p>';
}
async function openFolder(folder){
  currentFolder=folder;context.textContent=folder.name;addTop.classList.remove('hidden');freeReview=false;
  const cards=(await dbAll(STORE_CARDS)).filter(card=>card.folderId===folder.id),pending=cards.filter(card=>card.nextReview<=today()).length;
  app.innerHTML=`<section class="folder-home"><button class="back" id="back">← Todos los cuadernos</button><p class="eyebrow">${languageName(folder.language)} · ${cards.length} palabras</p><h1>${escapeHTML(folder.name)}</h1><p class="folder-intro">Elige cómo quieres continuar.</p><div class="choice-grid"><button class="choice-card" id="study"><span class="choice-symbol">◷</span><span><b>Estudiar tarjetas</b><small>${pending?`${pending} pendientes para hoy`:'No tienes repasos pendientes'}</small></span><i>→</i></button><button class="choice-card" id="words"><span class="choice-symbol">≡</span><span><b>Ver palabras</b><small>Busca, edita o añade vocabulario</small></span><i>→</i></button></div><button class="manage-link" id="quickAdd">Añadir una palabra</button></section>`;
  document.querySelector('#back').onclick=showHome;document.querySelector('#study').onclick=()=>startStudy(false);document.querySelector('#words').onclick=showWords;document.querySelector('#quickAdd').onclick=()=>showCardModal(folder);
}
showHome();
