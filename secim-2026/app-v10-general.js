/* Haber Kıbrıs Seçim Özel · statik, çevrimdışı çalışabilen yerel editör */
(() => {
'use strict';
const SOURCE=window.HK_DATA;
const STORAGE='hk-secim-2026-state-v2';
const $=id=>document.getElementById(id);
const cloned=o=>JSON.parse(JSON.stringify(o));
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatNum=v=>new Intl.NumberFormat('tr-TR').format(Number(v)||0);
const fmtPct=v=>Number.isFinite(Number(v)) && v!==null && v!=='' ? `%${Number(v).toFixed(1).replace('.',',')}`:'%—';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const pct=(a,b)=>b>0?clamp(a/b*100,0,100):null;
let state;
try {const saved=JSON.parse(localStorage.getItem(STORAGE)||'null'); state=saved?.version===SOURCE.version&&Array.isArray(saved.races)&&[23,25].includes(saved.races.length)?saved:null;}catch(e){}
if(!state) state={version:SOURCE.version,races:cloned(SOURCE.races),parties:cloned(SOURCE.parties),meta:{},customAssets:[]};
state.meta ||= {}; state.customAssets ||= [];
function migrateNational(){state.meta ||= {};for(const r of SOURCE.races)if(!state.races.some(x=>x.id===r.id))state.races.push(cloned(r));if(!state.meta.yskPaletteV10){for(const [code,color] of Object.entries(window.HK_NATIONAL_COLORS)){if(state.parties[code])state.parties[code].color=color;}state.meta.yskPaletteV10=true;}for(const r of state.races){if(r.national){r.showSandik??=true;r.showTime??=true;r.hideZero??=r.kind==='seat';r.date??='2026-12-06';}}}
migrateNational();
function migrateMunicipalPortraits(){state.meta ||= {};if(state.meta.municipalPortraitVersion===8)return;for(const r of state.races){if(r.kind!=="municipal")continue;for(const e of r.entries){const p=window.HK_MUNICIPAL_V8?.[e.id];if(!p)continue;if(!e.photo || e.photo===p.old){Object.assign(e,{photo:p.photo,focusX:50,focusY:50,zoom:1});}}}state.meta.municipalPortraitVersion=8;}
migrateMunicipalPortraits();

for(const race of state.races){for(const e of race.entries){if(race.id==='bb-lefkosa'&&e.id==='mehmet-aktunc'&&Number(e.focusY)===20)e.focusY=28;}}

for(const r of state.races){r.opened ??= null; r.total ??=null; r.time ??='';r.date ??='2026-12-06';r.mapOverride ??=null;}
let kind='party', currentId='mv-lefkosa', selectedPhotoEntry=null, expandedCrop=null;
const canvas=$('poster'),ctx=canvas.getContext('2d',{alpha:false});
const imageCache=new Map(),customUrls=new Map();
let redrawPending=false;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(err){toast('Tarayıcı depolama alanı doldu. JSON yedeği al.');}}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3800);}
function current(){return state.races.find(r=>r.id===currentId)||state.races[0];}
function partyFor(code, race=current()){
 const p=state.parties[code]||state.parties.BAGIMSIZ;
 return p;
}
function currentRows(r){
 const rows=r.entries.map((e,i)=>({...e,_i:i}));
 if(r.kind==='seat')return rows.sort((a,b)=>(Number(b.seats)||0)-(Number(a.seats)||0)||a._i-b._i);
 if(r.kind==='party')return rows.sort((a,b)=>(Number(b.pct)||0)-(Number(a.pct)||0)||a._i-b._i);
 const sum=rows.reduce((acc,e)=>acc+(Number(e.votes)||0),0);
 rows.forEach(x=>x.calcPct=x.manualPct===null||x.manualPct===''||x.manualPct===undefined?(sum>0?pct(Number(x.votes)||0,sum):null):clamp(Number(x.manualPct)||0,0,100));
 return rows.sort((a,b)=>(Number(b.votes)||0)-(Number(a.votes)||0)||a._i-b._i);
}
function getAssetUrl(p){return p?.startsWith('custom:')?(customUrls.get(p)||null):(window.HK_ASSET_DATA?.[p]||p);}
function getImage(src){src=getAssetUrl(src);if(!src)return null;let im=imageCache.get(src);if(im)return im.complete&&im.naturalWidth>0?im:null;im=new Image();imageCache.set(src,im);im.onload=()=>requestPaint();im.onerror=()=>{imageCache.set(src,null);};im.src=src;return null;}
function requestPaint(){if(redrawPending)return;redrawPending=true;requestAnimationFrame(()=>{redrawPending=false;paint();});}
function renderSidebar(){
 $('tab-general').classList.toggle('active',kind==='general');$('tab-party').classList.toggle('active',kind==='party');$('tab-municipal').classList.toggle('active',kind==='municipal');
 $('race-list-label').textContent=kind==='general'?'KKTC GENELİ':kind==='party'?'SEÇİM ÇEVRELERİ':'BELEDİYELER';
 $('race-list').innerHTML=state.races.filter(r=>kind==='general'?!!r.national:!r.national&&r.kind===kind).sort((a,b)=>Number(!!b.national)-Number(!!a.national)).map(r=>`<button class="race-item ${r.id===currentId?'active':''}" data-race="${r.id}"><strong>${escapeHtml(r.name)}</strong><span>${r.entries.length}</span></button>`).join('');
}
function renderHeader(){
 const r=current();$('race-heading').textContent=r.name;
 $('national-options').hidden=!r.national;const hint=document.querySelector('.preview-footer span');if(hint)hint.textContent=r.kind==='seat'?'50 sandalye · Renkler parti dağılımına göre güncellenir.': 'Tek birleşik bar toplam %100 ölçeğini gösterir; sıralama en yüksek sonuçtan başlar.';for(const k of ['showSandik','showTime','hideZero'])$(k).checked=!!r[k];
 $('race-subheading').textContent=r.kind==='seat'?'Milletvekilliği · 50 sandalye':r.kind==='party'?'Milletvekilliği · Parti bazlı oy oranları':`${r.region} · Belediye başkanlığı`;
 $('entry-count').textContent=`${r.entries.length} ${r.kind==='municipal'?'aday':'parti'}`;
 $('entries-title').textContent=r.kind==='seat'?'Partilerin sandalye sayıları':r.kind==='party'?'Parti oy oranları':'Belediye başkan adayları';
 $('entries-hint').textContent=r.kind==='seat'?'Sandalye sayılarını gir. Toplam en fazla 50.':r.kind==='party'?'Oy yüzdesini gir. Ortak %100 dağılım çubuğu ve parti sıralaması otomatik güncellenir.':'Oy adedini gir. Sıralama ve ortak %100 dağılım çubuğu otomatik hesaplanır.';
 $('party-colors-block').hidden=false;
 $('opened').value=r.opened??'';$('total').value=r.total??'';$('time').value=r.time||'';$('date').value=r.date||'2026-12-06';
 $('sandik-note').textContent=Number(r.total)>0?`Sandık açılma oranı: ${fmtPct(pct(Number(r.opened)||0,Number(r.total)))}`:'Sandık oranı sayılardan hesaplanır.';
}
function renderColors(){const box=$('party-color-fields');box.innerHTML=`<div class="color-grid">${Object.values(state.parties).map(p=>`<label class="color-entry"><input type="color" data-color="${p.code}" value="${p.color}"/>${escapeHtml(p.code==='BAGIMSIZ'?'Bağımsız':p.code)}</label>`).join('')}</div><p class="mini-note">Başlangıç renkleri YSK deneme sonuç ekranındaki renklerden alınmıştır.</p>`;}
function renderEntries(){
 const r=current();let html='<div class="entries-list">';
 currentRows(r).forEach((e,i)=>{
  const p=partyFor(e.party),src=getAssetUrl(e.photo);
  if(r.national){
   const logo=getAssetUrl(p.logo),code=p.code==='BAGIMSIZ'?'BAĞIMSIZ':p.code;
   html+=`<div class="entry-row"><img src="${escapeHtml(logo||'')}" alt="" style="background:#fff" onerror="this.style.visibility='hidden'"><div><div class="code" style="color:${p.color}">${escapeHtml(code)}</div><div class="sub">${escapeHtml(p.name)}</div></div><div>${r.kind==='seat'?`<input data-seats="${e.id}" type="number" min="0" max="50" step="1" placeholder="Sandalye" value="${e.seats??''}">`:`<input data-pct="${e.id}" type="number" min="0" max="100" step="0.1" placeholder="%" value="${e.pct??''}"><input data-votes="${e.id}" type="number" min="0" step="1" placeholder="Oy (isteğe bağlı)" value="${e.votes??''}">`}</div></div>`;
  }else if(r.kind==='party'){
   const logo=getAssetUrl(p.logo);
   html+=`<div class="entry-row"><img src="${escapeHtml(logo||'')}" alt="" style="background:${p.code==='UBP'?'#ffffff':'#f1f2f5'}" onerror="this.style.visibility='hidden'"><div><div class="code" style="color:${escapeHtml(p.color)}">${escapeHtml(p.code)}</div><div class="sub">${escapeHtml(p.name)}</div></div><input data-pct="${e.id}" type="number" min="0" max="100" step="0.1" placeholder="%" value="${e.pct??''}" aria-label="${escapeHtml(p.code)} oy yüzdesi"></div>`;
  }else{
   const img=src?`<img src="${escapeHtml(src)}" alt="${escapeHtml(e.name)}" style="object-position:${e.focusX??50}% ${e.focusY??50}%;border:2px solid ${p.color}">`:`<div class="photoless" style="width:43px;height:43px;border:2px solid ${p.color}">◯</div>`;
   html+=`<div class="entry-row candidate"><button type="button" title="Fotoğraf seç" class="photo-click" data-photo="${e.id}">${img}</button><div><div class="code">${escapeHtml(e.name)}</div><div class="sub"><span style="color:${p.color}">${escapeHtml(p.code==='BAGIMSIZ'?'BAĞIMSIZ':p.code)}</span><button type="button" class="photo-edit" data-crop="${e.id}">Kadraj</button></div></div><div><input data-votes="${e.id}" type="number" min="0" step="1" placeholder="Oy" value="${e.votes??''}" aria-label="${escapeHtml(e.name)} oy sayısı"><small class="custom-label">${fmtPct(e.calcPct)}</small></div></div>`;
   if(expandedCrop===e.id){
    html+=`<div class="crop-controls"><div class="crop-title">${escapeHtml(e.name)} · Yuvarlak fotoğraf kadrajı</div>`;
    for(const [field,label,min,max,step,value] of [['focusX','Yatay konum',0,100,1,e.focusX??50],['focusY','Dikey konum',0,100,1,e.focusY??40],['zoom','Yakınlaştırma',1,2.5,.05,e.zoom??1]])
     html+=`<label class="crop-control-row"><span>${label}</span><input data-cropfield="${field}" data-cropid="${e.id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><strong>${value}</strong></label>`;
    html+=`<label class="mini-note">Yüz dairenin merkezinde kalana kadar kaydırıcıları ayarla. Değişiklik doğrudan PNG'ye yansır.</label><label class="mini-note">Gerekirse otomatik hesaplanan yüzdelik yerine özel değer kullan: <input data-manual="${e.id}" type="number" min="0" max="100" step="0.1" placeholder="Otomatik" value="${e.manualPct??''}" style="max-width:100px"></label></div>`;
   }
  }
 });
 html+='</div>';$('entries').innerHTML=html;
 refreshTotals();
}
function render(){renderSidebar();renderHeader();renderEntries();renderColors();requestPaint();}
function setRace(id){if(!state.races.some(r=>r.id===id))return;currentId=id;expandedCrop=null;kind=current().national?'general':current().kind;render();}
// Load fonts before first screenshot/export (exact local families first, open fallback second).
if(document.fonts?.ready)document.fonts.ready.then(()=>requestPaint());
// CANVAS: Şablon, kontrol ekranından bağımsız tek bir 1080×1350 üretim motoru ile çizilir.
function rr(x,y,w,h,r,fill,stroke=null){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function txt(s,x,y,size=22,color='#141619',weight='600',align='left',family='HKManrope,Manrope,Arial,sans-serif'){ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.font=`${weight} ${size}px ${family}`;ctx.fillText(String(s),x,y);}
function condensed(s,x,y,sz,maxWidth,color='#111317'){ctx.save();ctx.font=`700 ${sz}px HKTungsten,'Tungsten Bold','Tungsten','Teko','Arial Narrow',sans-serif`;const width=Math.max(1,ctx.measureText(s).width);let scale=Math.min(1,maxWidth/width);ctx.translate(x,y);ctx.scale(scale,1);ctx.fillStyle=color;ctx.textBaseline='alphabetic';ctx.fillText(s,0,0);ctx.restore();}
function donut(cx,cy,r,value){ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,Math.PI*1.5);ctx.strokeStyle='#e2e5eb';ctx.lineWidth=9;ctx.stroke();if(Number(value)>0){ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,(-Math.PI/2)+(2*Math.PI*(Number(value)||0)/100));ctx.strokeStyle='#111318';ctx.lineCap='round';ctx.lineWidth=9;ctx.stroke();ctx.lineCap='butt';}}
function drawMap(r){let path=`assets/map/${r.map}.png`,img=getImage(path);if(!img)img=getImage('assets/map/base.png');if(img)ctx.drawImage(img,575,5,490,235);}
function drawLogo(){const im=getImage('assets/hk-logo.png');if(im)ctx.drawImage(im,940,1258,76,76);else{rr(940,1258,76,76,0,'#f9c100');txt('HK',978,1307,28,'#111','900','center');}}
function fitTitle(s,maxWidth,sz){ctx.font=`700 ${sz}px HKManrope,Manrope,Arial,sans-serif`;return ctx.measureText(s).width<=maxWidth;}
function drawHeader(r){
 // Zemin ve harita
 ctx.fillStyle='#eef0f3';ctx.fillRect(0,0,1080,1350);drawMap(r);
 ctx.fillStyle='#ffd000';ctx.fillRect(64,50,14,14);
 txt(`6 ARALIK 2026 · ${r.kind==='party'?'GENEL SEÇİM':'YEREL SEÇİMLER'}`,90,62,19,'#111317','700');
 const title=r.displayTitle.toLocaleUpperCase('tr-TR');
 // Uzun belediye adları iki satır; üst alan daraltılmadan okunaklı kalır.
 const maxTitleWidth=title.length>13?610:title.length<=5?325:title.length<=8?450:550;
 if(r.id==='bb-gonyeli-alaykoy'){condensed(title,48,219,142,520);}
 else if(title.length>16 && title.includes('-')){
  const words=title.split('-');let a=words[0],b=words.slice(1).join('-');
  if(words.length===3){a=words.slice(0,2).join('-');b=words[2];}
  condensed(a,48,151,87,maxTitleWidth);
  condensed(b,48,226,87,maxTitleWidth);
 }else{condensed(title,48,225,157,maxTitleWidth);}
 const sub=r.kind==='party'?'MİLLETVEKİLLİĞİ OY ORANLARI':'BELEDİYE BAŞKANLIĞI OY ORANLARI';
 rr(47,237,640,73,0,'#ffd000');condensed(sub,65,303,57,608);
 // üst ölçümler
 rr(64,344,464,104,16,'#fff');rr(551,344,465,104,16,'#fff');
 donut(118,396,34,pct(Number(r.opened)||0,Number(r.total)||0));
 txt('AÇILAN SANDIK',171,374,17,'#61728a','700');condensed(fmtPct(pct(Number(r.opened)||0,Number(r.total)||0)),171,411,40,180);
 txt(`${r.opened??'—'} / ${r.total??'—'}`,171,434,18,'#66758b','600');
 // saat ikonu
 ctx.strokeStyle='#17191d';ctx.lineWidth=4;ctx.beginPath();ctx.arc(598,397,22,0,2*Math.PI);ctx.stroke();line(598,397,598,381,'#16191c',3.5);line(598,397,613,408,'#16191c',3.5);
 txt('SON GÜNCELLEME',642,374,17,'#61728a','700');
 condensed(r.time||'--.--',642,411,39,190);txt(r.date? new Date(`${r.date}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'long'}).toLocaleUpperCase('tr-TR'):'6 ARALIK',642,435,18,'#66758b','600');
 // liste başlığı
 rr(40,470,1000,49,10,'#111317');ctx.fillStyle='#ffd000';ctx.fillRect(64,489,12,12);
 txt(r.kind==='party'?'PARTİLERİN OY ORANLARI':'ADAYLARIN ALDIĞI OYLAR',88,499,21,'#fff','700');
 // filigran orta alana az kontrastlı
}
function coverCircle(img,cx,cy,r,opts={}){
 const color=opts.color||'#9298a7';
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.clip();
 ctx.fillStyle='#f1f3f6';ctx.fillRect(cx-r,cy-r,2*r,2*r);
 if(img){
  const zoom=clamp(Number(opts.zoom)||1,1,3),cw=2*r,ch=2*r;
  const scale=Math.max(cw/img.naturalWidth,ch/img.naturalHeight)*zoom;
  const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
  const fx=clamp(Number(opts.focusX??50)/100,0,1),fy=clamp(Number(opts.focusY??40)/100,0,1);
  let dx=cx-fx*dw,dy=cy-fy*dh;
  dx=clamp(dx,cx+r-dw,cx-r);dy=clamp(dy,cy+r-dh,cy-r);
  ctx.drawImage(img,dx,dy,dw,dh);
 }else{
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy-r*.13,r*.21,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy+r*.65,r*.40,Math.PI,0);ctx.stroke();
 }
 ctx.restore();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.lineWidth=5;ctx.strokeStyle=color;ctx.stroke();
}
function insideImage(img,x,y,w,h){if(!img)return;const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
// Birleşik pay çubuğu: bütün parti/adaylar AYNI %100 ölçekte gösterilir.
// Girilmeyen / toplam dışı pay nötr zeminde kalır; hiçbir partinin çubuğu tek başına %100 değildir.
function drawCombinedBar(rows,r){
 const x=72,y=558,w=936,h=27;
 const parts=rows.map(e=>({e,p:partyFor(e.party),value:Math.max(0,Number(r.kind==='party'?e.pct:e.calcPct)||0)}));
 const sum=parts.reduce((acc,p)=>acc+p.value,0);
 txt(r.kind==='party'?'PARTİ OY DAĞILIMI · %100':'ADAY OY DAĞILIMI · %100',72,542,18,'#5d6a7a','700');
 if(sum>100.11){
  rr(x,y,w,h,13,'#fff0ef','#b92020');
  txt('HATA: GİRİLEN YÜZDELER TOPLAMI %100’Ü AŞIYOR',x+w/2,y+20,16,'#bb2525','800','center');
  return;
 }
 ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,13);ctx.clip();
 ctx.fillStyle='#e9edf2';ctx.fillRect(x,y,w,h);
 let start=x;
 for(const part of parts){
  if(part.value<=0)continue;
  const len=w*part.value/100;
  ctx.fillStyle=part.p.color;ctx.fillRect(start,y,len,h);
  start+=len;
 }
 ctx.restore();
 if(sum<99.9 && sum>0.01)txt('Kalan pay / girilmemiş sonuç',1006,542,14,'#8190a3','500','right');
 if(sum<.001)txt('Sonuç girilmedi',1006,542,14,'#8190a3','500','right');
}
function drawNameFit(name,x,y,size,maxWidth,weight='600'){
 ctx.save();const label=String(name).toLocaleUpperCase('tr-TR');
 ctx.font=`${weight} ${size}px HKManrope,Manrope,Arial,sans-serif`;
 const width=ctx.measureText(label).width;
 if(width>maxWidth){ctx.translate(x,y);ctx.scale(clamp(maxWidth/width,.52,1),1);txt(label,0,0,size,'#111317',weight);}
 else txt(label,x,y,size,'#111317',weight);
 ctx.restore();
}
function drawParties(r){
 const rows=currentRows(r),firstY=613,rowH=(1249-firstY)/rows.length;
 rr(40,509,1000,740,14,'#fff');ctx.save();ctx.beginPath();ctx.roundRect(40,509,1000,740,14);ctx.clip();
 drawCombinedBar(rows,r);
 rows.forEach((e,i)=>{
  const y=firstY+i*rowH,p=partyFor(e.party),raw=e.pct===null||e.pct===''?null:clamp(Number(e.pct)||0,0,100);
  if(i%2===1){ctx.fillStyle='#f4f5f7';ctx.fillRect(40,y,1000,rowH);}
  if(i>0)line(40,y,1040,y,'#dfe3e9',1);
  const cy=y+rowH/2,logo=getImage(p.logo);
  const bg=(p.code==='HP'||p.code==='UBP')?'#ffffff':p.code==='TAM'?'#51b0e4':p.color;
  rr(65,cy-29,58,58,29,bg);ctx.save();ctx.beginPath();ctx.arc(94,cy,28,0,Math.PI*2);ctx.clip();
  if(logo)insideImage(logo,67,cy-27,54,54);else txt(p.code,94,cy+5,18,p.code==='HP'?'#214d78':p.code==='UBP'?'#f18a00':'#fff','700','center');ctx.restore();
  txt(p.code,149,cy-3,29,'#101216','700');
  txt(p.name,149,cy+21,18,'#63738b','500');
  ctx.fillStyle=p.color;ctx.fillRect(838,cy-20,5,40);
  condensed(fmtPct(raw),875,cy+18,54,143,'#111317');
 });ctx.restore();
}
function drawCandidates(r){
 const rows=currentRows(r),firstY=613,rowH=(1249-firstY)/rows.length;
 rr(40,509,1000,740,14,'#fff');ctx.save();ctx.beginPath();ctx.roundRect(40,509,1000,740,14);ctx.clip();
 drawCombinedBar(rows,r);
 const N=rows.length;const rad=N<=2?89:N===3?76:N===4?61:N<=6?47:34;
 const photoX=N<=3?207:N===4?180:129;
 const txtX=N<=3?309:N===4?266:205;
 const nameSz=N<=3?38:N===4?32:N<=6?27:24;
 rows.forEach((e,i)=>{
  const y=firstY+i*rowH,cy=y+rowH/2,p=partyFor(e.party);
  if(i%2===1){ctx.fillStyle='#f4f5f7';ctx.fillRect(40,y,1000,rowH);}
  if(i>0)line(40,y,1040,y,'#dce0e8');
  condensed(String(i+1),63,cy+13,40,33,'#9ca7b8');
  coverCircle(getImage(e.photo),photoX,cy,Math.min(rad,rowH/2-7),{color:p.color,zoom:e.zoom,focusX:e.focusX,focusY:e.focusY});
  drawNameFit(e.name,txtX,cy-12,nameSz,Math.max(165,810-txtX));
  ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(txtX+7,cy+21,7,0,Math.PI*2);ctx.fill();
  txt(p.code==='BAGIMSIZ'?'BAĞIMSIZ':p.code,txtX+23,cy+29,N<=3?27:21,p.color,'600');
  condensed(fmtPct(e.calcPct),850,cy+5,N<=3?65:54,165,'#111317');
  txt(e.votes===null||e.votes===''?'— oy':`${formatNum(e.votes)} oy`,1015,cy+57,N<=3?20:17,'#667890','700','right');
 });ctx.restore();
}
function drawFooter(r){
 // Kurumsal alt bant
 ctx.fillStyle='#ffcd00';ctx.fillRect(0,1270,510,68);
 condensed('HABER KIBRIS',40,1331,62,470,'#101216');
 condensed('SEÇİM ÖZEL',528,1331,65,396,'#101216');drawLogo();

}
function drawPsdData(r){
 // PSD'nin orijinal kompoziti üst başlık, sarı bant, ilgili belediye haritası ve dip bandını korur.
 // Sadece iki canlı bilgi alanı temizlenir; referanstaki diğer piksele dokunulmaz.
 ctx.fillStyle='#fff';
 ctx.fillRect(170,377,285,68);
 ctx.fillRect(642,377,260,68);
 donut(118,396,34,pct(Number(r.opened)||0,Number(r.total)||0));
 condensed(fmtPct(pct(Number(r.opened)||0,Number(r.total)||0)),172,411,40,180);
 txt(`${r.opened??'—'} / ${r.total??'—'}`,172,434,18,'#66758b','700');
 condensed(r.time||'--.--',642,411,39,190);
 txt(r.date?new Date(`${r.date}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'long'}).toLocaleUpperCase('tr-TR'):'6 ARALIK',642,435,18,'#66758b','700');

}
function drawWatermark(){
 ctx.save();ctx.globalAlpha=.043;ctx.fillStyle='#15171a';ctx.textAlign='center';
 ctx.font='900 132px Arial,sans-serif';ctx.fillText('HABER',540,873);
 ctx.font='90px Georgia,serif';ctx.letterSpacing='14px';ctx.fillText('KIBRIS',540,981);ctx.restore();
}

function nationalRows(r){const key=r.kind==='seat'?'seats':'pct';return currentRows(r).filter(e=>{if(r.hideZero)return Number(e[key])>0;if(r.kind==='party'&&e.party==='BAGIMSIZ')return Number(e.pct)>0||Number(e.votes)>0;return true;});}
function drawNational(r,template){
 if(template)ctx.drawImage(template,0,0,1080,1350);else drawHeader({...r,kind:'party'});
 const numFont="HKTungsten,'Tungsten Bold','Tungsten','Teko','Arial Narrow',sans-serif";
 const num=(value,x,y,size,width,align='left')=>{ctx.save();ctx.font=`700 ${size}px ${numFont}`;ctx.textBaseline='alphabetic';ctx.textAlign=align;ctx.fillStyle='#111317';const actual=Math.max(1,ctx.measureText(String(value)).width);ctx.translate(x,y);ctx.scale(Math.min(1,width/actual),1);ctx.fillText(String(value),0,0);ctx.restore();};
 const showS=r.showSandik!==false,showT=r.showTime!==false,hasInfo=showS||showT;
 let top=hasInfo?470:344;
 if(hasInfo){const boxWidth=showS&&showT?464:952;
  if(showS){rr(64,344,boxWidth,104,16,'#fff');donut(118,396,34,pct(Number(r.opened)||0,Number(r.total)||0));txt('AÇILAN SANDIK',172,374,17,'#61728a','700');num(fmtPct(pct(Number(r.opened)||0,Number(r.total)||0)),172,411,40,200);txt(`${r.opened??'—'} / ${r.total??'—'}`,172,434,18,'#66758b','700');}
  if(showT){const x=showS?552:64;rr(x,344,boxWidth,104,16,'#fff');ctx.strokeStyle='#16191d';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x+46,397,22,0,2*Math.PI);ctx.stroke();line(x+46,397,x+46,381,'#16191d',3.5);line(x+46,397,x+61,408,'#16191d',3.5);txt('SON GÜNCELLEME',x+90,374,17,'#61728a','700');num((r.time||'--.--').replace(':','.'),x+90,411,39,190);txt(r.date?new Date(`${r.date}T12:00:00`).toLocaleDateString('tr-TR',{day:'numeric',month:'long'}).toLocaleUpperCase('tr-TR'):'6 ARALIK',x+90,435,18,'#66758b','700');}
 }
 rr(40,top,1000,49,10,'#111317');ctx.fillStyle='#ffd000';ctx.fillRect(64,top+17,12,12);txt(r.kind==='seat'?'50 MİLLETVEKİLİ':'OY DAĞILIMI',88,top+30,21,'#fff','700');
 const body=top+39,bottom=1250;rr(40,body,1000,bottom-body,14,'#fff');
 const rows=nationalRows(r);const all=currentRows(r);
 const logo=(p,cx,cy,rad)=>{rr(cx-rad,cy-rad,2*rad,2*rad,rad,p.code==='HP'||p.code==='UBP'?'#fff':p.code==='TAM'?'#51b0e4':p.color);ctx.save();ctx.beginPath();ctx.arc(cx,cy,rad-1,0,2*Math.PI);ctx.clip();const im=getImage(p.logo);if(im)insideImage(im,cx-rad+2,cy-rad+2,(rad-2)*2,(rad-2)*2);else if(p.code==='BAGIMSIZ'){ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(cx,cy-rad*.22,rad*.22,0,2*Math.PI);ctx.moveTo(cx-rad*.43,cy+rad*.52);ctx.arc(cx,cy+rad*.47,rad*.43,Math.PI,2*Math.PI);ctx.stroke();}else txt(p.code,cx,cy+6,Math.min(19,rad*.68),'#fff','700','center');ctx.restore();};
 const writeRow=(e,x,y,w,h,isSeat)=>{const p=partyFor(e.party,r),cy=y+h/2,rad=Math.min(32,h*.35),code=p.code==='BAGIMSIZ'?'BAĞIMSIZ':p.code;logo(p,x+rad,cy,rad);const t=x+2*rad+16;txt(code,t,cy-3,Math.min(30,h*.39),'#111317','700');ctx.save();ctx.beginPath();ctx.rect(t,cy+2,Math.max(40,w-(t-x)-(isSeat?72:270)),28);ctx.clip();txt(p.code==='BAGIMSIZ'?(isSeat?'Bağımsız milletvekilleri':'Bağımsız adaylar'):p.code==='TAM'?'TAM Parti':p.name,t,cy+22,17,'#63738b','500');ctx.restore();if(isSeat){num(e.seats==null?'—':String(e.seats),x+w,cy+20,56,65,'right');}else{if(e.votes!=null)txt(`${formatNum(e.votes)} oy`,x+w-190,cy+5,20,'#66758b','700','right');num(fmtPct(e.pct),x+w,cy+18,52,160,'right');} };
 if(r.kind==='party'){
  const x=64,y=body+26,w=952,h=46,sum=all.reduce((a,e)=>a+(Number(e.pct)||0),0);ctx.fillStyle='#e9edf2';ctx.fillRect(x,y,w,h);let pos=x;for(const e of all){const v=Number(e.pct)||0;if(v<=0)continue;const p=partyFor(e.party,r),len=Math.max(0,Math.min(x+w-pos,w*v/100));if(len<=0)break;ctx.fillStyle=p.color;ctx.fillRect(pos,y,len,h);if(len>65)txt(p.code==='BAGIMSIZ'?'B':p.code,pos+9,y+29,17,['YDP','TAM','UBP'].includes(p.code)?'#111':'#fff','700');if(pos>x)line(pos,y,pos,y+h,'#fff',1.5);pos+=len;}
  if(sum>100.11)txt('YÜZDE TOPLAMI %100’Ü AŞIYOR',540,y+30,19,'#111','700','center');
  const start=y+h+15,rowH=Math.min(120,(bottom-start-7)/Math.max(1,rows.length));rows.forEach((e,i)=>{const yy=start+i*rowH;if(i)line(64,yy,1016,yy,'#dce0e8');writeRow(e,64,yy,952,rowH,false);});
  if(!rows.length)txt('Sonuç girilmedi',540,body+170,24,'#66758b','700','center');
 }else{
  const total=all.reduce((a,e)=>a+(Number(e.seats)||0),0),colors=[];for(const e of all)for(let j=0;j<(Number(e.seats)||0)&&colors.length<50;j++)colors.push(partyFor(e.party,r).color);
  const extra=body-509;const maxRows=Math.max(1,Math.ceil(rows.length/2)),listH=Math.min(340,Math.max(230,maxRows*68)),listY=bottom-listH-8;const graphH=listY-body-10,scale=Math.min(1,graphH/440),baseY=body+18;
  const cyPt=y=>baseY+(y-533)*scale;const cxPt=x=>540+(x-540)*scale;
  window.HK_SEAT_POINTS.forEach(([x,y],i)=>{ctx.beginPath();ctx.arc(cxPt(x),cyPt(y),22*scale,0,Math.PI*2);ctx.fillStyle=colors[i]||'#cdd2db';ctx.fill();});line(540,cyPt(533),540,cyPt(762),'#98a5b8',1.5);txt('ÇOĞUNLUK',540,cyPt(811),Math.max(15,20*scale),'#61728a','700','center');num('26',540,cyPt(892),92*scale,100*scale,'center');
  if(total<50)txt(`${50-total} sandalye henüz dağıtılmadı`,540,Math.min(listY-4,cyPt(951)),15,'#61728a','700','center');
  if(total>50)txt('HATA: TOPLAM 50’Yİ AŞIYOR',540,listY-5,20,'#b22222','700','center');
  const rowH=listH/maxRows;rows.forEach((e,i)=>{const col=Math.floor(i/maxRows),j=i%maxRows,x=64+col*496,yy=listY+j*rowH;if(j)line(x,yy,x+456,yy,'#dce0e8');writeRow(e,x,yy,456,rowH,true);});
 }
 drawWatermark();
}

function paint(){
 const r=current();ctx.clearRect(0,0,1080,1350);
 const template=getImage(`assets/templates/${r.id}.webp?v=header-20261121`);
 if(r.national){drawNational(r,template);return;}
 if(template){ctx.drawImage(template,0,0,1080,1350);drawPsdData(r);}
 else drawHeader(r);
 if(r.kind==='party')drawParties(r);else drawCandidates(r);
 drawWatermark();
 if(!template)drawFooter(r);

}
function editEntry(id,field,value){const r=current(),e=r.entries.find(x=>x.id===id);if(!e)return;e[field]=value;save();refreshTotals();requestPaint();}
function refreshTotals(){const r=current();if(r.kind==='seat'){const total=r.entries.reduce((s,e)=>s+(Number(e.seats)||0),0);$('sum-note').textContent=`Dağıtılan sandalye: ${total} / 50`;return;}const sum=r.kind==='party'?r.entries.reduce((acc,e)=>acc+(Number(e.pct)||0),0):r.entries.reduce((acc,e)=>acc+(Number(e.votes)||0),0);$('sum-note').textContent=r.kind==='party'?`Girilen yüzdeler toplamı: ${fmtPct(sum)} (toplam %100 olmalıdır)`:`Girilen aday oyları toplamı: ${formatNum(sum)}`;}
// Tarayıcı içi fotoğraf deposu: dışarıdan sonradan eklenen fotoğraflar IndexedDB'de tutulur.
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('hk-secim-images',1);req.onupgradeneeded=()=>req.result.createObjectStore('photos');req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);});}
async function writeBlob(key,blob){const db=await openDB();return new Promise((ok,bad)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(blob,key);tx.oncomplete=()=>{db.close();ok();};tx.onerror=()=>bad(tx.error);});}
async function readBlob(key){const db=await openDB();return new Promise((ok,bad)=>{const tx=db.transaction('photos','readonly');const req=tx.objectStore('photos').get(key);req.onsuccess=()=>{db.close();ok(req.result)};req.onerror=()=>bad(req.error);});}
async function ensureCustom(id){if(customUrls.has(id))return customUrls.get(id);const blob=await readBlob(id);if(blob){const url=URL.createObjectURL(blob);customUrls.set(id,url);return url;}return null;}
async function initCustom(){await Promise.all(state.customAssets.map(x=>ensureCustom(x.path).catch(()=>null)));render();}
function openLibrary(id){selectedPhotoEntry=id;$('library-for').textContent=current().entries.find(e=>e.id===id)?.name||'';$('library-search').value='';$('library-filter').value='all';renderLibrary();$('library-dialog').showModal();}
function renderLibrary(){const search=$('library-search').value.toLocaleLowerCase('tr-TR').trim(),filter=$('library-filter').value;
 const library=[...SOURCE.manifest.filter(x=>x.kind==='municipal'||x.kind==='archive'),...state.customAssets];
 const filtered=library.filter(x=>(filter==='all'|| (filter==='municipal'&&x.kind==='municipal')|| (x.group===filter))&&(`${x.name} ${x.folder||''} ${x.district||''}`).toLocaleLowerCase('tr-TR').includes(search));
 $('library-grid').innerHTML=filtered.slice(0,250).map(x=>`<button type="button" class="asset-card" data-asset="${escapeHtml(x.path)}"><img loading="lazy" src="${escapeHtml(getAssetUrl(x.path)||'')}" alt=""><div>${escapeHtml(x.name)}</div><small>${escapeHtml(x.group?x.group.toUpperCase()+' · kontrol gerekli':x.district||'Yeni fotoğraf')}</small></button>`).join('')||'<p>Aramanıza uygun fotoğraf bulunamadı.</p>';
}
async function uploadCustom(file){if(!file || !file.type.startsWith('image/'))return;const dataUrl=await new Promise((ok,bad)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=()=>bad(reader.error);reader.readAsDataURL(file);});
 const im=await new Promise((ok,bad)=>{const image=new Image();image.onload=()=>ok(image);image.onerror=bad;image.src=dataUrl;});
 const c=document.createElement('canvas');const scale=Math.min(1,1200/Math.max(im.width,im.height));c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);let cx=c.getContext('2d');cx.drawImage(im,0,0,c.width,c.height);
 const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',.9));const id=`custom:${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
 await writeBlob(id,blob);customUrls.set(id,URL.createObjectURL(blob));state.customAssets.push({kind:'custom',path:id,name:file.name});if(selectedPhotoEntry)assignPhoto(id);else{save();renderLibrary();}toast('Fotoğraf havuza eklendi.');
}
function assignPhoto(path){const e=current().entries.find(x=>x.id===selectedPhotoEntry);if(!e)return;e.photo=path;e.focusX=50;e.focusY=35;e.zoom=1.25;const meta=SOURCE.manifest.find(x=>x.path===path);if(meta?.zoom)e.zoom=meta.zoom;if(meta?.focus){e.focusX=Math.round(meta.focus[0]*100);e.focusY=Math.round(meta.focus[1]*100);}expandedCrop=e.id;save();render();$('library-dialog').close();toast('Fotoğraf yerleştirildi; kadrajını kontrol et.');}
function exportPng(){
 const r=current();if(r.national){const total=r.entries.reduce((s,e)=>s+(Number(r.kind==='seat'?e.seats:e.pct)||0),0);if(total>(r.kind==='seat'?50:100.11)){toast('Toplam geçersiz. PNG oluşturulmadı.');return;}}requestPaint();paint();canvas.toBlob(blob=>{if(!blob){toast('PNG oluşturulamadı');return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`HK_SECIM_2026_${r.id.toUpperCase()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);toast('1080 × 1350 PNG hazır.');},'image/png');
}
function loadDemo(){const r=current();r.opened=88;r.total=131;r.time='22:10';r.date='2026-12-06';
 if(r.national){r.opened=498;r.total=752;}if(r.kind==='seat'){const nums=[18,16,0,3,4,7,0,0,2];r.entries.forEach((e,i)=>e.seats=nums[i]||0);
 }else if(r.kind==='party'){
  const nums=[31.2,29.5,11.4,7.9,6.6,5.8,4.5,3.1];r.entries.forEach((e,i)=>{e.pct=nums[i]??0;if(r.national)e.votes=Math.round((e.pct||0)*1350);});
 }else{
  const nums=[1320,1140,360,120,100,60];r.entries.forEach((e,i)=>{e.votes=nums[i]||40;e.manualPct=null;});
 }save();render();toast('Örnek veri yüklendi. Yayın verisi değildir.');
}
function clearVotes(){const r=current();if(r.kind==='seat')r.entries.forEach(e=>e.seats=null);else if(r.kind==='party')r.entries.forEach(e=>{e.pct=null;if(r.national)e.votes=null;});else r.entries.forEach(e=>{e.votes=null;e.manualPct=null});r.opened=null;r.total=null;save();render();}
// Events
$('tab-general').addEventListener('click',()=>{setRace('mv-kktc-geneli')});$('tab-party').addEventListener('click',()=>{kind='party';setRace('mv-lefkosa')});$('tab-municipal').addEventListener('click',()=>{kind='municipal';setRace('bb-lefkosa')});
$('race-list').addEventListener('click',e=>{const b=e.target.closest('[data-race]');if(b)setRace(b.dataset.race);});
for(const key of ['opened','total','time','date']){$(key).addEventListener('input',e=>{const r=current();r[key]=key==='opened'||key==='total'?(e.target.value===''?null:Math.max(0,Math.trunc(Number(e.target.value)))):e.target.value;save();$('sandik-note').textContent=Number(r.total)>0?`Sandık açılma oranı: ${fmtPct(pct(Number(r.opened)||0,Number(r.total)))}`:'Sandık oranı sayılardan hesaplanır.';requestPaint();});}
$('toggle-colors').addEventListener('click',()=>{$('party-color-fields').hidden=!$('party-color-fields').hidden});
$('party-color-fields').addEventListener('input',e=>{if(e.target.matches('[data-color]')){state.parties[e.target.dataset.color].color=e.target.value;save();requestPaint();}});
for(const key of ['showSandik','showTime','hideZero'])$(key).addEventListener('change',e=>{current()[key]=e.target.checked;save();requestPaint();});
$('entries').addEventListener('input',e=>{const t=e.target;
 if(t.dataset.seats)editEntry(t.dataset.seats,'seats',t.value===''?null:clamp(Math.trunc(Number(t.value)),0,50));
 if(t.dataset.pct){editEntry(t.dataset.pct,'pct',t.value===''?null:clamp(Number(t.value),0,100));}
 if(t.dataset.votes){editEntry(t.dataset.votes,'votes',t.value===''?null:Math.max(0,Math.trunc(Number(t.value))));}
 if(t.dataset.manual){editEntry(t.dataset.manual,'manualPct',t.value===''?null:clamp(Number(t.value),0,100));}
 if(t.dataset.cropfield){editEntry(t.dataset.cropid,t.dataset.cropfield,Number(t.value));t.nextElementSibling.textContent=t.value;}
});
// Form satırlarını yazarken yerinden oynatmıyoruz; canlı poster anında yeniden sıralanır.
$('entries').addEventListener('click',e=>{const t=e.target.closest('[data-photo],[data-crop]');if(!t)return;
 if(t.dataset.photo)openLibrary(t.dataset.photo);else{expandedCrop=expandedCrop===t.dataset.crop?null:t.dataset.crop;renderEntries();}
});
$('load-demo').addEventListener('click',loadDemo);$('clear-data').addEventListener('click',clearVotes);
$('library-close').addEventListener('click',()=>$('library-dialog').close());
$('library-search').addEventListener('input',renderLibrary);$('library-filter').addEventListener('change',renderLibrary);
$('library-grid').addEventListener('click',e=>{const t=e.target.closest('[data-asset]');if(t)assignPhoto(t.dataset.asset)});
$('photo-upload').addEventListener('change',async e=>{try{await uploadCustom(e.target.files?.[0]);e.target.value='';}catch(err){console.error(err);toast('Fotoğraf yüklenemedi.')}});
for(const id of ['export-png','export-png-bottom'])$(id).addEventListener('click',exportPng);
$('export-json').addEventListener('click',async()=>{
 try{
   const copy=cloned(state),fileRefs=new Set(copy.customAssets.map(x=>x.path));copy.races.forEach(r=>{if(r.mapOverride?.startsWith('custom:'))fileRefs.add(r.mapOverride);});
   copy.customFileData={};
   for(const ref of fileRefs){const blob=await readBlob(ref);if(!blob)continue;copy.customFileData[ref]=await new Promise((ok,bad)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=()=>bad(fr.error);fr.readAsDataURL(blob);});}
   const blob=new Blob([JSON.stringify(copy,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hk-secim-2026-tam-yedek.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);toast('Veriler ve sonradan yüklenen fotoğraflar yedeklendi.');
 }catch(err){console.error(err);toast('Yedek oluşturulamadı.');}
});
$('import-json').addEventListener('change',async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{
  const obj=JSON.parse(await f.text());if(obj.version!==SOURCE.version||!Array.isArray(obj.races)||![23,25].includes(obj.races.length))throw new Error('Geçersiz şema');
  for(const [ref,data] of Object.entries(obj.customFileData||{})){if(!ref.startsWith('custom:')||!data.startsWith('data:image/'))continue;const blob=await(await fetch(data)).blob();await writeBlob(ref,blob);}
  delete obj.customFileData;state=obj;state.customAssets ||= [];migrateNational();migrateMunicipalPortraits();save();render();await initCustom();toast('Veriler ve fotoğraflar geri yüklendi.');
 }catch(err){console.error(err);toast('Yedek yüklenemedi. Dosya yapısı uyumsuz.');}e.target.value='';
});
// Programatik test ve denetim için yalnız okuma API'si.
window.HK_APP={getState:()=>cloned(state),getRows:id=>{const r=state.races.find(x=>x.id===id);return r?currentRows(r):[];},setRace,exportPng};
render();initCustom().catch(()=>{});
})();
