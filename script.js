/* ================== Inicialização e persistência ================== */
const adminUser = { username:'adm', password:'123' };

// default bookings data (com as escolas que você solicitou)
const defaultBookings = {
  'Pinhais-PR': {
    'Amyntas De Barros  C E Dep-Ef M N Profis': [],
    'Colégio Estadual Mathias Jacomel': [],
    'Colégio Estadual Humberto Alencar Castelo Branco': [],
    'Arnaldo F Busato C E Dep-Ef M N Profis': [],
  },
  'Piraquara': {
    'Colégio Estadual Ivanete Martins de Souza': [],
    'Colégio Estadual Doutor Gilberto Alves': [],
    'Joao Batista Vera Ef M N Profis': []
  },
  'Colombo-PR': {
    'Colégio Estadual Heráclito Fontoura Sobral Pinto': [],
    'Colégio Estadual de Guaraituba - E.F.M.': [],
    'Colégio Estadual Genésio Moreschi': []
  },
  'São José dos Pinhais': {
    'Lindaura R Lucas, C E Prof-Ef M': [],
    'Colégio Estadual Afonso Pena': [],
    'Colégio Estadual Anita Canet': [],
    'Colégio Estadual São Cristóvão': [],
  },
  'Curitiba': {
    'Colegio Estadual Cívico Militar Republica Oriental Do Uruguai': [],
    'Colégio Estadual Júlia Wanderley': [],
    'Colégio Estadual Professor Nilo Brandão': [],
    'Colégio Estadual Santa Rosa - Ensino Fundamento, Médio e EJA': [],
  },
  'Araucária': {
    'Colégio Estadual Profª Helena Wysocki-EFM': [],
    'Colégio Estadual Rocha Pombo': [],
    'Colégio Estadual Prof. Maria da Graça Siqueira Silva e Lima': [],
    'Colégio Estadual Professor Elzeário Pitz': [],
  },
  'Almirante Tamandaré': {
    'Colégio Estadual Professora Edimar Wright': [],
    'Colégio Estadual Professor Alberto Krause': [],
    'C.E. Cívico-Militar Professora Jaci Real Prado de Oliveira': [],
    'Colégio Estadual Theodoro de Bona': [],
  }
};

// carregar usuários (array) do localStorage
let normalUsers = JSON.parse(localStorage.getItem('usuarios') || '[]');

// carregar agendamentos (merge com default para garantir escolas novas)
let bookingsData = JSON.parse(localStorage.getItem('agendamentos') || 'null');
if(!bookingsData){
  bookingsData = defaultBookings;
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
} else {
  // merge: garantir que todas as cidades/escolas do default existam
  for(const city in defaultBookings){
    if(!bookingsData[city]) bookingsData[city] = {};
    for(const school in defaultBookings[city]){
      if(!bookingsData[city][school]) bookingsData[city][school] = [];
    }
  }
  // salvar após merge
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
}

// horários permitidos
const slots = ['09:30','9:50','10:00','10:30','10:50','11:00','11:30','14:00','14:30','15:00','15:30','16:00','17:00','18:00'];

// logged user (objeto), tentamos carregar se já havia sessão
let loggedUser = JSON.parse(localStorage.getItem('loggedUser') || 'null');
let userType = null;

// ao carregar a página, se já houver user salvo, abrir o dashboard correto
window.addEventListener('load', ()=>{
  if(loggedUser){
    document.getElementById('loginOverlay').style.display = 'none';
    if(loggedUser.username === adminUser.username && loggedUser.password === adminUser.password){
      userType = 'admin';
      document.getElementById('adminDashboard').classList.remove('hidden');
      loadAdminDashboard();
    } else {
      userType = 'user';
      // re-sincroniza referência para o objeto armazenado em normalUsers (se existir)
      const u = normalUsers.find(x => x.username === loggedUser.username);
      if(u) loggedUser = u;
      document.getElementById('userDashboard').classList.remove('hidden');
      updateNotificationIcon();
    }
  }
});

/* ================== Login / Registro ================== */
function switchLogin(type){
  userType = type;
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('loginError').classList.add('hidden');

  // 🔹 Alterar placeholder conforme tipo
  const usernameInput = document.getElementById('username');
  if (type === 'admin') {
    usernameInput.placeholder = "Digite o login do administrador";
  } else {
    usernameInput.placeholder = "Digite o login do usuário";
  }
}

function openRegister(){
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('registerScreen').classList.remove('hidden');
}

function backToLogin(){
  document.getElementById('registerScreen').classList.add('hidden');
  document.getElementById('fullName').value=''; document.getElementById('cpf').value='';
  document.getElementById('matricula').value=''; document.getElementById('registerCity').value='';
  document.getElementById('registerEmail').value=''; document.getElementById('registerPassword').value='';
  document.getElementById('loginOverlay').style.display = 'flex';
}

function registerUser(){
  const name = document.getElementById('fullName').value.trim();
  const cpf = document.getElementById('cpf').value.trim();
  const matricula = document.getElementById('matricula').value.trim();
  const city = document.getElementById('registerCity').value;
  const username = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value.trim();
  const msg = document.getElementById('registerMessage');

  if(!name||!cpf||!matricula||!city||!username||!password){ alert('Preencha todos os campos'); return; }
  if(normalUsers.find(u=>u.username===username)){ alert('Usuário já existe!'); return; }

  const newUser = { 
    name, cpf, matricula, city, username, password, 
    notifications: [], 
    createdAt: new Date().toLocaleString(),
    lastLogin: null,
    blocked: false
  };
  normalUsers.push(newUser);
  localStorage.setItem('usuarios', JSON.stringify(normalUsers));
  msg.textContent = 'Cadastro realizado com sucesso!';
  msg.classList.remove('hidden');
  setTimeout(()=>{ msg.classList.add('hidden'); backToLogin(); }, 1800);
}

function login(){
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorDiv = document.getElementById('loginError'); errorDiv.classList.add('hidden');

  if(userType === 'admin'){
    if(username === adminUser.username && password === adminUser.password){
      loggedUser = adminUser;
      localStorage.setItem('loggedUser', JSON.stringify(loggedUser));
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('adminDashboard').classList.remove('hidden');
      userType = 'admin';
      loadAdminDashboard();
    } else {
      errorDiv.textContent = 'Credenciais inválidas!'; errorDiv.classList.remove('hidden');
    }
    return;
  }

  // usuário normal
  const userIndex = normalUsers.findIndex(u=>u.username===username && u.password===password);
  if(userIndex !== -1){
    const user = normalUsers[userIndex];
    if(user.blocked){
      errorDiv.textContent = 'Conta bloqueada. Contate o administrador.'; errorDiv.classList.remove('hidden');
      return;
    }
    loggedUser = user;
    // salvo apenas credenciais mínimas para sessão
    localStorage.setItem('loggedUser', JSON.stringify({ username: user.username, password: user.password }));
    // apontar loggedUser para referência no array (para sincronizar notificações)
    const ref = normalUsers.find(u => u.username === user.username);
    if(ref) loggedUser = ref;
    // atualizar lastLogin
    normalUsers[userIndex].lastLogin = new Date().toLocaleString();
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('userDashboard').classList.remove('hidden');
    userType = 'user';
    updateNotificationIcon();
  } else {
    errorDiv.textContent = 'Credenciais inválidas!'; errorDiv.classList.remove('hidden');
  }
}

/* ================== Logout ================== */
function logout(){
  loggedUser = null;
  localStorage.removeItem('loggedUser');
  document.getElementById('adminDashboard').classList.add('hidden');
  document.getElementById('userDashboard').classList.add('hidden');
  document.getElementById('registerScreen').classList.add('hidden');
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('username').value=''; document.getElementById('password').value='';
  userType = null;
}

/* ================== Admin: listar cidades / escolas / solicitações ================== */
function loadAdminDashboard(){
  const container = document.getElementById('adminCities');
  container.innerHTML = '';
  for(const city in bookingsData){
    const cityDiv = document.createElement('div');
    cityDiv.className = 'city-column';
    let html = `<h3>${city}</h3>`;
    html += `<select onchange="loadBookings('${city}', this.value)"><option value="">Escolha uma escola</option>`;
    for(const school in bookingsData[city]) html += `<option value="${school}">${school}</option>`;
    html += `</select>`;
    html += `<div class="booking-list" id="${city}-bookings"></div>`;
    cityDiv.innerHTML = html;
    container.appendChild(cityDiv);
  }
}

function loadBookings(city, school){
  const list = document.getElementById(`${city}-bookings`);
  list.innerHTML = '';
  if(!school || !bookingsData[city][school] || bookingsData[city][school].length === 0){
    list.innerHTML = '<p class="no-bookings">Nenhuma solicitação</p>'; return;
  }
  bookingsData[city][school].forEach((b, index)=>{
    const div = document.createElement('div');
    div.className = 'booking-item';
    div.innerHTML = `<strong>${b.user}</strong> - ${b.date} ${b.time} <span class="booking-status status-${b.status}">${b.status}</span>
      <div style="margin-top:8px;">
        ${b.status==='pendente' ? `<button onclick="updateStatus('${city}','${school}',${index},'aprovado')">Aprovar</button>
        <button onclick="updateStatus('${city}','${school}',${index},'rejeitado')" style="background:#dc3545">Rejeitar</button>` : ''}
      </div>`;
    list.appendChild(div);
  });
}

/* ================== Atualizar status e notificar usuário ================== */
function updateStatus(city, school, index, status){
  const booking = bookingsData[city][school][index];
  booking.status = status;
  const mensagem = (status === 'aprovado') ?
    `OBA! SUA SOLICITAÇÃO FOI ACEITA POR UM DE NOSSOS Adminstradores !! — Instituição: ${school}, Cidade: ${city}, Data: ${booking.date}, Hora: ${booking.time}` :
    `SUA SOLICITAÇÃO FOI REJEITADA — Instituição: ${school}, Cidade: ${city}, Data: ${booking.date}, Hora: ${booking.time}`;

  const user = normalUsers.find(u => u.username === booking.user);
  if(user){
    if(!Array.isArray(user.notifications)) user.notifications = [];
    user.notifications.push({ text: mensagem, timestamp: new Date().toISOString() });
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    // se o usuário estiver logado na sessão atual, atualiza referência e ícone
    const saved = JSON.parse(localStorage.getItem('loggedUser') || 'null');
    if(saved && saved.username === user.username){
      loggedUser = user;
      localStorage.setItem('loggedUser', JSON.stringify({ username: user.username, password: user.password }));
      updateNotificationIcon();
    }
  }

  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
  loadBookings(city, school);
}

/* ================== Usuário: escolher cidade/escola/horários e criar agendamento ================== */
function loadSchools(){
  const city = document.getElementById('citySelect').value;
  const select = document.getElementById('schoolSelect');
  select.innerHTML = '<option value="">Escolha uma escola</option>';
  document.getElementById('suggestions').textContent = 'Escolha cidade, escola e data para ver sugestões.';
  document.getElementById('timeSelect').innerHTML = '<option value="">Escolha um horário</option>';
  if(!city) return;
  for(const school in bookingsData[city]) select.innerHTML += `<option value="${school}">${school}</option>`;
  loadAvailableTimes(); // atualiza caso data já selecionada
}

/* Gera horários disponíveis removendo os que já estão reservados.
   Também cria "sugestões" com algoritmo simples (IA-simulado): próximos 3 horários livres. */
function loadAvailableTimes(){
  const city = document.getElementById('citySelect').value;
  const school = document.getElementById('schoolSelect').value;
  const date = document.getElementById('dateSelect').value;
  const timeSelect = document.getElementById('timeSelect');
  const suggestionsDiv = document.getElementById('suggestions');

  timeSelect.innerHTML = '<option value="">Escolha um horário</option>';
  suggestionsDiv.textContent = 'Escolha cidade, escola e data para ver sugestões.';
  if(!city || !school || !date) return;

  // horários já ocupados naquela escola/data
  const bookedTimes = bookingsData[city][school].filter(b => b.date === date).map(b => b.time);

  // lista de horários livres
  const freeSlots = slots.filter(s => !bookedTimes.includes(s));

  // popular select com horários livres
  if(freeSlots.length === 0){
    timeSelect.innerHTML = '<option value="">Sem horários disponíveis</option>';
  } else {
    freeSlots.forEach(s => timeSelect.innerHTML += `<option value="${s}">${s}</option>`);
  }

  // "IA" - sugerir próximos 3 horários disponíveis:
  const suggestions = smartSuggestAvailableSlots(freeSlots, date);
  if(suggestions.length === 0){
    suggestionsDiv.textContent = 'Nenhuma sugestão — sem horários livres nessa data.';
  } else {
    suggestionsDiv.innerHTML = '<strong>Próximos horários sugeridos:</strong> ' + suggestions.join(' — ');
  }
}

/* "IA" simples: escolhe os próximos N horários mais cedo (pode ser substituído por modelo real)
   Aqui consideramos horário atual: se data for hoje, evita horários passados. */
function smartSuggestAvailableSlots(freeSlots, dateStr, count = 3){
  if(!freeSlots || freeSlots.length === 0) return [];
  const today = new Date();
  const selectedDate = dateStr ? new Date(dateStr + 'T00:00:00') : null;

  // ex: se for hoje, filtrar horários passados
  let filtered = freeSlots.slice();
  if(selectedDate){
    const isToday = selectedDate.toDateString() === today.toDateString();
    if(isToday){
      const curH = today.getHours();
      filtered = filtered.filter(slot => {
        const hour = parseInt(slot.split(':')[0], 10);
        return hour > curH; // sugerir apenas horários futuros
      });
    }
  }
  // retornar primeiros `count` horários livres
  return filtered.slice(0, count);
}

/* envio de agendamento */
document.getElementById('dateSelect').addEventListener('change', loadAvailableTimes);
document.getElementById('schoolSelect').addEventListener('change', loadAvailableTimes);

function makeBooking(){
  if(!loggedUser){ alert('Faça login para agendar.'); return; }
  const city = document.getElementById('citySelect').value;
  const school = document.getElementById('schoolSelect').value;
  const date = document.getElementById('dateSelect').value;
  const time = document.getElementById('timeSelect').value;
  const msg = document.getElementById('userMessage');
  if(!city || !school || !date || !time){ alert('Preencha todos os campos'); return; }

  // inserir
  bookingsData[city][school].push({ user: loggedUser.username, date, time, status: 'pendente' });
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
  msg.textContent = 'Agendamento enviado! Aguarde aprovação.';
  msg.classList.remove('hidden');
  setTimeout(()=> msg.classList.add('hidden'), 3000);

  // atualizar horários disponíveis
  loadAvailableTimes();
}

/* ================== Notificações: sino clicável, modal e marcar como lidas ================== */
function updateNotificationIcon(){
  const container = document.getElementById('notification');
  container.innerHTML = '🔔';
  if(!loggedUser || !Array.isArray(loggedUser.notifications)) return;
  const count = loggedUser.notifications.length;
  if(count > 0){
    const span = document.createElement('span'); span.className = 'badge'; span.textContent = count;
    container.appendChild(span);
  }
}

document.getElementById('notification').addEventListener('click', ()=>{
  if(!loggedUser) return alert('Faça login para ver notificações.');
  const modal = document.getElementById('modalNotif');
  const list = document.getElementById('notifList');
  list.innerHTML = '';

  if(!Array.isArray(loggedUser.notifications) || loggedUser.notifications.length === 0){
    list.innerHTML = '<p>Sem notificações novas.</p>';
  } else {
    loggedUser.notifications.forEach(n => {
      const p = document.createElement('p');
      const time = n.timestamp ? new Date(n.timestamp).toLocaleString() : '';
      p.innerHTML = `<strong>${time}</strong><br>${n.text}`;
      p.style.marginBottom = '10px';
      list.appendChild(p);
      const hr = document.createElement('hr'); list.appendChild(hr);
    });
  }
  modal.style.display = 'block';
});

function markAllRead(){
  if(!loggedUser) return;
  const idx = normalUsers.findIndex(u => u.username === loggedUser.username);
  if(idx !== -1){
    normalUsers[idx].notifications = [];
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    loggedUser.notifications = [];
    localStorage.setItem('loggedUser', JSON.stringify({ username: loggedUser.username, password: loggedUser.password }));
    updateNotificationIcon();
    document.getElementById('notifList').innerHTML = '<p>Sem notificações novas.</p>';
  }
}

function closeModalNotif(){ document.getElementById('modalNotif').style.display = 'none'; }

/* ================== Perfil e Suporte ================== */
document.getElementById('profileIcon').addEventListener('click', ()=>{
  if(!loggedUser) return alert('Faça login para ver o perfil.');
  document.getElementById('profileName').textContent = loggedUser.name || loggedUser.username;
  document.getElementById('profileCPF').textContent = loggedUser.cpf || '---';
  document.getElementById('profileMatricula').textContent = loggedUser.matricula || '---';
  document.getElementById('profileCity').textContent = loggedUser.city || '---';
  document.getElementById('profileInfo').classList.toggle('hidden');
});

document.getElementById('supportIcon').addEventListener('click', ()=>{
  document.getElementById('supportInfo').classList.toggle('hidden');
});

/* ================== Configuração (Engrenagem) - acessível só para admin ================== */
document.getElementById('configIcon').addEventListener('click', ()=>{
  if(userType !== 'admin'){ alert('Somente o administrador pode acessar configurações.'); return; }
  openAdminConfig();
});
document.getElementById('adminConfigIcon').addEventListener('click', ()=>{
  if(userType !== 'admin'){ alert('Somente o administrador pode acessar configurações.'); return; }
  openAdminConfig();
});

/* ================== Configurações ADM ================== */
function openAdminConfig(){
  const listDiv = document.getElementById('adminUserList');
  listDiv.innerHTML = '';

  if(!normalUsers || normalUsers.length === 0){
    listDiv.innerHTML = '<p>Nenhum usuário cadastrado.</p>';
  } else {
    normalUsers.forEach((u, i)=>{
      const status = u.blocked ? '🚫 Bloqueado' : '✅ Ativo';
      const div = document.createElement('div');
      div.style.border = '1px solid #ccc';
      div.style.borderRadius = '6px';
      div.style.padding = '8px';
      div.style.marginBottom = '10px';
      div.innerHTML = `
        <strong>${u.name || '(sem nome)'}</strong><br>
        <b>Email:</b> ${u.username}<br>
        <b>Senha:</b> ${u.password}<br>
        <b>Criado em:</b> ${u.createdAt || '---'}<br>
        <b>Último acesso:</b> ${u.lastLogin || '---'}<br>
        <b>Status:</b> ${status}<br><br>
        <button onclick="toggleBlockUser(${i})" style="margin-right:8px">${u.blocked?'Desbloquear':'Bloquear'}</button>
        <button onclick="deleteUser(${i})" style="background:#6c757d">Excluir</button>
      `;
      listDiv.appendChild(div);
    });
  }

  document.getElementById('modalAdminConfig').style.display = 'block';
}

function closeAdminConfig(){
  document.getElementById('modalAdminConfig').style.display = 'none';
}

function toggleBlockUser(index){
  normalUsers[index].blocked = !normalUsers[index].blocked;
  localStorage.setItem('usuarios', JSON.stringify(normalUsers));
  openAdminConfig(); // atualiza a lista
}

function deleteUser(index){
  if(confirm('Tem certeza que deseja excluir este usuário?')){
    // Se o usuário excluído estiver logado, forçar logout
    const currently = JSON.parse(localStorage.getItem('loggedUser') || 'null');
    if(currently && currently.username === normalUsers[index].username){
      localStorage.removeItem('loggedUser');
      loggedUser = null;
      document.getElementById('userDashboard').classList.add('hidden');
      document.getElementById('loginOverlay').style.display = 'flex';
      userType = null;
    }

    normalUsers.splice(index, 1);
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    openAdminConfig();
  }
}

/* ================== Utils (debug) ================== */
// Função para limpar dados (apenas se quiser resetar)
window.clearAppData = function(){ localStorage.removeItem('usuarios'); localStorage.removeItem('agendamentos'); localStorage.removeItem('loggedUser'); alert('Dados apagados. Recarregue a página.'); }