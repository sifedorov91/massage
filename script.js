const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  adminPassword: null,
  userToken: localStorage.getItem('user_token') || null,
  userName: localStorage.getItem('user_name') || null,
};

function daysInMonth(y,m){return new Date(y,m,0).getDate()}
function firstWeekday(y,m){const d=new Date(y,m-1,1).getDay();return d===0?6:d-1}
function pad(n){return n.toString().padStart(2,'0')}
function todayStr(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}

function maskPhone(el){
  let d=el.value.replace(/\D/g,'');
  if(d.startsWith('7'))d=d.slice(1);
  if(d.length>10)d=d.slice(0,10);
  let r='';
  if(d.length>0)r='('+d.slice(0,3);
  if(d.length>3)r+=')-'+d.slice(3,6);
  if(d.length>6)r+='-'+d.slice(6,8);
  if(d.length>8)r+='-'+d.slice(8);
  el.value=r;
}

function showView(view){
  document.getElementById('main-section').classList.toggle('active',view==='main');
  document.getElementById('admin-section').classList.toggle('active',view==='admin');
  document.getElementById('nav-main').classList.toggle('active',view==='main');
  document.getElementById('nav-admin').classList.toggle('active',view==='admin');
  const url=view==='admin'?'/admin':'/';
  history.pushState(null,'',url);
  if(view==='admin'){
    if(state.adminPassword)loadAdminPanel();
  }else{
    renderCalendar();
  }
}

function initView(){
  const path=window.location.pathname;
  if(path==='/admin')showView('admin');
  else showView('main');
}

function updateAuthUI(){
  const userEl=document.getElementById('nav-auth-user');
  const regBtn=document.getElementById('nav-auth-register');
  const loginBtn=document.getElementById('nav-auth-login');
  const logoutBtn=document.getElementById('nav-auth-logout');
  if(state.userToken && state.userName){
    userEl.style.display='inline';
    userEl.textContent=state.userName;
    regBtn.style.display='none';
    loginBtn.style.display='none';
    logoutBtn.style.display='inline-block';
  }else{
    userEl.style.display='none';
    regBtn.style.display='inline-block';
    loginBtn.style.display='inline-block';
    logoutBtn.style.display='none';
  }
}

function closeModalById(id){
  document.getElementById(id).classList.remove('active');
}

function openLoginModal(){
  document.getElementById('login-phone').value='';
  document.getElementById('login-password').value='';
  document.getElementById('login-error').style.display='none';
  document.getElementById('login-submit').disabled=false;
  document.getElementById('login-modal-overlay').classList.add('active');
}

function openRegisterModal(){
  document.getElementById('reg-name').value='';
  document.getElementById('reg-phone').value='';
  document.getElementById('reg-password').value='';
  document.getElementById('register-error').style.display='none';
  document.getElementById('register-submit').disabled=false;
  document.getElementById('register-modal-overlay').classList.add('active');
}

async function submitLogin(){
  const phone=document.getElementById('login-phone').value.trim();
  const password=document.getElementById('login-password').value;
  const errEl=document.getElementById('login-error');
  if(!phone){errEl.textContent='Укажите телефон';errEl.style.display='block';return}
  if(!password){errEl.textContent='Укажите пароль';errEl.style.display='block';return}
  errEl.style.display='none';
  const btn=document.getElementById('login-submit');
  btn.disabled=true;btn.textContent='Вход...';
  try{
    const data=await fetchJSON('/api/auth/login',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({phone,password}),
    });
    state.userToken=data.token;
    state.userName=data.full_name;
    localStorage.setItem('user_token',data.token);
    localStorage.setItem('user_name',data.full_name);
    closeModalById('login-modal-overlay');
    updateAuthUI();
    showToast('Вы вошли как '+data.full_name,'success');
  }catch(e){
    errEl.textContent=e.message;errEl.style.display='block';
    btn.disabled=false;btn.textContent='Войти';
  }
}

async function submitRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const phone=document.getElementById('reg-phone').value.trim();
  const password=document.getElementById('reg-password').value;
  const errEl=document.getElementById('register-error');
  if(!name){errEl.textContent='Укажите ФИО';errEl.style.display='block';return}
  if(!phone){errEl.textContent='Укажите телефон';errEl.style.display='block';return}
  if(password.length<4){errEl.textContent='Минимум 4 символа';errEl.style.display='block';return}
  errEl.style.display='none';
  const btn=document.getElementById('register-submit');
  btn.disabled=true;btn.textContent='Регистрация...';
  try{
    const data=await fetchJSON('/api/auth/register',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({full_name:name,phone,password}),
    });
    state.userToken=data.token;
    state.userName=data.full_name;
    localStorage.setItem('user_token',data.token);
    localStorage.setItem('user_name',data.full_name);
    closeModalById('register-modal-overlay');
    updateAuthUI();
    showToast('Регистрация успешна!','success');
  }catch(e){
    errEl.textContent=e.message;errEl.style.display='block';
    btn.disabled=false;btn.textContent='Зарегистрироваться';
  }
}

function logoutUser(){
  state.userToken=null;
  state.userName=null;
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_name');
  updateAuthUI();
  showToast('Вы вышли','success');
}

async function fetchJSON(url, opts){
  const r=await fetch(url, opts);
  if(!r.ok){const e=await r.json().catch(()=>({detail:'Ошибка сервера'}));throw new Error(e.detail||'Ошибка сервера')}
  return r.json()
}

function showToast(msg,type){
  const c=document.getElementById('toast-container');
  const t=document.createElement('div');
  t.className='toast '+type;
  t.textContent=msg;
  c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300)},3000)
}

async function renderCalendar(){
  const el=document.getElementById('calendar');
  const loading=document.getElementById('calendar-loading');
  loading.style.display='block';
  document.getElementById('month-label').textContent=MONTHS[state.month-1]+' '+state.year;

  try{
    const data=await fetchJSON(`/api/calendar?year=${state.year}&month=${state.month}`);
    loading.style.display='none';
    renderCalendarGrid(data.days);
  }catch(e){
    loading.textContent='Ошибка загрузки календаря';
    showToast(e.message,'error');
  }
}

function renderCalendarGrid(days){
  const el=document.getElementById('calendar');
  el.innerHTML='';

  DAY_NAMES.forEach(n=>{
    const d=document.createElement('div');
    d.className='day-header';
    d.textContent=n;
    el.appendChild(d);
  });

  const fw=firstWeekday(state.year,state.month);
  for(let i=0;i<fw;i++){
    const d=document.createElement('div');
    d.className='day-cell empty';
    el.appendChild(d);
  }

  const dim=daysInMonth(state.year,state.month);
  const today=todayStr();

  for(let day=1;day<=dim;day++){
    const cell=document.createElement('div');
    const key=String(day);
    const info=days[key];
    const dateStr=state.year+'-'+pad(state.month)+'-'+pad(day);

    if(info.is_past){
      cell.className='day-cell past';
    }else if(info.is_full){
      cell.className='day-cell booked';
      cell.title='Нет свободных мест';
    }else{
      cell.className='day-cell available';
      cell.dataset.date=dateStr;
      cell.addEventListener('click',()=>openBooking(dateStr,info.slots_remaining));
    }

    if(dateStr===today)cell.classList.add('today');
    cell.textContent=day;
    if(info&&!info.is_past&&info.slots_remaining>0&&info.slots_remaining<=3){
      const badge=document.createElement('span');
      badge.className='slot-count';
      badge.textContent='+'+info.slots_remaining;
      cell.appendChild(badge);
    }
    el.appendChild(cell);
  }
}

function prevMonth(){
  state.month--;
  if(state.month<1){state.month=12;state.year--}
  renderCalendar()
}

function nextMonth(){
  state.month++;
  if(state.month>12){state.month=1;state.year++}
  renderCalendar()
}

async function openBooking(dateStr,slotsRemaining){
  document.getElementById('modal-date-info').textContent='Дата: '+dateStr;

  const guestFields=document.getElementById('booking-guest-fields');
  const userInfo=document.getElementById('booking-user-info');
  if(state.userToken){
    guestFields.style.display='none';
    userInfo.style.display='block';
    userInfo.textContent='Запись от имени: '+state.userName;
  }else{
    guestFields.style.display='block';
    userInfo.style.display='none';
    document.getElementById('modal-name').value='';
    document.getElementById('modal-phone').value='';
  }

  document.getElementById('modal-error').style.display='none';
  document.getElementById('modal-submit').disabled=true;
  document.getElementById('modal-submit').textContent='Загрузка...';
  document.getElementById('modal-overlay').classList.add('active');

  const sel=document.getElementById('modal-time');
  sel.innerHTML='<option value="">Загрузка...</option>';

  try{
    const data=await fetchJSON(`/api/available-slots?date_str=${dateStr}`);
    sel.innerHTML='<option value="">Выберите время</option>';
    data.available_slots.forEach(t=>{
      const opt=document.createElement('option');
      opt.value=t;
      opt.textContent=t;
      sel.appendChild(opt);
    });
    document.getElementById('modal-submit').disabled=false;
    document.getElementById('modal-submit').textContent='Записаться';
    if(data.available_slots.length===0){
      sel.innerHTML='<option value="">Нет свободных слотов</option>';
      document.getElementById('modal-submit').disabled=true;
    }
  }catch(e){
    sel.innerHTML='<option value="">Ошибка загрузки</option>';
    showToast(e.message,'error');
    document.getElementById('modal-submit').disabled=false;
    document.getElementById('modal-submit').textContent='Записаться';
  }
}

function closeModal(){
  document.getElementById('modal-overlay').classList.remove('active')
}

async function submitBooking(){
  const time=document.getElementById('modal-time').value;
  const dateText=document.getElementById('modal-date-info').textContent.replace('Дата: ','');
  const errEl=document.getElementById('modal-error');
  let body;

  if(state.userToken){
    if(!time){errEl.textContent='Выберите время';errEl.style.display='block';return}
    body={token:state.userToken, date:dateText, time};
  }else{
    const name=document.getElementById('modal-name').value.trim();
    const rawPhone=document.getElementById('modal-phone').value.replace(/\D/g,'');
    const phone='+7'+rawPhone;
    if(!name){errEl.textContent='Укажите ФИО';errEl.style.display='block';return}
    if(!rawPhone||rawPhone.length<10){errEl.textContent='Укажите телефон полностью';errEl.style.display='block';return}
    if(!time){errEl.textContent='Выберите время';errEl.style.display='block';return}
    body={full_name:name, phone, date:dateText, time};
  }

  errEl.style.display='none';
  const btn=document.getElementById('modal-submit');
  btn.disabled=true;
  btn.textContent='Отправка...';

  try{
    await fetchJSON('/api/book',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body),
    });
    closeModal();
    showToast('Запись успешно создана!','success');
    renderCalendar();
  }catch(e){
    errEl.textContent=e.message;
    errEl.style.display='block';
    btn.disabled=false;
    btn.textContent='Записаться';
  }
}

function adminLogin(){
  const pw=document.getElementById('admin-password-input').value;
  const errEl=document.getElementById('admin-login-error');
  if(!pw){errEl.textContent='Введите пароль';errEl.style.display='block';return}
  state.adminPassword=pw;
  loadAdminPanel();
}

async function loadAdminPanel(){
  document.getElementById('admin-login').style.display='none';
  document.getElementById('admin-panel').style.display='block';
  adminSwitchTab('bookings');
}

function adminSwitchTab(tab){
  document.getElementById('admin-tab-bookings').classList.toggle('active',tab==='bookings');
  document.getElementById('admin-tab-users').classList.toggle('active',tab==='users');
  document.getElementById('admin-bookings-section').style.display=tab==='bookings'?'block':'none';
  document.getElementById('admin-users-section').style.display=tab==='users'?'block':'none';
  if(tab==='bookings')loadAdminBookings();
  else loadAdminUsers();
}

async function loadAdminBookings(){
  const loading=document.getElementById('admin-loading');
  const tbody=document.getElementById('admin-table-body');
  loading.style.display='block';
  tbody.innerHTML='';

  try{
    const data=await fetchJSON(`/api/admin/bookings?password=${encodeURIComponent(state.adminPassword)}`);
    loading.style.display='none';
    if(data.bookings.length===0){
      tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:#888;padding:20px">Нет броней</td></tr>';
      return;
    }
    data.bookings.forEach(b=>{
      const tr=document.createElement('tr');
      const confirmed=!!b.is_confirmed;
      const clientName=b.user_name||b.full_name;
      const clientPhone=b.user_phone||b.phone;
      tr.innerHTML=`
        <td>${escapeHtml(clientName)}${b.user_name?'':' <span style="color:#999;font-size:.75rem">(гость)</span>'}</td>
        <td>${escapeHtml(clientPhone)}</td>
        <td>${b.appointment_date}</td>
        <td>${b.appointment_time}</td>
        <td class="${confirmed?'status-confirmed':'status-pending'}">${confirmed?'Подтверждено':'Не подтверждено'}</td>
        <td>
          <div class="admin-actions">
            ${confirmed?'':'<button class="btn-confirm" onclick="adminConfirm('+b.id+')">Подтвердить</button>'}
            <button class="btn-delete" onclick="adminDelete(${b.id})">Отменить</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }catch(e){
    loading.style.display='none';
    if(e.message==='Неверный пароль'){
      document.getElementById('admin-login').style.display='block';
      document.getElementById('admin-panel').style.display='none';
      const errEl=document.getElementById('admin-login-error');
      errEl.textContent='Неверный пароль';
      errEl.style.display='block';
      state.adminPassword=null;
    }else{
      showToast(e.message,'error');
    }
  }
}

async function loadAdminUsers(){
  const loading=document.getElementById('admin-users-loading');
  const tbody=document.getElementById('admin-users-body');
  loading.style.display='block';
  tbody.innerHTML='';

  try{
    const data=await fetchJSON(`/api/admin/users?password=${encodeURIComponent(state.adminPassword)}`);
    loading.style.display='none';
    if(data.users.length===0){
      tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#888;padding:20px">Нет пользователей</td></tr>';
      return;
    }
    data.users.forEach(u=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(u.phone)}</td>
        <td>${u.bookings_count}</td>
        <td>${u.created_at}</td>
        <td><button class="btn-delete" onclick="adminDeleteUser(${u.id})">Удалить</button></td>
      `;
      tbody.appendChild(tr);
    });
  }catch(e){
    loading.style.display='none';
    showToast(e.message,'error');
  }
}

async function adminDeleteUser(id){
  if(!confirm('Удалить пользователя и все его записи?'))return;
  try{
    await fetchJSON(`/api/admin/user/${id}?password=${encodeURIComponent(state.adminPassword)}`,{method:'DELETE'});
    showToast('Пользователь удалён','success');
    loadAdminUsers();
    loadAdminBookings();
  }catch(e){showToast(e.message,'error')}
}

async function adminConfirm(id){
  try{
    await fetchJSON(`/api/admin/confirm/${id}?password=${encodeURIComponent(state.adminPassword)}`,{method:'POST'});
    showToast('Бронь подтверждена','success');
    loadAdminPanel();
  }catch(e){showToast(e.message,'error')}
}

async function adminDelete(id){
  if(!confirm('Удалить бронь?'))return;
  try{
    await fetchJSON(`/api/admin/delete/${id}?password=${encodeURIComponent(state.adminPassword)}`,{method:'DELETE'});
    showToast('Бронь отменена','success');
    loadAdminPanel();
  }catch(e){showToast(e.message,'error')}
}

function showChangePassword(){
  document.getElementById('pw-current').value='';
  document.getElementById('pw-new').value='';
  document.getElementById('pw-confirm').value='';
  document.getElementById('pw-error').style.display='none';
  document.getElementById('pw-submit').disabled=false;
  document.getElementById('pw-submit').textContent='Сменить';
  document.getElementById('pw-modal-overlay').classList.add('active');
}

function closePwModal(){
  document.getElementById('pw-modal-overlay').classList.remove('active');
}

async function submitChangePassword(){
  const cur=document.getElementById('pw-current').value;
  const p1=document.getElementById('pw-new').value;
  const p2=document.getElementById('pw-confirm').value;
  const errEl=document.getElementById('pw-error');

  if(!cur){errEl.textContent='Введите текущий пароль';errEl.style.display='block';return}
  if(!p1){errEl.textContent='Введите новый пароль';errEl.style.display='block';return}
  if(p1.length<4){errEl.textContent='Минимум 4 символа';errEl.style.display='block';return}
  if(p1!==p2){errEl.textContent='Пароли не совпадают';errEl.style.display='block';return}

  errEl.style.display='none';
  const btn=document.getElementById('pw-submit');
  btn.disabled=true;
  btn.textContent='Сохранение...';

  try{
    const data=await fetchJSON('/api/admin/change-password',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({current_password:cur,new_password:p1}),
    });
    closePwModal();
    showToast('Пароль успешно изменён','success');
    state.adminPassword=p1;
  }catch(e){
    errEl.textContent=e.message;
    errEl.style.display='block';
    btn.disabled=false;
    btn.textContent='Сменить';
  }
}

function escapeHtml(s){
  const d=document.createElement('div');
  d.textContent=s;
  return d.innerHTML
}

window.addEventListener('popstate',()=>initView());
initView();
updateAuthUI();

if(state.userToken){
  fetchJSON('/api/auth/me?token='+encodeURIComponent(state.userToken)).catch(()=>{
    state.userToken=null;
    state.userName=null;
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_name');
    updateAuthUI();
  });
}
