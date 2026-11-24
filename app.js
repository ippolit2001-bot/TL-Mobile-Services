import {STAY,GROUPS,STARTS,SERVICES,newDraft,initialState,defaultAccount,listServices,stayDates,dateReason,availability,isSlotAvailable,capacity,updateDraft,reconcileResources,basePrice,total,duration,endTime,validate,commitService} from './model.js';

const $=s=>document.querySelector(s),content=$('#app-content'),header=$('#app-header'),footer=$('#app-footer');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const money=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' RUB';
const dateText=d=>d?new Date(d+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}).replace(' г.',''):'';
const storageKey='tl-mobile-section-48181-v2';
function readState(){try{const s=JSON.parse(localStorage.getItem(storageKey));if(s?.schema===2&&s.data&&Array.isArray(s.data.items)&&Array.isArray(s.data.accounts)&&Array.isArray(s.data.requests)&&Array.isArray(s.data.external)&&s.data.accounts.every(a=>typeof a.id==='string'&&typeof a.label==='string')&&s.data.items.every(i=>typeof i.title==='string'&&Number.isFinite(i.price)&&(!i.draft||SERVICES[i.draft.service])))return s.data;}catch{}return initialState();}
let state=readState(),page='list',draft=newDraft(),picker=null,editingId=null,editingSnapshot='',editConflict=false,detailId=null,formScroll=0,requestId='',busy=false,savedResult=false,conflictMessage='',simulateConflict=false,toastTimer;
function reservations(){return [...state.items.filter(i=>i.id!==editingId),...state.external];}
function saveState(){try{localStorage.setItem(storageKey,JSON.stringify({schema:2,data:state}));return true;}catch{$('#storage-status').textContent='Сохранение доступно только в текущем сеансе';return false;}}
function notify(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function setPage(next,scroll=0){page=next;render();content.scrollTop=scroll;}
function appHeader(title){header.innerHTML=`<button class="back-button" data-action="back" aria-label="Назад" ${busy?'disabled':''}><img src="assets/back.svg" width="24" height="24" alt=""></button><h2>${esc(title)}</h2>`;}
const primary=(label,action,disabled=false)=>`<button class="primary" data-action="${action}" ${disabled?'disabled':''}>${esc(label)}</button>`;
function getErrors(){return {...validate(draft,reservations(),state.accounts),...(editConflict?{edit:'Услуга изменена в другом окне'}:{})};}
function accountLabel(){return state.accounts.find(a=>a.id===draft.account)?.label||({'new-room':'Новый счёт номера','new-general':'Новый общий счёт брони'})[draft.account]||'Не выбран';}
function field(key,label,value,{read=false,grey=false,help='',disabled=false,noArrow=false,empty='Не выбрано'}={}){
 const cls=`field ${read?'plain':'clickable'} ${grey?'grey':''} ${!value&&value!==0?'empty':''}`;
 const inner=`<span class="field-label">${esc(label)}</span><span class="field-value">${esc(value||empty)}</span>${!read&&!noArrow?'<img class="field-arrow" src="assets/caret.svg" width="24" height="24" alt="">':''}`;
 return `<div class="field-wrap" data-field="${key}">${read?`<div class="${cls}" aria-label="${esc(label)}">${inner}</div>`:`<button type="button" class="${cls}" data-picker="${key}" aria-label="${esc(label)}" ${disabled?'disabled':''}>${inner}</button>`}${help?`<p class="helper">${esc(help)}</p>`:''}</div>`;
}
const title=t=>`<h3 class="section-title">${esc(t)}</h3>`;
function renderForm(){
 appHeader(editingId?'Изменение услуги':'Добавление услуги');
 const s=SERVICES[draft.service],a=availability(draft,reservations()),scheduled=Boolean(draft.start),slot=isSlotAvailable(draft,reservations());
 let html=field('group','Группа услуг',draft.group==='uncategorized'?'Без категории':draft.group,{empty:'Не выбрано'})+field('service','Услуга',s?.title,{empty:'Не выбрана'});
 if(s){
  html+=title('Дата и время')+field('date','Дата оказания услуги',dateText(draft.date),{empty:'Не выбрана',help:'23–29 ноября включительно. В день выезда доступно время после 12:00.'});
  html+=field('start','Начало',draft.start,{disabled:!draft.date,empty:'Не выбрано'});
  const canExtend=s.extend&&scheduled&&[15,30].some(extension=>isSlotAvailable({...draft,extension},reservations()));
  html+=field('extension','Окончание',endTime(draft)+(draft.extension?` (+${money(draft.extension/15*500)})`:''),{read:!canExtend,grey:!canExtend,empty:'—'});
  html+=`<p class="helper">Длительность: ${duration(draft)} минут</p>`;
  if(scheduled){
   if(conflictMessage)html+=`<p class="conflict-note" role="alert">${esc(conflictMessage)}</p>`;
   if(!slot&&!conflictMessage)html+='<p class="helper availability-error">На выбранный интервал нет свободных ресурсов. Выберите другое время.</p>';
   if(s.staff||s.place||s.inventory)html+=title('Ресурсы');
   if(s.staff)html+=field('staff','Сотрудник',draft.staff,{read:a.staff.length<=1,grey:a.staff.length<=1,empty:'Не выбран',help:a.staff.length===1?'Единственный свободный сотрудник выбран автоматически':''});
   if(s.place)html+=field('place','Место',draft.place,{read:a.places.length<=1,grey:a.places.length<=1,empty:'Не выбрано',help:a.places.length===1?'Единственное свободное место выбрано автоматически':''});
   if(s.inventory)html+=field('inventory','Инвентарь',draft.inventory.join(', '),{read:a.inventory.length<=1,grey:a.inventory.length<=1,empty:'Не выбран',help:a.inventory.length===1?'Единственный свободный инвентарь выбран автоматически':''});
   if(s.age)html+=title('Возраст гостя')+field('age','Возраст',draft.age==='adult'?'Взрослый':draft.age==='child'?'Ребёнок (2–10 лет)':'',{empty:'Не выбран'});
   html+=title('Количество и цена')+field('quantity','Количество',draft.quantity,{read:!!s.fixedQuantity||capacity(draft,reservations())<=1,grey:!!s.fixedQuantity,noArrow:true,help:s.includedGuests?'Включено 4 гостя':`Доступная вместимость: ${capacity(draft,reservations())}`});
   html+=field('price','Цена (RUB)',new Intl.NumberFormat('ru-RU').format(basePrice(draft)),{read:true});
   if(s.includedGuests)html+=field('extra','Дополнительные гости',String(draft.extra),{help:'До 2 дополнительных гостей · 500 RUB за гостя'});
   html+=title('Детали начисления')+field('account','Счёт',accountLabel(),{help:'Иванов Иван Иванович'});
   if(draft.account==='new-room'||draft.account==='new-general')html+=`<p class="helper">${draft.account==='new-room'?'Счёт текущего номера «101»':'Общий счёт брони без привязки к номеру'} будет создан при добавлении услуги.</p>`;
   html+=`<div class="field-wrap"><label class="field plain" for="comment"><span class="field-label">Комментарий</span><textarea id="comment" name="comment" aria-label="Комментарий" maxlength="255" rows="2">${esc(draft.comment)}</textarea></label><p id="comment-count" class="helper">Необязательно · ${draft.comment.length} / 255 символов</p></div>`;
  }else html+='<p class="helper">После выбора даты и времени появятся доступные ресурсы и параметры услуги.</p>';
 }else html+='<p class="helper">Группа необязательна. Без группы доступны все почасовые услуги.</p>';
 content.innerHTML=`<form class="form-body" id="service-form" novalidate>${html}</form>`;
 const comment=$('#comment');if(comment)comment.style.height=Math.max(48,comment.scrollHeight)+'px';
}
function bookingHead(){return `<div class="booking-head"><h3>Услуги в номере</h3><p class="booking-meta">Бронь № 4136985 · Иванов Иван Иванович<br>«101» Комфорт · 2 гостя<br>23–29 ноября 2026 · выезд в 12:00</p></div>`;}
function renderList(){appHeader('Услуги в номере');content.innerHTML=bookingHead()+`<div class="service-list">${state.items.map(i=>`<button class="service-row" data-detail="${esc(i.id)}"><span class="service-main">${esc(i.title)}${i.draft?`<small>${dateText(i.draft.date)} · ${i.draft.start}–${endTime(i.draft)}<br>${esc(i.account)} · ${i.draft.quantity} шт.</small>`:''}</span><span class="service-price">${money(i.price)}</span></button>`).join('')}</div><button class="text-action list-add" data-action="add"><img src="assets/add.svg" width="18" height="18" alt="">Добавить услугу</button>`;}
function renderType(){appHeader('Тип услуги');content.innerHTML=`<div class="picker-body"><h3 class="picker-heading">Выберите тип услуги</h3>${option({value:'general',label:'Общая услуга или услуга питания'},false)}${option({value:'hourly',label:'Почасовая'},false)}<p class="picker-help">Для услуг с фиксированной длительностью: баня, массаж, прокат.</p></div>`;}
function option(o,selected,multiple=false){return `<button class="option ${selected?'selected':''} ${multiple?'multiple':''}" data-option="${esc(o.value)}" ${o.disabled?'disabled':''} aria-pressed="${selected}"><span class="option-main">${esc(o.label)}${o.description?`<small>${esc(o.description)}</small>`:''}</span>${o.side?`<span class="option-side">${esc(o.side)}</span>`:''}<span class="radio" aria-hidden="true"></span></button>`;}
function pickerOptions(key){
 const s=SERVICES[draft.service],a=availability(draft,reservations());let name='',help='',options=[],selected=draft[key],multiple=false;
 if(key==='group'){name='Группа услуг';options=[{value:'',label:'Не выбрано',side:'Все услуги'},{value:'uncategorized',label:'Без категории',side:'Без группы'},...GROUPS.map(value=>({value,label:value,side:listServices(value).length+(listServices(value).length===1?' услуга':' услуги')}))];help='Выбор группы необязателен. Без выбора отображаются все почасовые услуги.';}
 if(key==='service'){name=draft.group==='uncategorized'?'Без категории':draft.group||'Все почасовые услуги';options=listServices(draft.group).map(([value,s])=>({value,label:s.title,side:money(s.price)}));help=draft.group?'Показаны только услуги выбранной группы.':'Группа не выбрана: показаны услуги всех групп и без категории.';}
 if(key==='start'){name='Начало оказания';options=STARTS.map(value=>{const d={...draft,start:value,extension:0},r=availability(d,reservations()),free=isSlotAvailable(d,reservations());return {value,label:value,disabled:!free,side:free?s.staff&&s.place?`${r.staff.length} ${r.staff.length===1?'сотрудник':'сотрудника'} · ${r.places.length} ${r.places.length===1?'место':'места'}`:s.inventory?`${r.inventory.length} ед. инвентаря`:'Свободно':'Занято'};});help=dateText(draft.date)+' · 10:00–18:00.';}
 if(key==='extension'){name='Окончание и продление';selected=String(draft.extension);options=[0,15,30].map(n=>({value:String(n),label:endTime({...draft,extension:n}),side:n?'+'+money(n/15*500):'Без доплаты',disabled:!isSlotAvailable({...draft,extension:n},reservations())}));help='Доступность ресурсов проверяется на всю длительность услуги.';}
 if(key==='staff'){name='Выбор сотрудника';options=a.staff.map(value=>({value,label:value}));}
 if(key==='place'){name='Выбор места';options=a.places.map(value=>({value,label:value}));}
 if(key==='inventory'){name='Инвентарь';multiple=draft.service==='bikes';selected=multiple?[...draft.inventory]:draft.inventory[0]||'';options=a.inventory.map(value=>({value,label:value}));help=multiple?'Выберите одну или несколько свободных единиц инвентаря.':'';}
 if(key==='age'){name='Возраст гостя';options=[{value:'adult',label:'Взрослый'},{value:'child',label:'Ребёнок (2–10 лет)'}];}
 if(key==='quantity'){name='Количество';selected=String(draft.quantity);options=Array.from({length:capacity(draft,reservations())},(_,i)=>({value:String(i+1),label:String(i+1)}));help='Количество не зависит от двух проживающих по брони и ограничено свободной вместимостью.';}
 if(key==='extra'){name='Дополнительные гости';selected=String(draft.extra);options=Array.from({length:s.maxExtra+1},(_,i)=>({value:String(i),label:String(i),side:i?'+'+money(i*s.extraPrice):'Без доплаты'}));help='Включено 4 гостя. Общая вместимость — 6.';}
 if(key==='account'){name='Выбор счёта';options=state.accounts.map(a=>({value:a.id,label:a.label}));options.push({value:'new-room',label:'Добавить в новый счёт',description:'Новый индивидуальный счёт текущего номера'});if(!state.accounts.some(a=>a.room===null))options.push({value:'new-general',label:'Новый общий счёт брони'});help=state.accounts.some(a=>a.room===null)?'Общий счёт уже существует. Действие «Новый общий счёт брони» не показывается.':'Новый счёт и начисление будут созданы вместе при добавлении услуги.';}
 return {key,name,help,options,selected,multiple};
}
function openPicker(key){
 if(busy)return;if(page==='form')formScroll=content.scrollTop;
 const a=availability(draft,reservations());if(['staff','place','inventory'].includes(key)&&a[key==='place'?'places':key].length<=1)return;
 if(key==='date'){const selected=!dateReason(draft.service,draft.date,reservations())?draft.date:stayDates().find(d=>!dateReason(draft.service,d,reservations()))||'';picker={key,name:'Дата оказания услуги',selected};}
 else picker=pickerOptions(key);setPage('picker');
}
function renderPicker(){appHeader(picker.name);if(picker.key==='date'){renderCalendar();return;}content.innerHTML=`<div class="picker-body ${picker.key==='start'?'compact':''}"><h3 class="picker-heading">${esc(picker.name)}</h3>${picker.options.map(o=>option(o,Array.isArray(picker.selected)?picker.selected.includes(o.value):picker.selected===o.value,picker.multiple)).join('')}${picker.help?`<p class="picker-help">${esc(picker.help)}</p>`:''}</div>`;}
function renderCalendar(){const offset=6;content.innerHTML=`<div class="calendar"><h3>Ноябрь 2026</h3><div class="calendar-grid">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(s=>`<span class="weekday">${s}</span>`).join('')}${'<span></span>'.repeat(offset)}${Array.from({length:30},(_,i)=>{const day=i+1,date='2026-11-'+String(day).padStart(2,'0'),reason=dateReason(draft.service,date,reservations());return `<button class="day ${reason?reason==='Нет свободных слотов'?'busy':'unavailable':'free'} ${date===picker.selected?'selected':''}" data-date="${date}" aria-label="${day} ноября 2026${reason?' — '+reason:''}" aria-pressed="${date===picker.selected}" ${reason?'disabled':''}>${day}</button>`;}).join('')}</div><p class="calendar-help">Проживание: 23–29 ноября включительно.\n23 ноября — прошлая дата. На 24–26 ноября продажи закрыты. 28 ноября нет свободных слотов.\nВ день выезда 29 ноября можно выбрать время после 12:00.</p></div>`;}
function chooseOption(value){
 if(page==='type'){if(value==='hourly')openForm();else setPage('general');return;}
 if(page!=='picker')return;const o=picker.options.find(o=>o.value===value);if(!o||o.disabled)return;
 if(picker.multiple){picker.selected=picker.selected.includes(value)?picker.selected.filter(v=>v!==value):[...picker.selected,value];render();return;}
 const key=picker.key;let v=value;if(['extension','quantity','extra'].includes(key))v=Number(value);if(key==='inventory')v=[value];draft=updateDraft(draft,key,v,reservations());conflictMessage=editConflict?'Услуга изменена или удалена в другом окне. Откройте её заново.':'';
 if(key==='group'){picker=pickerOptions('service');render();return;}
 if(key==='staff'&&!draft.place&&SERVICES[draft.service].place&&availability(draft,reservations()).places.length>1){picker=pickerOptions('place');render();return;}
 setPage('form',['service','group'].includes(key)?0:formScroll);
}
function renderBooking(){appHeader('Детали бронирования');content.innerHTML=`<div class="detail-body"><h3>Иванов Иван Иванович</h3><p class="booking-meta">Бронь № 4136985\n«101» Комфорт · 2 гостя\n23–29 ноября 2026 · выезд в 12:00</p><button class="service-row" data-action="modify"><span>Модификация брони</span></button><button class="service-row" data-action="list"><span>Услуги в номере<small>${state.items.length} услуги · ${money(state.items.reduce((n,i)=>n+i.price,0))}</small></span></button></div>`;}
function renderModify(){appHeader('Модификация брони');content.innerHTML=`<div class="detail-body"><p class="booking-meta">«101» Комфорт · 23–29 ноября 2026</p><button class="service-row" data-action="list">Услуги в номере</button></div>`;}
function renderGeneral(){appHeader('Общие услуги и питание');content.innerHTML=`<div class="picker-body"><h3 class="picker-heading">Услуги в номере</h3>${state.items.filter(i=>!i.draft).map(i=>`<button class="service-row" data-detail="${i.id}"><span class="service-main">${esc(i.title)}</span><span class="service-price">${money(i.price)}</span></button>`).join('')}</div>`;}
function renderDetail(){const i=state.items.find(i=>i.id===detailId);if(!i){setPage('list');return;}appHeader('Детали услуги');const d=i.draft;const pair=(a,b)=>`<div class="detail-pair"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`;content.innerHTML=`<div class="detail-body"><h3>${esc(i.title)}</h3>${d?`${pair('Дата',dateText(d.date))}${pair('Время',d.start+'–'+endTime(d))}${pair('Длительность',duration(d)+' минут')}${d.staff?pair('Сотрудник',d.staff):''}${d.place?pair('Место',d.place):''}${d.inventory.length?pair('Инвентарь',d.inventory.join(', ')):''}${d.age?pair('Возраст',d.age==='child'?'Ребёнок (2–10 лет)':'Взрослый'):''}${pair('Количество',d.quantity)}${pair('Цена',money(basePrice(d)))}${pair('Счёт',i.account)}${d.comment?pair('Комментарий',d.comment):''}${primary('Изменить услугу','edit')}`:''}${pair('Стоимость',money(i.price))}<button class="danger-button" data-action="delete">Удалить услугу</button></div>`;}
function renderFooter(){
 let html='',price=total(draft,reservations());
 const sum=state.items.reduce((n,i)=>n+i.price,0),costRow=n=>`<div class="total-row"><span>${page==='list'&&savedResult?'Сумма за услуги':'Стоимость'}</span><strong>${money(n)}</strong></div>`;
 if(page==='form')html=costRow(price)+primary(busy?'Добавляем…':editingId?'Сохранить изменения':'Добавить услугу','submit',busy||Object.keys(getErrors()).length>0);
 else if(page==='list')html=costRow(sum)+primary(savedResult?'Готово':'Применить',savedResult?'booking':'apply');
 else if(page==='picker'){
  if(picker.key==='date')html=primary(picker.selected?'Выбрать '+dateText(picker.selected).replace(' 2026',''):'Нет свободных дат','confirm-date',!picker.selected);
  else if(picker.multiple)html=costRow(price)+primary('Выбрать '+(picker.selected.length||'инвентарь'),'confirm-inventory',!picker.selected.length);
  else html=(!['group','service','age'].includes(picker.key)&&draft.start?costRow(price):'')+primary('Отменить','cancel-picker');
 }else if(page==='type'||page==='general')html=primary('Отменить','list');
 else if(page==='detail'){const i=state.items.find(i=>i.id===detailId);html=costRow(i?.price||0)+primary('Готово','list');}
 else html=primary('Услуги в номере','list');footer.innerHTML=html;
}
function renderProgress(){const labels=['Услуги в бронировании','Тип и выбор услуги','Дата и время','Ресурсы и параметры','Счёт и комментарий','Услуга добавлена'];let active=page==='list'?savedResult?5:0:page==='type'?1:!draft.service?1:!draft.start?2:Object.keys(getErrors()).some(k=>['staff','place','inventory','age'].includes(k))?3:4;$('#progress').innerHTML=labels.map((l,i)=>`<li class="${i===active?'active':i<active?'done':''}">${l}</li>`).join('');}
function render(){if(page==='form')renderForm();else if(page==='picker')renderPicker();else if(page==='type')renderType();else if(page==='detail')renderDetail();else if(page==='booking')renderBooking();else if(page==='modify')renderModify();else if(page==='general')renderGeneral();else renderList();renderFooter();renderProgress();}
function openForm(service=''){draft=newDraft();draft.account=defaultAccount(state.accounts);if(service)draft=updateDraft(draft,'service',service);editingId=null;editingSnapshot='';editConflict=false;requestId=crypto.randomUUID();conflictMessage='';formScroll=0;setPage('form');}
function back(){if(busy)return;if(page==='picker'){setPage('form',formScroll);picker=null;}else if(page==='form'){editingId=null;conflictMessage='';setPage('list');}else if(page==='type'||page==='detail'||page==='general')setPage('list');else if(page==='modify')setPage('booking');else if(page==='booking')setPage('list');else setPage('booking');}
async function submit(){
 if(busy||Object.keys(getErrors()).length)return;formScroll=content.scrollTop;busy=true;renderFooter();header.querySelector('button').disabled=true;
 await new Promise(resolve=>setTimeout(resolve,350));let latest=readState();if(latest.version<state.version)latest=structuredClone(state);
 if(simulateConflict){latest.external.push({draft:structuredClone(draft)});simulateConflict=false;}
 const result=commitService(latest,draft,requestId,editingId?{id:editingId,expected:editingSnapshot}:null);busy=false;
 if(!result.ok){state=latest;saveState();editConflict=Boolean(result.errors.edit);if(!editConflict)draft=reconcileResources(draft,reservations());conflictMessage=result.errors.edit||'Доступность изменилась. Доступные ресурсы обновлены. Проверьте параметры и повторите добавление или выберите другое время.';setPage('form',formScroll);notify(editConflict?'Откройте актуальную услугу из списка':'Услуга не добавлена: проверьте доступность');return;}
 state=result.state;const persisted=saveState();editingId=null;savedResult=true;setPage('list');notify(persisted?'Услуга добавлена в бронирование':'Услуга добавлена в текущем сеансе');
}
function confirmAction(title,text,label,callback){const dialog=$('#confirm');dialog.innerHTML=`<h3 id="confirm-title">${esc(title)}</h3><p>${esc(text)}</p><div class="confirm-actions"><button data-confirm="cancel">Отменить</button><button data-confirm="yes">${esc(label)}</button></div>`;dialog.onclick=e=>{const b=e.target.closest('[data-confirm]');if(!b)return;dialog.close();if(b.dataset.confirm==='yes')callback();};dialog.showModal();}
function demo(kind){
 if(kind==='main'){editingId=null;setPage('list');return;}
 if(kind==='conflict'){simulateConflict=true;notify('При следующем добавлении будет проверен конфликт доступности');return;}
 openForm('steam');draft=updateDraft(draft,'date',kind==='departure'?'2026-11-29':'2026-11-27',reservations());draft=updateDraft(draft,'start',kind==='departure'?'17:00':'11:00',reservations());draft={...draft,staff:'Петров В.И.',place:'Парная №2',inventory:['Веник'],age:'child'};render();
}
async function run(action){
 if(action==='back')return back();if(busy)return;
 if(action==='add'){savedResult=false;setPage('type');}
 if(action==='list')setPage('list');if(action==='booking')setPage('booking');if(action==='modify')setPage('modify');
 if(action==='home'){editingId=null;setPage('list');}
 if(action==='cancel-picker'){setPage('form',formScroll);picker=null;}
 if(action==='confirm-date'){if(!picker.selected||dateReason(draft.service,picker.selected,reservations()))return;draft=updateDraft(draft,'date',picker.selected,reservations());conflictMessage=editConflict?'Услуга изменена или удалена в другом окне. Откройте её заново.':'';setPage('form',formScroll);picker=null;}
 if(action==='confirm-inventory'){if(!picker.selected.length)return;draft=updateDraft(draft,'inventory',[...picker.selected],reservations());setPage('form',formScroll);picker=null;}
 if(action==='submit')await submit();
 if(action==='apply'){saveState();notify('Изменения применены к бронированию');}
 if(action==='edit'){const i=state.items.find(i=>i.id===detailId);if(!i?.draft)return;draft=structuredClone(i.draft);editingId=i.id;editingSnapshot=JSON.stringify(i);editConflict=false;requestId=crypto.randomUUID();formScroll=0;conflictMessage='';setPage('form');}
 if(action==='delete')confirmAction('Удалить услугу?','Услуга будет удалена из демонстрационного бронирования.','Удалить',()=>{state.items=state.items.filter(i=>i.id!==detailId);state.version++;saveState();setPage('list');notify('Услуга удалена');});
 if(action==='reset')confirmAction('Начать заново?','Добавленные услуги и счета будут сброшены. Останутся завтрак и парковка.','Сбросить',()=>{state=initialState();saveState();draft=newDraft();editingId=null;simulateConflict=false;savedResult=false;setPage('list');});
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||busy)return;if(b.dataset.action)return void run(b.dataset.action);if(b.dataset.picker)return openPicker(b.dataset.picker);if(b.dataset.demo)return demo(b.dataset.demo);if(b.dataset.detail){detailId=b.dataset.detail;setPage('detail');return;}if(b.hasAttribute('data-option'))return chooseOption(b.dataset.option);if(b.dataset.date&&!dateReason(draft.service,b.dataset.date,reservations())){picker.selected=b.dataset.date;render();}});
content.addEventListener('input',e=>{if(e.target.id!=='comment')return;draft=updateDraft(draft,'comment',e.target.value,reservations());if(e.target.value!==draft.comment)e.target.value=draft.comment;$('#comment-count').textContent=`Необязательно · ${draft.comment.length} / 255 символов`;e.target.style.height='auto';e.target.style.height=Math.max(48,e.target.scrollHeight)+'px';renderFooter();});
content.addEventListener('submit',e=>{e.preventDefault();if(page==='form')void submit();});
window.addEventListener('storage',e=>{if(e.key!==storageKey||busy)return;state=readState();if(page==='form'||page==='picker'){const original=editingId?state.items.find(i=>i.id===editingId):null;editConflict=Boolean(editingId&&(!original||JSON.stringify(original)!==editingSnapshot));if(!editConflict)draft=reconcileResources(draft,reservations());conflictMessage=editConflict?'Услуга изменена или удалена в другом окне. Откройте её заново.':'Бронирование обновлено в другом окне. Проверьте параметры.';if(page==='picker'&&picker.key!=='date')picker=pickerOptions(picker.key);}const scroll=content.scrollTop;render();content.scrollTop=scroll;});
render();
