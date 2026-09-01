import fs from 'node:fs/promises'
import { Presentation, PresentationFile } from '@oai/artifact-tool'

const OUT = 'D:/cropai/CropAI_SIH_26131_Trouble_Shooters.pptx'
const RENDER = 'D:/cropai/ppt-build/rendered'
const SCREENSHOT = 'C:/Users/dell/AppData/Local/Temp/codex-clipboard-76db22f4-da7b-41d5-8ff3-fe9a15d3a1a4.png'
const W=1280,H=720, GREEN='#173D2B', LIME='#79C98B', CREAM='#F6F2E8', INK='#13231A', MUTED='#607268', ORANGE='#E67E3F', PALE='#E7F2E9'
const p = Presentation.create({ slideSize:{width:W,height:H} })

function box(slide,x,y,w,h,fill='none',stroke='none',radius='roundRect') { return slide.shapes.add({geometry:radius,position:{left:x,top:y,width:w,height:h},fill,line:{style:'solid',fill:stroke,width:stroke==='none'?0:1}}) }
function text(slide,txt,x,y,w,h,size=22,color=INK,bold=false,align='left') { const s=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{style:'solid',fill:'none',width:0}}); s.text=txt; s.text.style={fontSize:size,fontFamily:'Arial',color,bold,alignment:align,verticalAlignment:'middle'}; return s }
function title(slide,kicker,headline,num){ text(slide,kicker.toUpperCase(),64,38,700,24,13,GREEN,true); text(slide,headline,64,72,1110,66,38,INK,true); text(slide,String(num).padStart(2,'0'),1180,42,40,24,13,MUTED,true,'right'); box(slide,64,146,1152,2,GREEN,'none','rect') }
function footer(slide){ text(slide,'TROUBLE SHOOTERS  •  SIH 26131',64,676,440,18,11,MUTED,true); text(slide,'CropAI Maharashtra',1010,676,206,18,11,MUTED,true,'right') }
function notes(slide,lines,sources=[]){ slide.speakerNotes.textFrame.setText([...lines,'','[Sources]',...sources]); slide.speakerNotes.setVisible(false) }

// 1 — cover
{
 const s=p.slides.add(); s.background.fill=GREEN
 text(s,'SMART INDIA HACKATHON',72,54,560,28,15,LIME,true)
 text(s,'CropAI',72,164,560,92,72,CREAM,true)
 text(s,'Detect earlier. Act safely.\nEscalate intelligently.',72,260,640,112,34,CREAM,true)
 box(s,72,410,520,4,LIME,'none','rect')
 text(s,'Early detection and management of crop diseases and pest infestations',72,438,680,70,22,'#DDE9E1',false)
 text(s,'Problem Statement 26131  |  Software\nGovernment of Maharashtra  |  Agriculture, FoodTech & Rural Development',72,548,780,58,16,'#BBD0C2',false)
 text(s,'TROUBLE\nSHOOTERS',990,526,218,82,23,LIME,true,'right')
 notes(s,['Open with the farmer outcome: earlier recognition, safer action, and expert escalation.','Do not begin with the technology stack.'],['SIH problem statement details supplied by the team.'])
}

// 2 — problem
{
 const s=p.slides.add(); s.background.fill=CREAM; title(s,'The challenge','The dangerous gap is between first symptom and trusted action',2)
 text(s,'01',64,190,80,60,46,ORANGE,true); text(s,'Symptoms begin quietly',154,188,470,40,27,INK,true); text(s,'Farmers often act only after visible damage has spread across the plot.',154,232,460,64,19,MUTED)
 text(s,'02',64,330,80,60,46,ORANGE,true); text(s,'Expert capacity is stretched',154,328,470,40,27,INK,true); text(s,'Extension workers cover large areas; laboratory confirmation takes time.',154,372,460,64,19,MUTED)
 text(s,'03',64,470,80,60,46,ORANGE,true); text(s,'A wrong answer can worsen loss',154,468,470,40,27,INK,true); text(s,'Similar symptoms may come from disease, pests, nutrients, water or weather.',154,512,470,64,19,MUTED)
 box(s,710,188,470,390,PALE,GREEN); text(s,'What farmers need',752,226,390,36,24,GREEN,true)
 text(s,'EARLY',752,292,180,44,35,GREEN,true); text(s,'recognition',934,296,180,36,21,MUTED)
 text(s,'SAFE',752,372,180,44,35,GREEN,true); text(s,'next action',934,376,180,36,21,MUTED)
 text(s,'HUMAN',752,452,180,44,35,GREEN,true); text(s,'backup when AI is unsure',934,448,190,62,21,MUTED)
 footer(s); notes(s,['Frame the problem as a decision-delay problem, not only an image-classification problem.'],['Problem description supplied by Government of Maharashtra / team brief.'])
}

// 3 — solution/prototype
{
 const s=p.slides.add(); s.background.fill='#FFFFFF'; title(s,'Our solution','CropAI closes the loop from field evidence to verified guidance',3)
 const bytes=await fs.readFile(SCREENSHOT); s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt:'Working CropAI dashboard in dark mode',fit:'cover',position:{left:64,top:184,width:690,height:390},geometry:'roundRect',borderRadius:'rounded-xl'})
 text(s,'A working Firebase PWA—not a concept mock-up',794,184,400,62,27,GREEN,true)
 const items=['Guided close-up + whole-plant capture','Crop, farm, soil, irrigation & symptoms','Marathi / Hindi / English + voice input','Confidence gate: diagnose or safely abstain','Expert review and private farmer alerts','Offline draft queue for weak connectivity']
 items.forEach((v,i)=>{ text(s,'✓',794,266+i*49,28,28,20,GREEN,true); text(s,v,832,262+i*49,355,38,18,INK,false) })
 box(s,794,570,400,54,GREEN,'none'); text(s,'Prototype ready for live demonstration',814,580,360,32,18,CREAM,true,'center')
 footer(s); notes(s,['Show the live product after this slide.','Emphasize that unvalidated model outputs fail closed; the system never invents a diagnosis.'],['Prototype screenshot: CropAI project, captured 31 Aug 2026.'])
}

// 4 — flow
{
 const s=p.slides.add(); s.background.fill=CREAM; title(s,'How it works','Five checks turn a photo into a safer farm decision',4)
 const steps=[['1','CAPTURE','2–3 guided views'],['2','CONTEXT','Farm + crop + symptoms'],['3','VERIFY','Quality + scope checks'],['4','DECIDE','Diagnosis or safe refusal'],['5','ACT','IPM guidance or expert']]
 steps.forEach((a,i)=>{ const x=64+i*232; box(s,x,216,202,214,i===3?GREEN:'#FFFFFF',i===3?GREEN:'#B7C9BC'); text(s,a[0],x+18,234,42,42,28,i===3?LIME:ORANGE,true); text(s,a[1],x+18,298,166,30,22,i===3?CREAM:GREEN,true); text(s,a[2],x+18,344,166,52,17,i===3?'#DDE9E1':MUTED,false); if(i<4) text(s,'›',x+202,292,30,48,36,GREEN,true,'center') })
 box(s,112,492,1056,104,PALE,'none'); text(s,'Every uncertain case becomes useful evidence',144,510,450,32,25,GREEN,true); text(s,'Expert corrections improve the dataset; privacy-thresholded signals reveal emerging taluka-level outbreaks.',144,548,946,32,18,MUTED)
 footer(s); notes(s,['Walk left to right. The differentiator is the confidence gate between verification and action.','Explain that expert corrections create a governed learning loop.'],['CropAI repository architecture and implemented scan workflow.'])
}

// 5 — differentiation
{
 const s=p.slides.add(); s.background.fill='#FFFFFF'; title(s,'Why CropAI','We combine capabilities that existing tools leave disconnected',5)
 const xs=[64,380,650,910], widths=[300,254,244,306]
 ;['Capability','Plantix / Nuru','NPSS','CropAI'].forEach((h,i)=>{ box(s,xs[i],182,widths[i],48,i===3?GREEN:'#E8ECE9','none','rect'); text(s,h,xs[i]+14,190,widths[i]-28,30,18,i===3?CREAM:INK,true) })
 const rows=[['Field image diagnosis','Strong','Strong','Guided multi-view'],['Works in low connectivity','Nuru: offline','Limited evidence','Offline drafts + sync'],['Local farmer experience','Multilingual','National app','Marathi voice-first'],['Uncertainty handling','Varies','Advisory workflow','Fail-safe abstention'],['Expert correction loop','Available','Government network','Built into each case'],['Privacy-aware outbreaks','Commercial signals','National surveillance','Taluka thresholding']]
 rows.forEach((r,ri)=>r.forEach((v,i)=>{ const y=238+ri*61; box(s,xs[i],y,widths[i],57,ri%2?'#F7F8F7':'#EEF4EF','#D8E1DA','rect'); text(s,v,xs[i]+14,y+8,widths[i]-28,41,16,i===3?GREEN:(i===0?INK:MUTED),i===0||i===3) }))
 text(s,'Positioning: trusted Maharashtra crop-care workflow—not another generic classifier.',64,624,1110,32,23,GREEN,true,'center')
 footer(s); notes(s,['Do not attack competitors; show the integration gap CropAI addresses.'],['Plantix official features: https://plantix.net/en/download/','PlantVillage Nuru / CGIAR: https://bigdata.cgiar.org/inspire/inspire-challenge-2017/pest-and-disease-monitoring-by-using-artificial-intelligence/','NPSS, Press Information Bureau, 25 Mar 2025: https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2114896&lang=2&reg=48'])
}

// 6 — engineering readiness
{
 const s=p.slides.add(); s.background.fill=CREAM; title(s,'Feasibility','The prototype is deployable; model release remains evidence-gated',6)
 text(s,'BUILT NOW',64,184,300,28,16,GREEN,true); const built=['React installable PWA','Firebase Auth + verified users','Firestore tenant isolation','Private image quarantine','Cloud Functions scan lifecycle','Expert/admin role workflows']
 built.forEach((v,i)=>{ text(s,'●',70,230+i*48,20,24,14,LIME,true); text(s,v,100,226+i*48,330,30,18,INK) })
 text(s,'CONTROLLED RELEASE',478,184,330,28,16,ORANGE,true); const controlled=['Six Maharashtra-priority crop models','Independent field-set validation','Per-class recall & macro-F1 gates','Unknown / out-of-scope detection','Model + dataset checksums']
 controlled.forEach((v,i)=>{ text(s,'●',484,230+i*54,20,24,14,ORANGE,true); text(s,v,514,226+i*54,320,40,18,INK) })
 box(s,872,184,344,390,GREEN,'none'); text(s,'TECH STACK',902,214,284,28,16,LIME,true); text(s,'Vite + React\nFirebase Auth / Firestore\nCloud Storage + Functions\nPrivate Cloud Run inference\nONNX model packages\nFCM alerts + PWA offline',902,260,282,240,23,CREAM,true)
 text(s,'Security rules: 11 / 11 tests passed',902,520,282,28,17,'#DDE9E1',true)
 footer(s); notes(s,['Be transparent: the platform is working, while disease models must pass field validation before release.','This honesty is a safety and feasibility strength, not a weakness.'],['CropAI repository README and verified local build/security test results.'])
}

// 7 — impact and close
{
 const s=p.slides.add(); s.background.fill=GREEN
 text(s,'THE OUTCOME',64,46,400,24,14,LIME,true); text(s,'Earlier action. Safer advice.\nStronger extension reach.',64,82,780,112,43,CREAM,true)
 const outcomes=[['FARMER','Understands what to do next in their language'],['EXPERT','Prioritizes uncertain and high-risk cases'],['GOVERNMENT','Sees privacy-safe emerging outbreak signals']]
 outcomes.forEach((a,i)=>{ const x=64+i*384; box(s,x,260,350,156,'#214D38','#47745A'); text(s,a[0],x+24,282,300,26,15,LIME,true); text(s,a[1],x+24,326,300,64,21,CREAM,true) })
 text(s,'90-DAY PILOT',64,476,190,26,15,LIME,true); text(s,'1 district  →  6 priority crops  →  KVK expert validation  →  measurable follow-up outcomes',64,514,1100,52,24,CREAM,true)
 box(s,64,606,1152,2,LIME,'none','rect'); text(s,'Trouble Shooters',64,626,340,30,22,LIME,true); text(s,'Let Maharashtra farmers act before damage spreads.',520,622,696,38,24,CREAM,true,'right')
 notes(s,['Close by asking for a district pilot and access to agricultural experts/field images.','Suggested pilot metrics: image completion rate, expert turnaround, safe-refusal rate, and farmer-reported recovery.'],['SIH evaluation criteria: novelty, feasibility, practicability, sustainability, impact, UX and future progression — https://sih.gov.in/letters/Guidelines-College-SPOC.pdf'])
}

await fs.mkdir(RENDER,{recursive:true})
for (const [i,s] of p.slides.items.entries()){ const blob=await p.export({slide:s,format:'png',scale:1}); await fs.writeFile(`${RENDER}/slide-${i+1}.png`,new Uint8Array(await blob.arrayBuffer())); const layout=await s.export({format:'layout'}); await fs.writeFile(`${RENDER}/slide-${i+1}.layout.json`,await layout.text()) }
const montage=await p.export({format:'webp',montage:true,scale:1}); await fs.writeFile('D:/cropai/ppt-build/montage.webp',new Uint8Array(await montage.arrayBuffer()))
const pptx=await PresentationFile.exportPptx(p); await pptx.save(OUT)
