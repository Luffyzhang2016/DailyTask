const STORAGE_KEY='daymark-state-v1';
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const iso=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parseDate=value=>{const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d)};
const todayIso=()=>iso(new Date());
const seedTasks=()=>[
  {id:uid(),title:'晨间拉伸',type:'repeat',deadline:'07:30'},
  {id:uid(),title:'喝水 8 杯',type:'repeat',deadline:''},
  {id:uid(),title:'整理明日计划',type:'repeat',deadline:'21:30'},
  {id:uid(),title:'提交周报',type:'specific',date:todayIso(),deadline:'18:00'},
  {id:uid(),title:'预约牙医',type:'specific',date:todayIso(),deadline:'20:30'}
];
const defaultState=()=>({theme:'morning',selectedDate:todayIso(),month:`${todayIso().slice(0,7)}-01`,tasks:seedTasks(),completions:{}});
let state=loadState();
let toastTimer;

function loadState(){try{return {...defaultState(),...JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}}catch{return defaultState()}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
const tasksFor=date=>state.tasks.filter(task=>task.type==='repeat'||task.date===date);
const done=(taskId,date)=>Boolean(state.completions[date]?.includes(taskId));
function setDone(taskId,date,value){const set=new Set(state.completions[date]||[]);value?set.add(taskId):set.delete(taskId);state.completions[date]=[...set];saveState()}
function completionFor(date){const tasks=tasksFor(date);const complete=tasks.filter(task=>done(task.id,date)).length;return {tasks,complete,all:tasks.length>0&&complete===tasks.length}}

const calendarHeading=document.querySelector('#calendar-heading');
const calendarGrid=document.querySelector('#calendar-grid');
const selectedHeading=document.querySelector('#selected-date-heading');
const dateContext=document.querySelector('#date-context');
const repeatList=document.querySelector('#repeat-list');
const specificList=document.querySelector('#specific-list');
const emptyState=document.querySelector('#empty-state');
const taskList=document.querySelector('#task-list');
const addBottom=document.querySelector('#add-task-bottom');
const dialog=document.querySelector('#task-dialog');
const form=document.querySelector('#task-form');

function formatDate(dateString){return new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(parseDate(dateString))}
function sameDay(a,b){return a===b}
function render(){document.documentElement.dataset.theme=state.theme;document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===state.theme)));renderCalendar();renderTasks()}
function renderCalendar(){const month=parseDate(state.month);calendarHeading.textContent=`${month.getFullYear()}年${month.getMonth()+1}月`;calendarGrid.replaceChildren();const first=new Date(month.getFullYear(),month.getMonth(),1);const start=new Date(first);start.setDate(1-first.getDay());for(let i=0;i<42;i++){const date=new Date(start);date.setDate(start.getDate()+i);const dateString=iso(date);const status=completionFor(dateString);const button=document.createElement('button');button.className='calendar-day';button.setAttribute('role','gridcell');button.dataset.date=dateString;if(date.getMonth()!==month.getMonth())button.classList.add('outside');if(sameDay(dateString,state.selectedDate))button.classList.add('selected');if(sameDay(dateString,todayIso()))button.classList.add('today');button.setAttribute('aria-label',`${formatDate(dateString)}${status.all?'，全部完成':status.tasks.length?'，有未完成任务':'，没有任务'}`);button.innerHTML=`<span class="day-number">${date.getDate()}</span>${status.all?'<span class="day-status" aria-hidden="true">⌣</span>':status.tasks.length?'<span class="day-status dot" aria-hidden="true"></span>':'<span class="day-status" aria-hidden="true"></span>'}`;button.addEventListener('click',()=>{state.selectedDate=dateString;state.month=`${dateString.slice(0,7)}-01`;saveState();render();showMobileView('today')});calendarGrid.append(button)}}

function renderTasks(){const selected=parseDate(state.selectedDate);selectedHeading.textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric'}).format(selected);dateContext.textContent=sameDay(state.selectedDate,todayIso())?'今天':new Intl.DateTimeFormat('zh-CN',{weekday:'long'}).format(selected);const {tasks,complete,all}=completionFor(state.selectedDate);const repeat=tasks.filter(task=>task.type==='repeat');const specific=tasks.filter(task=>task.type==='specific');renderGroup(repeatList,repeat);renderGroup(specificList,specific);document.querySelector('#repeat-count').textContent=repeat.length?`${repeat.filter(task=>done(task.id,state.selectedDate)).length}/${repeat.length}`:'';document.querySelector('#specific-count').textContent=specific.length?`${specific.filter(task=>done(task.id,state.selectedDate)).length}/${specific.length}`:'';document.querySelector('#progress-count').textContent=`${complete} / ${tasks.length}`;const percent=tasks.length?Math.round(complete/tasks.length*100):0;document.querySelector('#progress-bar').style.transform=`scaleX(${percent/100})`;document.querySelector('.progress-track').setAttribute('aria-valuenow',String(percent));document.querySelector('#complete-message').hidden=!all;emptyState.hidden=tasks.length>0;taskList.hidden=tasks.length===0;addBottom.hidden=tasks.length===0}
function renderGroup(container,tasks){container.replaceChildren();for(const task of tasks){const isDone=done(task.id,state.selectedDate);const overdue=!isDone&&task.deadline&&state.selectedDate<=todayIso()&&(state.selectedDate<todayIso()||task.deadline<new Date().toTimeString().slice(0,5));const row=document.createElement('article');row.className=`task-row${isDone?' completed':''}${overdue?' overdue':''}`;row.innerHTML=`<button class="check-button" aria-pressed="${isDone}" aria-label="${isDone?'标记为未完成':'标记为完成'}：${escapeHtml(task.title)}"><span class="check-visual" aria-hidden="true">✓</span></button><div class="task-copy"><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta">${task.type==='repeat'?'<span>每天</span>':''}${isDone?'<span>已完成</span>':overdue?'<span>已逾期</span>':''}</div></div><time class="deadline">${task.deadline||''}</time><button class="icon-button edit-button" aria-label="编辑任务：${escapeHtml(task.title)}">⋯</button>`;row.querySelector('.check-button').addEventListener('click',()=>{setDone(task.id,state.selectedDate,!isDone);render();showToast(!isDone?'任务已完成':'已恢复为未完成')});row.querySelector('.edit-button').addEventListener('click',()=>openTaskDialog(task));container.append(row)}}
function escapeHtml(text){const div=document.createElement('div');div.textContent=text;return div.innerHTML}

function openTaskDialog(task=null){form.reset();document.querySelector('#task-dialog-title').textContent=task?'编辑任务':'添加任务';document.querySelector('#task-id').value=task?.id||'';document.querySelector('#task-title').value=task?.title||'';document.querySelector('#task-deadline').value=task?.deadline||'';const type=task?.type||'repeat';form.elements['task-type'].value=type;document.querySelector('#task-date').value=task?.date||state.selectedDate;document.querySelector('#delete-task').hidden=!task;document.querySelector('#task-error').hidden=true;toggleDateField();dialog.showModal();setTimeout(()=>document.querySelector('#task-title').focus(),0)}
function toggleDateField(){document.querySelector('#date-field').hidden=form.elements['task-type'].value!=='specific'}
form.addEventListener('change',event=>{if(event.target.name==='task-type')toggleDateField()});
form.addEventListener('submit',event=>{event.preventDefault();const title=document.querySelector('#task-title').value.trim();const type=form.elements['task-type'].value;const date=document.querySelector('#task-date').value;if(!title){showFormError('请输入任务名称');return}if(type==='specific'&&!date){showFormError('请选择任务执行日期');return}const id=document.querySelector('#task-id').value;const task={id:id||uid(),title,type,deadline:document.querySelector('#task-deadline').value,...(type==='specific'?{date}:{})};if(id){const index=state.tasks.findIndex(item=>item.id===id);state.tasks[index]=task}else state.tasks.push(task);saveState();dialog.close();render();showToast(id?'任务已保存':'任务已添加')});
function showFormError(message){const error=document.querySelector('#task-error');error.textContent=message;error.hidden=false}
document.querySelector('#delete-task').addEventListener('click',()=>{const id=document.querySelector('#task-id').value;if(!id)return;state.tasks=state.tasks.filter(task=>task.id!==id);Object.keys(state.completions).forEach(date=>state.completions[date]=state.completions[date].filter(taskId=>taskId!==id));saveState();dialog.close();render();showToast('任务已删除')});
['#add-task-top','#add-task-bottom','#empty-add'].forEach(selector=>document.querySelector(selector).addEventListener('click',()=>openTaskDialog()));

document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{state.theme=button.dataset.themeChoice;saveState();render();showToast(`已切换到${button.textContent.trim()}主题`)}));
document.querySelector('#prev-month').addEventListener('click',()=>shiftMonth(-1));document.querySelector('#next-month').addEventListener('click',()=>shiftMonth(1));
function shiftMonth(amount){const date=parseDate(state.month);date.setMonth(date.getMonth()+amount);state.month=iso(new Date(date.getFullYear(),date.getMonth(),1));saveState();renderCalendar()}
document.querySelector('#today-button').addEventListener('click',()=>{state.selectedDate=todayIso();state.month=`${todayIso().slice(0,7)}-01`;saveState();render()});
document.querySelectorAll('[data-mobile-view]').forEach(button=>button.addEventListener('click',()=>showMobileView(button.dataset.mobileView)));
function showMobileView(view){if(matchMedia('(min-width: 50rem)').matches)return;document.querySelector('#today-view').style.display=view==='today'?'block':'none';document.querySelector('#calendar-view').style.display=view==='calendar'?'block':'none';document.querySelectorAll('[data-mobile-view]').forEach(button=>button.toggleAttribute('aria-current',button.dataset.mobileView===view));window.scrollTo({top:0,behavior:'smooth'})}

const accountDialog=document.querySelector('#account-dialog');document.querySelector('#account-button').addEventListener('click',()=>accountDialog.showModal());
document.querySelector('#send-code').addEventListener('click',()=>{const email=document.querySelector('#email');if(!email.checkValidity()){email.reportValidity();return}document.querySelector('#sync-note').textContent='演示验证码已发送：请输入 123456。正式版将由服务端发送邮件。';showToast('验证码已发送')});
document.querySelector('#login-form').addEventListener('submit',event=>{event.preventDefault();const code=document.querySelector('#code').value;if(code!=='123456'){document.querySelector('#sync-note').textContent='验证码不正确。演示版请输入 123456。';return}accountDialog.close();document.querySelector('#account-button span').textContent=document.querySelector('#email').value.slice(0,1).toUpperCase();showToast('已登录；当前使用本地同步演示')});

function showToast(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2200)}
const cloudAdapter={async list(){return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')},async save(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}};
window.daymarkCloudAdapter=cloudAdapter;
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();showMobileView('today');
