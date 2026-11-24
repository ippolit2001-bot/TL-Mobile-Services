export const STAY={arrival:'2026-11-23',departure:'2026-11-29',departureTime:'12:00',today:'2026-11-24',room:'101',guests:2};
export const GROUPS=['Бани и СПА','Массаж','Аренда'];
export const STARTS=['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
export const SERVICES={
 steam:{title:'Аренда парной',group:'Бани и СПА',duration:45,price:1500,staff:true,place:true,inventory:true,age:true,capacity:3,leadDays:3},
 'steam-extended':{title:'Парная с продлением',group:'Бани и СПА',duration:45,price:1500,staff:true,place:true,inventory:true,age:true,capacity:3,leadDays:3,extend:true},
 spa:{title:'СПА + сауна',group:'Бани и СПА',duration:60,price:2250,staff:true,place:true,capacity:2,leadDays:3},
 sauna:{title:'Сауна',group:'Бани и СПА',duration:60,price:2000,place:true,capacity:3,leadDays:3},
 pool:{title:'Плавание (1 час)',group:'',duration:60,price:1500,childPrice:750,staff:true,age:true,capacity:4,leadDays:3},
 bikes:{title:'Аренда велосипеда',group:'Аренда',duration:60,price:500,inventory:true,capacity:3,leadDays:3},
 gazebo:{title:'Аренда беседки',group:'Аренда',duration:60,price:5000,place:true,capacity:1,fixedQuantity:true,includedGuests:4,maxExtra:2,extraPrice:500,leadDays:3},
 massage:{title:'Массаж спины',group:'Массаж',duration:45,price:2000,staff:true,capacity:1,fixedQuantity:true,leadDays:3}
};
const RESOURCE={staff:['Архипов М.А.','Петров В.И.'],places:['Парная №1','Парная №2'],bikes:['Велосипед №1','Велосипед №2','Велосипед №3'],inventory:['Веник','Полотенце']};
const minutes=t=>/^\d{2}:\d{2}$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const listServices=group=>Object.entries(SERVICES).filter(([,s])=>!group||s.group===(group==='uncategorized'?'':group));
export const stayDates=()=>Array.from({length:7},(_,i)=>addDays(STAY.arrival,i));
export function newDraft(){return {group:'',service:'',date:'',start:'',staff:'',place:'',inventory:[],age:'',quantity:1,extension:0,extra:0,account:'01',comment:''};}
export function initialState(){return {version:1,accounts:[{id:'01',label:'01 · номер «101»',room:'101'},{id:'02',label:'02 · номер «102»',room:'102'},{id:'general',label:'Общий счёт брони',room:null}],items:[{id:'breakfast',title:'Завтрак (Взрослый)',price:3000},{id:'parking',title:'Парковка',price:500}],requests:[],external:[]};}
export const defaultAccount=accounts=>accounts.find(a=>a.room===STAY.room)?.id||accounts.find(a=>a.room===null)?.id||'';
export function duration(d){return (SERVICES[d.service]?.duration||0)+(SERVICES[d.service]?.extend?Number(d.extension)||0:0);}
export function endTime(d){if(!STARTS.includes(d.start)||!SERVICES[d.service])return '';const n=minutes(d.start)+duration(d);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
export function dateReason(service,date,reservations=[]){
 const parsed=new Date(date+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(parsed.valueOf())||parsed.toISOString().slice(0,10)!==date||date<STAY.arrival||date>STAY.departure)return 'Вне дат проживания';
 if(date<STAY.today)return 'Дата в прошлом';if(!SERVICES[service])return 'Сначала выберите услугу';
 if(date<addDays(STAY.today,SERVICES[service].leadDays||0))return 'Продажи закрыты';
 if(!STARTS.some(start=>isSlotAvailable({...newDraft(),service,date,start},reservations)))return 'Нет свободных слотов';return '';
}
export function availability(d,reservations=[]){
 const s=SERVICES[d.service],from=minutes(d.start),to=from+duration(d),empty={staff:[],places:[],inventory:[]};
 if(!s||!STARTS.includes(d.start)||d.date<STAY.arrival||d.date>STAY.departure||d.date<STAY.today||d.date<addDays(STAY.today,s.leadDays||0)||d.date==='2026-11-28'||to>1080||!Number.isFinite(to)||(s.extend&&![0,15,30].includes(Number(d.extension))))return empty;
 const fixed=[];if(d.date==='2026-11-27'){
 fixed.push({from:600,to:660,resources:['Архипов М.А.','Парная №1','Полотенце','Велосипед №2','Велосипед №3']});
 fixed.push({from:705,to:720,resources:['Архипов М.А.','Парная №1']});
 fixed.push({from:960,to:1080,resources:['Архипов М.А.','Парная №1','Полотенце','Велосипед №2','Велосипед №3']});}
 const booked=reservations.flatMap(item=>{const r=item.draft||item;if(r.date!==d.date||!SERVICES[r.service])return [];return [{from:minutes(r.start),to:minutes(r.start)+duration(r),resources:[r.staff,r.place,...(r.inventory||[])].filter(Boolean)}];});
 const busy=[...fixed,...booked].filter(r=>from<r.to&&r.from<to),free=names=>names.filter(name=>!busy.some(r=>r.resources.includes(name)));
 return {staff:s.staff?free(RESOURCE.staff):[],places:s.place?free(s.includedGuests?['Беседка №5']:RESOURCE.places):[],inventory:s.inventory?free(d.service==='bikes'?RESOURCE.bikes:RESOURCE.inventory):[]};
}
export function isSlotAvailable(d,reservations=[]){const s=SERVICES[d.service],a=availability(d,reservations);return !!s&&(!s.staff||a.staff.length>0)&&(!s.place||a.places.length>0)&&(!s.inventory||a.inventory.length>0);}
export function capacity(d,reservations=[]){const s=SERVICES[d.service];if(!s||!isSlotAvailable(d,reservations))return 0;return d.service==='bikes'?Math.min(s.capacity,d.inventory.length||availability(d,reservations).inventory.length):s.capacity;}
export function updateDraft(d,key,value,reservations=[]){
 if(d[key]===value)return {...d};
 if(key==='group')return {...newDraft(),group:value,account:d.account,comment:d.comment};
 if(key==='service')return {...newDraft(),group:d.group,service:value,account:d.account,comment:d.comment};
 const n={...d,[key]:key==='comment'?String(value).slice(0,255):value};if(key==='date')Object.assign(n,{start:'',staff:'',place:'',inventory:[],extension:0});if(key==='start')Object.assign(n,{staff:'',place:'',inventory:[],extension:0});
 if(['start','extension'].includes(key)){const a=availability(n,reservations),s=SERVICES[n.service];if(s?.staff)n.staff=a.staff.length===1?a.staff[0]:a.staff.includes(n.staff)?n.staff:'';if(s?.place)n.place=a.places.length===1?a.places[0]:a.places.includes(n.place)?n.place:'';if(s?.inventory)n.inventory=a.inventory.length===1?[...a.inventory]:n.inventory.filter(v=>a.inventory.includes(v));}
 if(['start','extension','inventory'].includes(key))n.quantity=Math.max(1,Math.min(Number(n.quantity)||1,capacity(n,reservations)||1));return n;
}
export function reconcileResources(d,reservations=[]){
 const n={...d,inventory:[...(d.inventory||[])]},s=SERVICES[d.service],a=availability(d,reservations);
 if(s?.staff)n.staff=a.staff.length===1?a.staff[0]:a.staff.includes(d.staff)?d.staff:'';
 if(s?.place)n.place=a.places.length===1?a.places[0]:a.places.includes(d.place)?d.place:'';
 if(s?.inventory)n.inventory=a.inventory.length===1?[...a.inventory]:n.inventory.filter(v=>a.inventory.includes(v));
 n.quantity=Math.max(1,Math.min(Number(n.quantity)||1,capacity(n,reservations)||1));return n;
}
export function basePrice(d){const s=SERVICES[d.service];return s?(d.age==='child'&&s.childPrice!==undefined?s.childPrice:s.price):0;}
export function total(d,reservations=[]){if(!isSlotAvailable(d,reservations))return 0;const s=SERVICES[d.service],q=Number(d.quantity);if(!Number.isInteger(q)||q<1||q>capacity(d,reservations))return 0;return basePrice(d)*q+(s.extend?Number(d.extension||0)/15*500:0)+(s.includedGuests?Number(d.extra||0)*s.extraPrice:0);}
export function validate(d,reservations=[],accounts=initialState().accounts){
 const e={},s=SERVICES[d.service];if(d.group&&!GROUPS.includes(d.group)&&d.group!=='uncategorized')e.group='Выберите группу из списка';if(!s){e.service='Выберите услугу';return e;}
 if(d.group&&s.group!==(d.group==='uncategorized'?'':d.group))e.service='Услуга не относится к выбранной группе';const reason=dateReason(d.service,d.date,reservations);if(reason)e.date=reason;
 if(!d.start||!isSlotAvailable(d,reservations))e.start='Выберите свободное время';const a=availability(d,reservations);
 if(s.staff&&!a.staff.includes(d.staff))e.staff='Выберите свободного сотрудника';if(s.place&&!a.places.includes(d.place))e.place='Выберите свободное место';
 if(s.inventory&&(!Array.isArray(d.inventory)||!d.inventory.length||new Set(d.inventory).size!==d.inventory.length||d.inventory.some(v=>!a.inventory.includes(v))))e.inventory='Выберите свободный инвентарь';
 if(s.age&&!['adult','child'].includes(d.age))e.age='Выберите возраст гостя';const q=Number(d.quantity);if(!Number.isInteger(q)||q<1||q>capacity(d,reservations)||(s.fixedQuantity&&q!==1))e.quantity='Количество превышает свободную вместимость';
 if(s.extend&&![0,15,30].includes(Number(d.extension)))e.extension='Выберите доступное окончание';if(s.includedGuests&&(!Number.isInteger(Number(d.extra))||d.extra<0||d.extra>s.maxExtra))e.extra='Превышена вместимость услуги';
 if(!accounts.some(a=>a.id===d.account)&&!['new-room','new-general'].includes(d.account))e.account='Выберите счёт';if(typeof d.comment!=='string'||d.comment.length>255)e.comment='Не более 255 символов';return e;
}
export function commitService(state,draft,requestId,edit=null){
 const prior=state.requests.find(r=>r.id===requestId);if(prior)return {ok:true,state,item:state.items.find(i=>i.id===prior.item)};
 if(edit){const original=state.items.find(i=>i.id===edit.id);if(!original||JSON.stringify(original)!==edit.expected)return {ok:false,state,errors:{edit:'Услуга изменена или удалена в другом окне. Откройте её заново.'}};}
 const others=state.items.filter(i=>i.id!==edit?.id),errors=validate(draft,[...others,...state.external],state.accounts);if(Object.keys(errors).length)return {ok:false,state,errors};const next=structuredClone(state);next.items=next.items.filter(i=>i.id!==edit?.id);let account=next.accounts.find(a=>a.id===draft.account);
 if(draft.account==='new-general'){account=next.accounts.find(a=>a.room===null);if(!account){account={id:'general',label:'Общий счёт брони',room:null};next.accounts.push(account);}}
 if(draft.account==='new-room'){let n=1;while(next.accounts.some(a=>a.id===String(n).padStart(2,'0')))n++;const id=String(n).padStart(2,'0');account={id,label:id+' · номер «'+STAY.room+'»',room:STAY.room};next.accounts.push(account);}
 const item={id:edit?.id||'service-'+requestId,title:SERVICES[draft.service].title,draft:{...structuredClone(draft),account:account.id},account:account.label,price:total(draft,[...others,...state.external])};next.items.push(item);next.requests.push({id:requestId,item:item.id});next.version++;return {ok:true,state:next,item};
}
