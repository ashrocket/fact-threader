const $ = selector => document.querySelector(selector);
const el = (tag, className, text) => { const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node; };
const disclosure='Scheduled post · ';
const samples=[
  {id:'demo-1',postText:'Demo post 1. A real post would give one fact about ICE, its date, and a link to the original record. https://example.org/demo-1'},
  {id:'demo-2',postText:'Demo post 2. Each post includes its source. The “Scheduled post” label tells readers how it was sent. https://example.org/demo-2'},
  {id:'demo-3',postText:'Demo post 3. This is the last post in the sample queue. Posting stops here until you approve more. https://example.org/demo-3'}
];
let facts=[],version='',selected=[],demo=true,running=false,csrf='',account=null;
function notice(message){$('#notice').textContent=message;$('#notice').classList.remove('hidden');setTimeout(()=>$('#notice').classList.add('hidden'),7000);}
async function api(path,method='GET',data){const response=await fetch(path,{method,headers:method==='GET'?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:data?JSON.stringify(data):undefined});let value;try{value=await response.json();}catch{throw new Error('Threads connection is unavailable. You can still try the demo.');}if(!response.ok)throw new Error(value.error??'Request failed');return value;}
function invalidate(){running=false;$('#consent').checked=false;$('#disclosure').checked=false;$('#pause').disabled=true;$('#queue-result').textContent=demo?'Read the posts, then check both boxes to try this schedule.':'Read the posts, then check both boxes to approve this schedule.';}
function renderLibrary(){
  const query=$('#search').value.toLowerCase(),filter=$('#review-filter').value;
  const shown=facts.filter(f=>(filter==='all'||f.status===filter)&&`${f.claim} ${f.category} ${f.sources.map(s=>s.title+' '+s.publisher).join(' ')}`.toLowerCase().includes(query));
  const list=$('#facts-list');list.replaceChildren();
  $('#library-count').textContent=`${shown.length} of ${facts.length} records`;
  if(!shown.length){const box=el('div','empty-library');box.append(el('h3','',facts.length?'No matching facts':'The facts are still being checked.'));box.append(el('p','',facts.length?'Try fewer search words or change the review filter.':'We’re checking the first 100 facts against the original records. They’ll appear here with the evidence behind them. For now, try the posting controls with sample text.'));const link=el('a','',facts.length?'Clear search':'How to add a fact');link.href=facts.length?'#library':'https://github.com/ashrocket/fact-threader/blob/main/CONTRIBUTING.md';if(facts.length)link.addEventListener('click',()=>{$('#search').value='';$('#review-filter').value='all';renderLibrary();});box.append(link);list.append(box);return;}
  for(const fact of shown){
    const card=el('article','fact'),main=el('div'),meta=el('div','fact-meta');
    const label={reviewed:'Reviewed',needs_review:'Awaiting review',withdrawn:'Withdrawn'}[fact.status];
    meta.append(el('span',`badge ${fact.status}`,label),el('span','',fact.id),el('span','',fact.category),el('span','',`As of ${fact.asOf}`));
    main.append(meta,el('h3','',fact.claim));
    const details=el('details'),summary=el('summary','','Read the source and proposed post');details.append(summary);
    for(const source of fact.sources){const evidence=el('div','evidence-box');const a=el('a','',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';evidence.append(a,el('p','',`${source.publisher} · Published ${source.publishedAt} · Retrieved ${source.retrievedAt}`),el('p','',`Evidence: ${source.locator}`),el('blockquote','',source.evidence),el('p','',`Classification: ${fact.classification.replaceAll('_',' ')}`));details.append(evidence);}
    details.append(el('div','post-preview',disclosure+fact.postText),el('p','quiet',`${[...(disclosure+fact.postText)].length}/500 characters including disclosure and source`));main.append(details);card.append(main);
    const chosen=selected.some(s=>s.id===fact.id);const add=el('button','secondary fact-select',chosen?'Remove':fact.status==='reviewed'?'Add to queue':'Being checked');add.disabled=fact.status!=='reviewed'||running;add.setAttribute('aria-label',`${chosen?'Remove':'Add'} ${fact.id} ${chosen?'from':'to'} your queue`);add.addEventListener('click',()=>{if(demo&&selected.some(s=>s.id.startsWith('demo-')))selected=[];selected=chosen?selected.filter(s=>s.id!==fact.id):[...selected,fact];invalidate();renderLibrary();renderQueue();});card.append(add);list.append(card);
  }
}
function renderQueue(){
  const area=$('#selected-posts');area.replaceChildren();
  if(!selected.length)area.append(el('p','quiet','No posts picked yet. Try the demo or choose reviewed facts above.'));
  selected.forEach((post,index)=>{const row=el('div','selected-post'),text=el('div');text.append(el('small','',post.id),el('p','',disclosure+post.postText));const remove=el('button','','×');remove.setAttribute('aria-label',`Remove ${post.id}`);remove.disabled=running;remove.addEventListener('click',()=>{selected.splice(index,1);invalidate();renderQueue();renderLibrary();});row.append(el('span','selected-post-number',String(index+1)),text,remove);area.append(row);});
  $('#queue-mode').textContent=demo?'Demo':account?.status??'Connected';$('#demo-explanation').textContent=demo?'This is a made-up account. The sample posts stay in your browser.':'Read each post below. This is exactly what will appear on your Threads account.';
  $('#approve').textContent=demo?'Try this schedule':'Approve these posts';$('#approve').disabled=running||!selected.length;$('#cadence').disabled=running;$('#consent').disabled=running;$('#disclosure').disabled=running;
}
async function loadAccount(){
  try{account=await api('/api/account');csrf=account.csrf;demo=false;$('#account-label').textContent=`Connected as @${account.username}`;$('#connect-note').textContent='Choose the posts below. You can pause or disconnect whenever you want.';$('#connect').classList.add('hidden');$('#disconnect').classList.remove('hidden');$('#cadence').value=String(account.cadenceHours);selected=account.entries.slice(account.cursor).map(e=>({id:e.factId,postText:e.text.startsWith(disclosure)?e.text.slice(disclosure.length):e.text}));running=account.status==='active';$('#pause').disabled=!running;$('#queue-result').textContent=running?`Queue active. Next post: ${new Date(account.nextDueAt).toLocaleString()}.`:`Queue ${account.status}. Review and approve a new batch to start.`;renderQueue();renderLibrary();}catch{/* An anonymous visitor is expected in the preview. */}
}
$('#search').addEventListener('input',renderLibrary);$('#review-filter').addEventListener('change',renderLibrary);
$('#try-demo').addEventListener('click',()=>{if(account){notice('You’re connected to Threads. Disconnect before trying the sample account.');return;}demo=true;selected=samples.map(s=>({...s}));invalidate();renderQueue();$('#account-label').textContent='Demo account: @your-demo-account';$('#queue').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
$('#cadence').addEventListener('change',()=>{invalidate();const hours=Number($('#cadence').value);$('#cadence-note').textContent=hours===1?'Hourly means up to 24 posts a day. Posting stops when this list runs out.':`The first post goes out ${hours} hours after you approve. The rest follow at the same interval.`;});
$('#approve').addEventListener('click',async()=>{
  if(!selected.length||!$('#consent').checked||!$('#disclosure').checked){notice('Read the posts and check both boxes before continuing.');return;}
  const hours=Number($('#cadence').value);
  if(demo){running=true;const now=Date.now();$('#queue-result').textContent=`Here’s the schedule for @your-demo-account. These are sample times; nothing will be posted.\n${selected.map((p,i)=>`${i+1}. ${new Date(now+(i+1)*hours*3600000).toLocaleString()}`).join('\n')}\nThat’s the whole list. Adding more posts takes another approval.`;$('#pause').disabled=false;renderQueue();return;}
  $('#approve').disabled=true;
  try{await api('/api/approve','POST',{factIds:selected.map(f=>f.id),libraryVersion:version,cadenceHours:hours,consent:true,disclosureAccepted:true});await loadAccount();}catch(error){notice(error.message);$('#approve').disabled=false;}
});
$('#pause').addEventListener('click',async()=>{try{if(!demo)await api('/api/pause','POST',{});running=false;$('#pause').disabled=true;$('#queue-result').textContent=demo?'Demo paused. Nothing was posted.':'Posting is paused. A post already being sent to Threads can still appear.';renderQueue();renderLibrary();}catch(error){notice(error.message);}});
$('#connect').addEventListener('click',async()=>{try{const result=await api('/oauth/start','POST',{});const url=new URL(result.url);if(url.origin!=='https://www.threads.com')throw Error('Unexpected connection URL');location.assign(url.href);}catch(error){notice(error.message);}});
$('#disconnect').addEventListener('click',async()=>{if(!confirm('Delete your connection, locally stored token, schedule, approvals, and activity? Revoke the provider grant separately in Threads settings. A request already sent may still finish.'))return;try{const result=await api('/api/account','DELETE');notice(result.note);account=null;csrf='';demo=true;running=false;selected=[];$('#account-label').textContent='Disconnected';$('#connect-note').textContent=result.note;$('#disconnect').classList.add('hidden');$('#connect').classList.remove('hidden');invalidate();renderQueue();renderLibrary();}catch(error){notice(error.message);}});
async function init(){
  try{const response=await fetch('/facts.json');if(!response.ok)throw Error();const data=await response.json();facts=data.facts;version=data.version;}catch{notice('The facts didn’t load. Reload the page or read them on GitHub.');}
  renderLibrary();renderQueue();
  // Static Cloudflare Pages preview deliberately has no OAuth backend.
  try{const response=await fetch('/api/status',{headers:{Accept:'application/json'}});if(response.headers.get('content-type')?.includes('application/json')){const status=await response.json();if(status.mode==='connected'){$('#mode-label').textContent=status.publishingEnabled?'Threads sign-in is open. You still approve every schedule.':'You can connect Threads. Posting is paused.';$('#connect').disabled=false;$('#connect').textContent='Connect my Threads account';await loadAccount();}}}catch{/* Static preview remains usable offline from the API. */}
}
init();
