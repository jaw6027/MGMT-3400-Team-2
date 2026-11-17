const $ = s => document.querySelector(s);
let state, view = 'overview', filter = 'all', action = 'sales';
const money = cents => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(cents/100);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = p => p.category === 'Drinks' ? '▯' : p.category === 'Sweets' ? '▰' : '▥';
const dateLabel = value => new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const titles = {overview:['A little oversight. A lot less waste.','Keep your machines stocked, your products fresh, and your day moving.'],inventory:['Everything in its place.','Track quantities, expiration dates, and slot capacity across your fleet.'],alerts:['A heads-up before it runs out.','Low stock, upcoming expiration dates, and expired batches that need attention.'],report:['Your next refill, figured out.','A practical pick list to bring every slot back to capacity.'],sales:['Every sale accounted for.','Recorded sales are saved and automatically deducted from inventory.']};
async function load(){
  try {const response=await fetch('/api/inventory');if(!response.ok)throw Error('Unable to load inventory.');state=await response.json();$('#load-error').hidden=true;render();}
  catch(e){$('#load-error').textContent=e.message+' Check the server and refresh to retry.';$('#load-error').hidden=false;}
}
function render(){
  const p=state.products, low=p.filter(x=>x.low_stock), soon=p.filter(x=>x.days_left>=0&&x.days_left<=14&&x.quantity>0), expired=p.filter(x=>x.days_left<0);
  $('#nav-alerts').textContent=p.filter(x=>x.low_stock||x.days_left<=14).length;
  $('#low-count').textContent=low.length;$('#expiry-count').textContent=soon.length;
  $('#date-label').textContent=new Date(state.today+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  $('#stats').innerHTML=[['Total units in stock',p.reduce((a,b)=>a+b.quantity,0),'Across <strong>2 active machines</strong>','▦',''],['Low-stock products',low.length,'At or below their refill threshold','↘','orange'],['Expiring in 14 days',soon.length,`${expired.length} expired batch${expired.length===1?'':'es'} also flagged`,'◷','orange'],["Today’s sales",money(state.today_revenue_cents),`${state.today_units} units sold · recorded sales`,'↗','']].map(([label,value,note,symbol,cls])=>`<article class="stat ${cls}"><div class="stat-top">${label}<span class="stat-icon">${symbol}</span></div><div class="stat-value">${value}</div><small>${note}</small></article>`).join('');
  $('#machines').innerHTML=state.machines.map(m=>{
    const items=p.filter(x=>x.machine_id===m.id), qty=items.reduce((s,x)=>s+x.quantity,0), cap=items.reduce((s,x)=>s+x.capacity,0), percent=Math.round(qty/cap*100);
    return `<article class="machine-card"><div class="machine-art" aria-hidden="true"><div class="vending"><div class="vending-window">${'<i></i>'.repeat(9)}</div></div></div><div class="machine-details"><div class="machine-title"><span class="machine-id">MACHINE 0${m.id}</span><span class="status">● Active</span></div><h3>${escape(m.name)}</h3><div class="location">⌖ ${escape(m.location)}</div><div class="fill-label"><span>Stock capacity</span><strong>${qty} / ${cap} units · ${percent}%</strong></div><div class="progress"><span style="width:${percent}%"></span></div><div class="machine-flags"><span>◌ ${items.filter(x=>x.low_stock).length} low stock</span><span>◷ ${items.filter(x=>x.days_left<=14).length} expiration alerts</span></div></div><button class="machine-link" data-machine="${m.id}" aria-label="View ${escape(m.name)} inventory">↗</button></article>`;
  }).join('');
  const selected=$('#machine-filter').value;
  $('#machine-filter').innerHTML='<option value="all">All machines</option>'+state.machines.map(m=>`<option value="${m.id}">${escape(m.name)}</option>`).join('');
  $('#machine-filter').value=selected||'all';
  renderTable();
}
function visibleProducts(){return state.products.filter(p=>(view!=='alerts'||p.low_stock||p.days_left<=14)&&(filter!=='low'||p.low_stock)&&(filter!=='expiring'||p.days_left>=0&&p.days_left<=14&&p.quantity>0)&&($('#machine-filter').value==='all'||p.machine_id===Number($('#machine-filter').value))&&p.name.toLowerCase().includes($('#search').value.toLowerCase()));}
function renderTable(){
  const products=visibleProducts(), report=view==='report', sales=view==='sales';
  $('#overview-content').hidden=view!=='overview';
  $('#table-title').textContent=report?'Restocking pick list':sales?'Recent sales':view==='alerts'?'Products needing attention':'Inventory overview';
  $('#table-subtitle').textContent=report?'Refill to capacity. Replace expired batches; rotate near-expiry stock first.':sales?'Most recent 50 sales. All amounts are in USD.':'Every product, in the right place.';
  $('.filter-tabs').hidden=sales;
  $('#table-head').innerHTML='<tr>'+(sales?['Product','Machine','Quantity','Total','Recorded at']:report?['Product','Machine','On hand','Add units','Priority','Action']:['Product','Machine / slot','Stock level','Expiration date','Status','']).map(x=>`<th scope="col">${x}</th>`).join('')+'</tr>';
  let rows;
  if(sales){rows=state.sales.filter(s=>($('#machine-filter').value==='all'||state.products.find(p=>p.id===s.product_id).machine_id===Number($('#machine-filter').value))&&s.product_name.toLowerCase().includes($('#search').value.toLowerCase()));$('#table-body').innerHTML=rows.map(s=>`<tr><td><strong>${escape(s.product_name)}</strong></td><td>${escape(s.machine_name)}</td><td>${s.quantity}</td><td>${money(s.total_cents)}</td><td>${escape(new Date(s.recorded_at).toLocaleString())}</td></tr>`).join('');}
  else {rows=products.filter(p=>!report||p.restock_needed>0||p.days_left<=14);$('#table-body').innerHTML=rows.map(p=>{
    const expired=p.days_left<0, soon=p.days_left<=14, badge=expired?'<span class="badge danger">Expired</span>':p.low_stock?'<span class="badge warn">Low stock</span>':soon?'<span class="badge warn">Expiring soon</span>':'<span class="badge">In stock</span>';
    const product=`<td><div class="product-cell"><span class="product-icon ${p.category.toLowerCase()}">${icon(p)}</span><div><strong>${escape(p.name)}</strong><small>${escape(p.category)} · ${money(p.price_cents)}</small></div></div></td>`;
    const button=`<button class="row-action" data-product="${p.id}" data-action="${expired?'replace':'restock'}">${expired?'Replace batch':'Restock'}</button>`;
    return report?`<tr>${product}<td>${escape(p.machine_name)} <span class="slot">${p.slot}</span></td><td>${p.quantity} / ${p.capacity}</td><td class="quantity">+${expired?p.capacity:p.restock_needed}</td><td>${badge}${soon?' <span class="expiry-soon">'+(expired?'Replace expired batch':'Rotate first')+'</span>':''}</td><td>${button}</td></tr>`:`<tr>${product}<td>${escape(p.machine_name)} <span class="slot">${p.slot}</span></td><td><span class="quantity ${p.low_stock?'warn':''}">${p.quantity}</span> / ${p.capacity}<div class="mini-track"><i class="${p.low_stock?'warn':''}" style="width:${p.quantity/p.capacity*100}%"></i></div></td><td class="${expired?'expired':soon?'expiry-soon':''}">${dateLabel(p.expires)}${soon?`<br><small>${expired?Math.abs(p.days_left)+' days overdue':p.days_left===0?'Expires today':p.days_left+' days left'}</small>`:''}</td><td>${badge}</td><td>${button}</td></tr>`;
  }).join('');}
  if(!rows.length)$('#table-body').innerHTML=`<tr><td colspan="6" class="empty">${sales?'No sales recorded yet. Record a sale to start tracking activity.':'No products match these filters.'}</td></tr>`;
  $('#row-count').textContent=`Showing ${rows.length} ${sales?'recorded sales':'products'}${report?' · '+rows.reduce((s,p)=>s+(p.days_left<0?p.capacity:p.restock_needed),0)+' units to add':''}`;
}
function changeView(next){view=next;filter='all';$('#search').value='';$('#machine-filter').value='all';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='all'));$('#crumb').textContent=$(`[data-view="${view}"]`).textContent.replace(/[^a-zA-Z ]/g,'').trim();$('#page-title').textContent=titles[view][0];$('#page-description').textContent=titles[view][1];renderTable();}
function openTransaction(type,id){
  if(!state)return;action=type;$('#form-error').textContent='';const replace=type==='replace',sale=type==='sales';
  $('#dialog-title').textContent=sale?'Record a sale':replace?'Replace a batch':'Restock a product';
  $('#dialog-help').textContent=sale?'Sales automatically deduct from the selected machine’s inventory.':replace?'Remove the entire old batch first. This replaces its quantity and expiration date.':'Add units from the same batch. For a different expiration date, replace the batch instead.';
  $('#submit-transaction').textContent=sale?'Record sale':replace?'Replace batch':'Add stock';
  $('#product-select').innerHTML=state.products.map(p=>`<option value="${p.id}">${escape(p.machine_name)} · ${p.slot} · ${escape(p.name)} (${p.quantity} left)</option>`).join('');
  if(id)$('#product-select').value=id;
  $('#expires-label').hidden=!replace;$('#expires').required=replace;$('#expires').min=state.today;$('#expires').value='';$('#quantity').value=1;
  let replaceButton=$('#replace-switch');
  if(!replaceButton){replaceButton=document.createElement('button');replaceButton.id='replace-switch';replaceButton.type='button';replaceButton.className='secondary';replaceButton.textContent='Replace entire batch instead';replaceButton.style.marginTop='12px';$('#dialog-help').after(replaceButton);replaceButton.onclick=()=>{const id=Number($('#product-select').value);$('#transaction-dialog').close();openTransaction('replace',id);};}
  replaceButton.hidden=sale||replace;
  updateQuantity();$('#transaction-dialog').showModal();
}
function updateQuantity(){const p=state.products.find(p=>p.id===Number($('#product-select').value));$('#quantity').max=action==='sales'?p.quantity:action==='replace'?p.capacity:p.capacity-p.quantity;}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>changeView(b.dataset.view));
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));renderTable();});
$('#search').oninput=renderTable;$('#machine-filter').onchange=renderTable;
$('#record-sale').onclick=()=>openTransaction('sales');$('#export').onclick=()=>{window.location.href='/api/restock.csv';};
document.addEventListener('click',e=>{const product=e.target.closest('[data-product]'),machine=e.target.closest('[data-machine]');if(product)openTransaction(product.dataset.action,Number(product.dataset.product));if(machine){changeView('inventory');$('#machine-filter').value=machine.dataset.machine;renderTable();$('.inventory-section').scrollIntoView({behavior:'smooth'});}});
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>$('#transaction-dialog').close());
$('#product-select').onchange=updateQuantity;
$('#transaction-form').onsubmit=async e=>{e.preventDefault();const button=$('#submit-transaction');button.disabled=true;$('#form-error').textContent='';try{const response=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:Number($('#product-select').value),quantity:Number($('#quantity').value),expires:$('#expires').value})});const data=await response.json();if(!response.ok)throw Error(data.error);state=data;render();$('#transaction-dialog').close();$('#toast').textContent=action==='sales'?'Sale recorded. Inventory updated.':action==='replace'?'Batch replaced. Expiration date updated.':'Stock added. Inventory updated.';$('#toast').hidden=false;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}catch(error){$('#form-error').textContent=error.message;}finally{button.disabled=false;}};
load();
