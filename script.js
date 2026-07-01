/* ================== Inicialização e persistência ================== */
const adminUser = { username:'adm', password:'123' };
const defaultDriverUsers = [
  { username:'motorista', password:'123', name:'Motorista Padrão', role:'driver', region:'Pinhais-PR', notifications: [], lastLogin: null, blocked: false }
];

let loggedUser = null;
let userType = null;
let pendingDriverRequests = JSON.parse(localStorage.getItem('pendentesMotoristas') || '[]');
let driverUsers = JSON.parse(localStorage.getItem('motoristas') || 'null');
if (!Array.isArray(driverUsers) || driverUsers.length === 0) {
  driverUsers = defaultDriverUsers;
  localStorage.setItem('motoristas', JSON.stringify(driverUsers));
}

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
  }
};

let normalUsers = JSON.parse(localStorage.getItem('usuarios') || '[]');
normalUsers = normalUsers.map(user => ({ ...user, role: user.role || 'user' }));
let supportRequests = JSON.parse(localStorage.getItem('supportRequests') || '[]');
let maxUsersPerTimeSlot = parseInt(localStorage.getItem('maxUsersPerTimeSlot'), 10) || 4;
let stockData = JSON.parse(localStorage.getItem('stockData') || 'null') || {};

let bookingsData = JSON.parse(localStorage.getItem('agendamentos') || 'null');
if (!bookingsData) {
  bookingsData = defaultBookings;
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
} else {
  for (const city in defaultBookings) {
    if (!bookingsData[city]) bookingsData[city] = {};
    for (const school in defaultBookings[city]) {
      if (!bookingsData[city][school]) bookingsData[city][school] = [];
    }
  }
  ['Almirante Tamandaré', 'Araucária'].forEach(city => {
    if (bookingsData[city]) delete bookingsData[city];
  });
  sanitizeBookingsData();
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
}

const slots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00'
];

function saveStockData() {
  localStorage.setItem('stockData', JSON.stringify(stockData));
}

function safeHtmlId(value) {
  return value.replace(/[^a-zA-Z0-9]/g, '_');
}

function getTodayDateInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
}

function isDateInPast(dateValue) {
  if (!dateValue) return true;
  const todayValue = getTodayDateInputValue();
  return new Date(`${dateValue}T00:00:00`) < new Date(`${todayValue}T00:00:00`);
}

function ensureStockEntry(city, school) {
  if (!stockData[city]) stockData[city] = { cityStock: 0, schools: {} };
  if (!stockData[city].schools[school]) stockData[city].schools[school] = { totalStock: 0, distribution: {} };
  return stockData[city].schools[school];
}

function getCityStock(city) {
  return stockData[city]?.cityStock || 0;
}

function getSchoolStock(city, school) {
  return ensureStockEntry(city, school);
}

function getDistributionForDate(city, school, date) {
  const schoolStock = getSchoolStock(city, school);
  return schoolStock.distribution[date] || {};
}

function getStockSuggestedSlots(city, school, date, freeSlots) {
  const dist = getDistributionForDate(city, school, date);
  if (!dist || Object.keys(dist).length === 0) return freeSlots;
  return freeSlots.slice().sort((a, b) => (dist[b] || 0) - (dist[a] || 0));
}

function saveStockData() {
  localStorage.setItem('stockData', JSON.stringify(stockData));
}

function saveCityStock(city) {
  const cityId = safeHtmlId(city);
  const input = document.getElementById(`${cityId}-city-stock`);
  const value = parseInt(input.value, 10);
  if (Number.isNaN(value) || value < 0) {
    alert('Informe um estoque válido para a cidade.');
    input.value = getCityStock(city);
    return;
  }
  if (!stockData[city]) stockData[city] = { cityStock: 0, schools: {} };
  stockData[city].cityStock = value;
  saveStockData();
  alert(`Estoque da cidade ${city} definido para ${value} litros.`);
}

function saveSchoolStock(city, school) {
  const cityId = safeHtmlId(city);
  const schoolId = safeHtmlId(school);
  const input = document.getElementById(`${cityId}-${schoolId}-school-stock`);
  const value = parseInt(input.value, 10);
  if (Number.isNaN(value) || value < 0) {
    alert('Informe um estoque válido para a escola.');
    input.value = getSchoolStock(city, school).totalStock;
    return;
  }
  const schoolStock = ensureStockEntry(city, school);
  schoolStock.totalStock = value;
  saveStockData();
  alert(`Estoque da escola ${school} definido para ${value} litros.`);
  renderTimeDistribution(city, school);
}

function updateDistributionSlot(city, school, date, slot, newValue) {
  const stockEntry = ensureStockEntry(city, school);
  if (!stockEntry.distribution[date]) stockEntry.distribution[date] = {};
  const previousValue = stockEntry.distribution[date][slot] || 0;
  const numericValue = Number.isNaN(parseInt(newValue, 10)) ? 0 : parseInt(newValue, 10);
  const totalForDate = Object.entries(stockEntry.distribution[date]).reduce((sum, [key, value]) => {
    if (key === slot) return sum + numericValue;
    return sum + (Number.isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10));
  }, 0);
  if (totalForDate > stockEntry.totalStock) {
    alert('A soma dos horários excede o estoque total da escola. Ajuste a distribuição.');
    renderTimeDistribution(city, school);
    return;
  }
  stockEntry.distribution[date][slot] = numericValue;
  saveStockData();
  renderTimeDistribution(city, school);
}

function renderTimeDistribution(city, school) {
  const cityId = safeHtmlId(city);
  const schoolId = safeHtmlId(school);
  const dateInput = document.getElementById(`${cityId}-${schoolId}-distribution-date`);
  if (!dateInput) return;
  const selectedDate = dateInput.value;
  const schoolStock = ensureStockEntry(city, school);
  const distribution = schoolStock.distribution[selectedDate] || {};
  const grid = document.getElementById(`${cityId}-${schoolId}-distributionGrid`);
  if (!grid) return;

  const totalAssigned = Object.values(distribution).reduce((sum, value) => sum + (Number.isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10)), 0);
  const remaining = Math.max(0, schoolStock.totalStock - totalAssigned);

  let html = `
    <div style="margin-bottom:10px;font-size:0.95rem;">
      <strong>Estoque total:</strong> ${schoolStock.totalStock} litros — <strong>Distribuído:</strong> ${totalAssigned} litros — <strong>Restante:</strong> ${remaining} litros
    </div>
  `;

  if (schoolStock.totalStock === 0) {
    html += '<div style="color:#d9534f;">Informe o estoque total da escola para começar a distribuir por horários.</div>';
    grid.innerHTML = html;
    return;
  }

  html += `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px;border-bottom:1px solid #ccc;">Horário</th>
          <th style="text-align:left;padding:6px;border-bottom:1px solid #ccc;">Litros</th>
        </tr>
      </thead>
      <tbody>`;
  slots.forEach(slot => {
    const value = distribution[slot] || 0;
    html += `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #eee;">${slot}</td>
        <td style="padding:6px;border-bottom:1px solid #eee;">
          <input type="number" min="0" value="${value}" style="width:100px;padding:4px;" onchange="updateDistributionSlot('${city}','${school}','${selectedDate}','${slot}', this.value)" />
        </td>
      </tr>`;
  });
  html += `
      </tbody>
    </table>`;
  grid.innerHTML = html;
}

function sanitizeBookingsData() {
  if (!Array.isArray(bookingsData.trash)) bookingsData.trash = [];
  for (const city in bookingsData) {
    if (city === 'trash') continue;
    const cityData = bookingsData[city];
    if (typeof cityData !== 'object' || cityData === null) continue;
    for (const school in cityData) {
      const list = cityData[school];
      if (!Array.isArray(list)) continue;
      const filtered = [];
      for (const item of list) {
        if (item && item.status === 'rejeitado') {
          bookingsData.trash.push({ ...item, city, school, rejectedAt: item.rejectedAt || new Date().toISOString() });
        } else {
          filtered.push(item);
        }
      }
      bookingsData[city][school] = filtered;
    }
  }
}

function savePendingDriverRequests() {
  localStorage.setItem('pendentesMotoristas', JSON.stringify(pendingDriverRequests));
}

function toggleDriverFields() {
  const role = document.getElementById('accountRole')?.value || 'user';
  const driverFields = document.getElementById('driverFields');
  const masterFields = document.getElementById('masterFields');
  const commonUserFields = document.getElementById('commonUserFields');
  const matriculaGroup = document.getElementById('registerMatriculaGroup');
  const cityGroup = document.getElementById('registerCityGroup');
  const emailGroup = document.getElementById('registerEmailGroup');
  const passwordGroup = document.getElementById('registerPasswordGroup');

  if (driverFields) {
    driverFields.classList.toggle('hidden', role !== 'driver');
  }
  if (masterFields) {
    masterFields.classList.toggle('hidden', role !== 'master');
  }
  if (commonUserFields) {
    commonUserFields.classList.toggle('hidden', role === 'master');
  }
  if (matriculaGroup) {
    matriculaGroup.classList.toggle('hidden', role === 'driver' || role === 'master');
  }
  if (cityGroup) {
    cityGroup.classList.toggle('hidden', role === 'master');
  }
  if (emailGroup) {
    emailGroup.classList.toggle('hidden', role === 'master');
  }
  if (passwordGroup) {
    passwordGroup.classList.toggle('hidden', role === 'master');
  }
}

function generateMasterToken() {
  const tokenInput = document.getElementById('masterAuthToken');
  if (!tokenInput) return;

  const saved = JSON.parse(localStorage.getItem('loggedUser') || 'null');
  const isAdminSession = saved && saved.username === 'adm' && saved.password === '123';

  if (!isAdminSession) {
    const enteredUser = prompt('Login de administrador:');
    const enteredPassword = prompt('Senha de administrador:');
    if (enteredUser !== 'adm' || enteredPassword !== '123') {
      alert('Acesso negado. Somente o administrador pode gerar tokens.');
      return;
    }
  }

  const token = String(Math.floor(1000 + Math.random() * 9000));
  tokenInput.value = token;
  alert(`Token gerado com sucesso: ${token}`);
}

function readDriverPhotoAsDataUrl() {
  return new Promise((resolve) => {
    const input = document.getElementById('driverPhoto');
    const file = input?.files?.[0];
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function normalizeName(value = '') {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase())
    .join(' ');
}

function normalizeKey(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function isBookingForCurrentUser(booking = {}) {
  const currentUsername = normalizeKey(loggedUser?.username || '');
  const currentName = normalizeKey(loggedUser?.name || loggedUser?.fullName || '');
  const bookingUser = normalizeKey(booking?.user || booking?.login || booking?.requesterUsername || '');
  const bookingName = normalizeKey(booking?.fullName || booking?.name || '');
  return Boolean(currentUsername && bookingUser && bookingUser === currentUsername)
    || Boolean(currentName && bookingName && bookingName === currentName)
    || String(booking?.user || booking?.login || '').trim() === String(loggedUser?.username || '').trim();
}

function isUserNameTaken(name) {
  const normalizedName = normalizeKey(name);
  return normalUsers.some(u => normalizeKey(u.name) === normalizedName)
    || driverUsers.some(u => normalizeKey(u.name) === normalizedName)
    || pendingDriverRequests.some(u => normalizeKey(u.name) === normalizedName);
}

function generateUniqueUsername(name) {
  const normalizedName = normalizeName(name);
  const parts = normalizedName.trim().split(/\s+/).filter(Boolean);
  const firstName = (parts[0] || 'usuario').toLowerCase();
  const lastName = (parts[parts.length - 1] || 'usuario').toLowerCase();
  const baseUsername = `${firstName}.${lastName}`;
  let username = baseUsername;
  let suffix = 1;

  while (
    normalUsers.some(u => normalizeKey(u.username) === normalizeKey(username))
    || driverUsers.some(u => normalizeKey(u.username) === normalizeKey(username))
    || pendingDriverRequests.some(u => normalizeKey(u.username) === normalizeKey(username))
  ) {
    username = `${baseUsername}${suffix}`;
    suffix += 1;
  }

  return username;
}

function generateNextMatricula() {
  const currentYear = String(new Date().getFullYear());
  const existingMatriculas = normalUsers
    .map(u => Number(u.matricula))
    .filter(value => !Number.isNaN(value) && String(value).startsWith(currentYear));

  if (existingMatriculas.length === 0) {
    return `${currentYear}0001`;
  }

  const lastMatricula = existingMatriculas.sort((a, b) => a - b).at(-1);
  const nextNumber = Number(String(lastMatricula).slice(currentYear.length)) + 1;
  return `${currentYear}${String(nextNumber).padStart(4, '0')}`;
}

function openRegister() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('registerScreen').classList.remove('hidden');
  toggleDriverFields();
}

function backToLogin() {
  document.getElementById('registerScreen').classList.add('hidden');
  ['fullName','masterFullName','cpf','matricula','registerEmail','registerPassword','masterCorporateEmail','masterAuthToken','driverBirthDate','driverCnhNumber','driverCnhValidity','driverCnhCategory','driverRg','driverPhone','driverAddress','driverPlate','driverVehicle','driverAvailability'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const photoInput = document.getElementById('driverPhoto');
  if (photoInput) photoInput.value = '';
  document.getElementById('registerCity').value = '';
  document.getElementById('accountRole').value = 'user';
  toggleDriverFields();
  document.getElementById('loginOverlay').style.display = 'flex';
}

async function registerUser() {
  const role = document.getElementById('accountRole').value;
  const msg = document.getElementById('registerMessage');

  if (role === 'master') {
    const name = document.getElementById('masterFullName')?.value?.trim() || '';
    const corporateEmail = document.getElementById('masterCorporateEmail').value.trim();
    const authToken = document.getElementById('masterAuthToken').value.trim();

    if (!name) {
      alert('Preencha o nome completo.');
      return;
    }

    if (!corporateEmail || !authToken) {
      alert('Preencha o e-mail corporativo e a chave de autenticação.');
      return;
    }
    if (!/^[^@\s]+@colab\.com\.br$/i.test(corporateEmail)) {
      alert('E-mail corporativo inválido. Use um domínio @colab.com.br.');
      return;
    }
    if (!/^\d{4}$/.test(authToken)) {
      alert('A chave de autenticação deve ter exatamente 4 dígitos.');
      return;
    }
    if (normalUsers.find(u => u.username === corporateEmail) || driverUsers.find(u => u.username === corporateEmail) || pendingDriverRequests.find(u => u.username === corporateEmail)) {
      alert('Este e-mail corporativo já está em uso.');
      return;
    }

    const newUser = {
      name,
      cpf: '',
      username: corporateEmail,
      password: authToken,
      role: 'master',
      corporateEmail,
      authToken,
      notifications: [],
      createdAt: new Date().toLocaleString(),
      lastLogin: null,
      blocked: false
    };
    normalUsers.push(newUser);
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    msg.textContent = 'Cadastro de usuário master realizado com sucesso!';
    msg.classList.remove('hidden');
    setTimeout(() => { msg.classList.add('hidden'); backToLogin(); }, 1800);
    return;
  }

  const rawName = document.getElementById('fullName').value.trim();
  const cpf = document.getElementById('cpf').value.trim();
  const city = document.getElementById('registerCity').value;

  if (!rawName || !cpf || !city) {
    alert('Preencha nome, CPF e cidade para concluir o cadastro.');
    return;
  }

  const name = normalizeName(rawName);
  if (isUserNameTaken(name)) {
    alert('Este nome já possui cadastro. Não é possível criar um usuário duplicado.');
    return;
  }

  const generatedUsername = generateUniqueUsername(name);
  const generatedPassword = '123';
  const generatedMatricula = generateNextMatricula();
  const username = generatedUsername;
  const password = generatedPassword;

  document.getElementById('fullName').value = name;
  document.getElementById('registerEmail').value = username;
  document.getElementById('registerPassword').value = password;
  document.getElementById('matricula').value = generatedMatricula;

  if (role === 'driver') {
    const birthDate = document.getElementById('driverBirthDate').value;
    const cnhNumber = document.getElementById('driverCnhNumber').value.trim();
    const cnhValidity = document.getElementById('driverCnhValidity').value;
    const cnhCategory = document.getElementById('driverCnhCategory').value.trim();
    const phone = document.getElementById('driverPhone').value.trim();
    const plate = document.getElementById('driverPlate').value.trim();
    const vehicle = document.getElementById('driverVehicle').value.trim();

    if (!birthDate || !cnhNumber || !cnhValidity || !cnhCategory || !phone || !plate || !vehicle) {
      alert('Preencha todos os campos obrigatórios do motorista.');
      return;
    }

    const photo = await readDriverPhotoAsDataUrl();
    const newDriverRequest = {
      id: `driver-${Date.now()}`,
      username,
      password,
      name,
      cpf,
      birthDate,
      cnhNumber,
      cnhValidity,
      cnhCategory,
      rg: document.getElementById('driverRg').value.trim(),
      phone,
      address: document.getElementById('driverAddress').value.trim(),
      region: city,
      licensePlate: plate,
      vehicleModelYear: vehicle,
      availability: document.getElementById('driverAvailability').value.trim(),
      photo,
      notifications: [],
      createdAt: new Date().toLocaleString(),
      lastLogin: null,
      blocked: false,
      pendingApproval: true
    };

    pendingDriverRequests.push(newDriverRequest);
    savePendingDriverRequests();
    msg.textContent = 'Cadastro enviado para aprovação do administrador. Você poderá entrar após a autorização.';
    msg.classList.remove('hidden');
    setTimeout(() => { msg.classList.add('hidden'); backToLogin(); }, 2200);
    return;
  }

  const newUser = {
    name,
    cpf,
    matricula: generatedMatricula,
    city,
    username,
    password,
    role: 'user',
    notifications: [],
    createdAt: new Date().toLocaleString(),
    lastLogin: null,
    blocked: false,
    mustChangePassword: true
  };
  normalUsers.push(newUser);
  localStorage.setItem('usuarios', JSON.stringify(normalUsers));
  msg.textContent = 'Cadastro realizado com sucesso!';
  msg.classList.remove('hidden');
  setTimeout(() => { msg.classList.add('hidden'); backToLogin(); }, 1800);
}

function toggleLoginMode() {
  const mode = document.getElementById('loginMode')?.value || 'user';
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  if (!usernameInput || !passwordInput) return;

  if (mode === 'master') {
    usernameInput.placeholder = 'E-mail corporativo @colab.com.br';
    passwordInput.placeholder = 'Token de acesso';
  } else {
    usernameInput.placeholder = 'Email ou login';
    passwordInput.placeholder = 'Senha';
  }
}

function tryAutoLoginMaster(email) {
  const mode = document.getElementById('loginMode')?.value || 'user';
  if (mode !== 'master') return false;
  if (!/^[^@\s]+@colab\.com\.br$/i.test(email)) return false;

  const masterUser = normalUsers.find(u => u.username === email && u.role === 'master');
  if (!masterUser) return false;

  const passwordInput = document.getElementById('password');
  if (passwordInput) passwordInput.value = masterUser.password || masterUser.authToken || '';
  return true;
}

function saveFirstAccessPassword() {
  const errorDiv = document.getElementById('firstAccessError');
  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmPassword = document.getElementById('confirmNewPassword').value.trim();

  errorDiv.classList.add('hidden');

  if (!newPassword || !confirmPassword || newPassword.length < 4 || newPassword !== confirmPassword) {
    errorDiv.textContent = 'As senhas não conferem ou são inválidas.';
    errorDiv.classList.remove('hidden');
    return;
  }

  const userIndex = normalUsers.findIndex(u => u.username === loggedUser?.username);
  if (userIndex === -1) return;

  const user = normalUsers[userIndex];
  user.password = confirmPassword;
  user.mustChangePassword = false;
  normalUsers[userIndex] = user;
  localStorage.setItem('usuarios', JSON.stringify(normalUsers));

  document.getElementById('firstAccessScreen').classList.add('hidden');
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('userDashboard').classList.remove('hidden');
  userType = 'user';
  loggedUser = user;
  localStorage.setItem('loggedUser', JSON.stringify({ username: user.username, password: user.password }));
  populateBookingCities();
  loadUserBookings();
  updateNotificationIcon();
}

function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorDiv = document.getElementById('loginError');
  const loginMode = document.getElementById('loginMode')?.value || 'user';
  errorDiv.classList.add('hidden');

  if (!username) {
    errorDiv.textContent = 'Preencha o e-mail ou login.';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (loginMode === 'master') {
    if (!/^[^@\s]+@colab\.com\.br$/i.test(username)) {
      errorDiv.textContent = 'Use um e-mail corporativo com domínio @colab.com.br.';
      errorDiv.classList.remove('hidden');
      return;
    }

    const masterUser = normalUsers.find(u => u.username === username && u.role === 'master');
    if (!masterUser) {
      errorDiv.textContent = 'Usuário master não encontrado para este e-mail.';
      errorDiv.classList.remove('hidden');
      return;
    }

    const token = masterUser.password || masterUser.authToken || '';
    if (!password) {
      document.getElementById('password').value = token;
    }

    if (document.getElementById('password').value !== token) {
      errorDiv.textContent = 'Token inválido para este usuário master.';
      errorDiv.classList.remove('hidden');
      return;
    }

    loggedUser = masterUser;
    localStorage.setItem('loggedUser', JSON.stringify({ username: masterUser.username, password: token }));
    normalUsers[normalUsers.findIndex(u => u.username === masterUser.username)] = { ...masterUser, lastLogin: new Date().toLocaleString() };
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('userDashboard').classList.add('hidden');
    document.getElementById('driverDashboard').classList.add('hidden');
    userType = 'master';
    loadAdminDashboard();
    updateNotificationIcon();
    return;
  }

  if (!password) {
    errorDiv.textContent = 'Preencha usuário e senha.';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (username === adminUser.username && password === adminUser.password) {
    loggedUser = adminUser;
    localStorage.setItem('loggedUser', JSON.stringify({ username: adminUser.username, password: adminUser.password }));
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminDashboard').classList.remove('hidden');
    userType = 'admin';
    loadAdminDashboard();
    return;
  }

  const driverIndex = driverUsers.findIndex(u => u.username === username && u.password === password);
  if (driverIndex !== -1) {
    const driver = driverUsers[driverIndex];
    if (driver.blocked) {
      errorDiv.textContent = 'Conta de motorista bloqueada. Contate o administrador.';
      errorDiv.classList.remove('hidden');
      return;
    }
    loggedUser = driver;
    localStorage.setItem('loggedUser', JSON.stringify({ username: driver.username, password: driver.password }));
    driverUsers[driverIndex].lastLogin = new Date().toLocaleString();
    localStorage.setItem('motoristas', JSON.stringify(driverUsers));
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('driverDashboard').classList.remove('hidden');
    userType = 'driver';
    loadDriverDashboard();
    updateNotificationIcon();
    return;
  }

  const userIndex = normalUsers.findIndex(u => u.username === username);
  if (userIndex !== -1) {
    const user = normalUsers[userIndex];
    if (user.blocked) {
      errorDiv.textContent = 'Conta bloqueada. Contate o administrador.';
      errorDiv.classList.remove('hidden');
      return;
    }

    if (user.mustChangePassword) {
      if (password !== '123') {
        errorDiv.textContent = 'Para o primeiro acesso, use a senha padrão 123.';
        errorDiv.classList.remove('hidden');
        return;
      }
      document.getElementById('firstAccessScreen').classList.remove('hidden');
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('userDashboard').classList.add('hidden');
      document.getElementById('adminDashboard').classList.add('hidden');
      document.getElementById('driverDashboard').classList.add('hidden');
      loggedUser = user;
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmNewPassword').value = '';
      document.getElementById('firstAccessError').classList.add('hidden');
      return;
    } else if (user.password !== password) {
      errorDiv.textContent = 'Email ou senha inválidos!';
      errorDiv.classList.remove('hidden');
      return;
    }

    loggedUser = user;
    localStorage.setItem('loggedUser', JSON.stringify({ username: user.username, password: user.password }));
    normalUsers[userIndex].lastLogin = new Date().toLocaleString();
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('userDashboard').classList.remove('hidden');
    userType = 'user';
    populateBookingCities();
    loadUserBookings();
    updateNotificationIcon();
  } else {
    errorDiv.textContent = 'Email ou senha inválidos!';
    errorDiv.classList.remove('hidden');
  }
}

function initializeLogin() {
  const saved = JSON.parse(localStorage.getItem('loggedUser') || 'null');
  if (!saved) return;
  loggedUser = saved;
  if (loggedUser.username === adminUser.username && loggedUser.password === adminUser.password) {
    userType = 'admin';
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminDashboard').classList.remove('hidden');
    loadAdminDashboard();
    return;
  }

  const masterUser = normalUsers.find(x => x.username === loggedUser.username && x.password === loggedUser.password && x.role === 'master');
  if (masterUser) {
    userType = 'master';
    loggedUser = masterUser;
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('userDashboard').classList.add('hidden');
    document.getElementById('driverDashboard').classList.add('hidden');
    loadAdminDashboard();
    updateNotificationIcon();
    return;
  }

  const driver = driverUsers.find(x => x.username === loggedUser.username && x.password === loggedUser.password);
  if (driver) {
    userType = 'driver';
    loggedUser = driver;
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('driverDashboard').classList.remove('hidden');
    loadDriverDashboard();
    updateNotificationIcon();
    return;
  }

  const u = normalUsers.find(x => x.username === loggedUser.username && x.password === loggedUser.password);
  if (u) {
    userType = 'user';
    loggedUser = u;
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('userDashboard').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('driverDashboard').classList.add('hidden');
    populateBookingCities();
    loadUserBookings();
    updateNotificationIcon();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  toggleLoginMode();
  initializeLogin();
  populateBookingCities();
});

// Ativa envio do login ao pressionar Enter nos campos de usuário/senha
(function attachEnterLogin() {
  try {
    const u = document.getElementById('username');
    const p = document.getElementById('password');
    const onEnter = (e) => { if (e.key === 'Enter') login(); };
    if (u) {
      u.addEventListener('keydown', onEnter);
      u.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        if (value && document.getElementById('loginMode')?.value === 'master') {
          tryAutoLoginMaster(value);
        }
      });
    }
    if (p) p.addEventListener('keydown', onEnter);
  } catch (err) {
    // silencioso — se os elementos não existirem, nada a fazer
  }
})();

/* ================== Logout ================== */
function logout() {
  loggedUser = null;
  localStorage.removeItem('loggedUser');
  document.getElementById('adminDashboard').classList.add('hidden');
  document.getElementById('userDashboard').classList.add('hidden');
  document.getElementById('driverDashboard').classList.add('hidden');
  document.getElementById('registerScreen').classList.add('hidden');
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  userType = null;
}

/* ================== Admin: cidades / escolas / solicitações ================== */
function renderAdminRequests() {
  const list = document.getElementById('adminRequestsList');
  if (!list) return;
  list.innerHTML = '';

  const pendingRequests = [];
  for (const city in bookingsData) {
    if (!bookingsData[city] || typeof bookingsData[city] !== 'object' || city === 'trash') continue;
    for (const school in bookingsData[city]) {
      if (!Array.isArray(bookingsData[city][school])) continue;
      bookingsData[city][school].forEach((booking, index) => {
        if (booking.status === 'pendente') {
          pendingRequests.push({ city, school, index, booking });
        }
      });
    }
  }

  if (pendingRequests.length === 0) {
    list.innerHTML = '<p class="no-bookings">Nenhuma solicitação pendente.</p>';
    return;
  }

  pendingRequests.forEach(({ city, school, index, booking }) => {
    const requesterName = booking.fullName || booking.user || 'Usuário';
    const requesterCpf = booking.cpf || '---';
    const requesterLogin = booking.login || booking.user || '---';
    const homeAddressText = booking.deliveryType === 'Entrega em casa' ? `<br><strong>Endereço:</strong> ${booking.homeAddress || '---'}` : '';
    const item = document.createElement('div');
    item.className = 'booking-item';
    item.innerHTML = `
      <strong>${requesterName}</strong><br>
      Login: ${requesterLogin}<br>
      CPF: ${requesterCpf}<br>
      Cidade: ${city}<br>
      Escola: ${school}<br>
      Data: ${booking.date} ${booking.time}<br>
      Tipo de entrega: ${booking.deliveryType || '---'}${homeAddressText}<br>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
        <button onclick="updateStatus('${city}','${school}',${index},'aprovado')">Aprovar</button>
        <button onclick="updateStatus('${city}','${school}',${index},'rejeitado')" style="background:#dc3545">Rejeitar</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function loadAdminDashboard() {
  const container = document.getElementById('adminCities');
  container.innerHTML = '';
  for (const city in bookingsData) {
    if (city === 'trash') continue;
    const cityDiv = document.createElement('div');
    cityDiv.className = 'city-column';
    const cityStock = getCityStock(city);
    const cityId = safeHtmlId(city);
    let html = `<h3>${city}</h3>`;
    html += `
      <div style="margin-bottom:12px;padding:10px;border:1px solid #007BFF;border-radius:8px;background:#f5f9ff;">
        <strong>Estoque total da cidade</strong><br>
        <input id="${cityId}-city-stock" type="number" min="0" value="${cityStock}" style="width:100px;padding:6px;margin-top:6px;" />
        <button onclick="saveCityStock('${city}')" style="margin-left:8px;padding:6px 10px;">Salvar</button>
      </div>
    `;
    html += `<select onchange="loadBookings('${city}', this.value)"><option value="">Escolha uma escola</option>`;
    for (const school in bookingsData[city]) html += `<option value="${school}">${school}</option>`;
    html += `</select>`;
    html += `<div class="booking-list" id="${cityId}-bookings"></div>`;
    cityDiv.innerHTML = html;
    container.appendChild(cityDiv);
  }
  renderAdminRequests();
}

function loadBookings(city, school) {
  const cityId = safeHtmlId(city);
  const schoolId = safeHtmlId(school);
  const list = document.getElementById(`${cityId}-bookings`);
  list.innerHTML = '';
  if (!school || !bookingsData[city][school] || bookingsData[city][school].length === 0) {
    list.innerHTML = '<p class="no-bookings">Nenhuma solicitação</p>'; 
  }

  const stockEntry = getSchoolStock(city, school);
  const distributionDate = new Date().toISOString().slice(0, 10);
  let html = `
    <div style="margin-bottom:16px;padding:16px;border:1px solid #28a745;border-radius:12px;background:#f7fff8;box-shadow:0 8px 20px rgba(40,167,69,0.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <strong style="font-size:1rem;">Configuração de estoque da escola</strong>
        <button onclick="distributeSchoolStockFairly('${city}','${school}')" style="padding:8px 12px;border:none;border-radius:8px;background:#0f766e;color:#fff;cursor:pointer;font-weight:600;">Distribuir de forma justa</button>
      </div>
      <div style="margin-top:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <label>Data de distribuição:</label>
        <input id="${cityId}-${schoolId}-distribution-date" type="date" value="${distributionDate}" onchange="renderTimeDistribution('${city}','${school}')" />
        <button onclick="renderTimeDistribution('${city}','${school}')" style="padding:6px 10px;">Carregar</button>
      </div>
      <div id="${cityId}-${schoolId}-distributionGrid" style="margin-top:12px"></div>
    </div>
  `;

  list.innerHTML = html;
  renderTimeDistribution(city, school);

  const pendingItems = (bookingsData[city][school] || []).filter((b) => b.status === 'pendente');
  pendingItems.forEach((b, index) => {
    const realIndex = bookingsData[city][school].findIndex(item => item === b);
    const requesterName = b.fullName || (normalUsers.find(u => u.username === b.user)?.name) || b.user;
    const requesterCpf = b.cpf || (normalUsers.find(u => u.username === b.user)?.cpf) || '---';
    const requesterLogin = b.login || b.user;
    const homeAddressText = b.deliveryType === 'Entrega em casa' ? `<br><strong>Endereço:</strong> ${b.homeAddress || '---'}` : '';
    const div = document.createElement('div');
    div.className = 'booking-item';
    div.innerHTML = `
      <strong>${requesterName}</strong><br>
      login: ${requesterLogin}<br>
      CPF: ${requesterCpf}<br>
      Solicitado para: ${b.date} ${b.time}<br>
      Tipo de entrega: ${b.deliveryType || '---'}<br>
      ${homeAddressText}
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
        <button onclick="updateStatus('${city}','${school}',${realIndex},'aprovado')">Aprovar</button>
        <button onclick="updateStatus('${city}','${school}',${realIndex},'rejeitado')" style="background:#dc3545">Rejeitar</button>
      </div>`;
    list.appendChild(div);
  });
}

function updateStatus(city, school, index, status) {
  const booking = bookingsData[city][school][index];
  if (!booking) return;

  booking.status = status;
  if (status === 'aprovado' && String(booking.deliveryType || '').includes('casa')) {
    booking.driverStatus = 'pendente';
    booking.driverAssigned = null;
    booking.driverName = null;
    booking.driverLocation = 'Aguardando motorista';
    booking.driverRouteStage = 0;
  }

  const mensagem = (status === 'aprovado')
    ? `OBA! SUA SOLICITAÇÃO FOI ACEITA — Instituição: ${school}, Cidade: ${city}, Data: ${booking.date}, Hora: ${booking.time}`
    : `SUA SOLICITAÇÃO FOI REJEITADA — Instituição: ${school}, Cidade: ${city}, Data: ${booking.date}, Hora: ${booking.time}`;

  const user = normalUsers.find(u => u.username === booking.user);
  if (user) {
    if (!Array.isArray(user.notifications)) user.notifications = [];
    user.notifications.push({ text: mensagem, timestamp: new Date().toISOString() });
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    const saved = JSON.parse(localStorage.getItem('loggedUser') || 'null');
    if (saved && saved.username === user.username) {
      loggedUser = user;
      localStorage.setItem('loggedUser', JSON.stringify({ username: user.username, password: user.password }));
      updateNotificationIcon();
    }
  }

  if (status === 'aprovado' && String(booking.deliveryType || '').includes('casa')) {
    driverUsers.forEach((driver) => {
      if (!driver || driver.blocked) return;
      const sameRegion = String(driver.region || '').trim().toLowerCase() === String(city).trim().toLowerCase();
      if (!sameRegion) return;
      if (!Array.isArray(driver.notifications)) driver.notifications = [];
      driver.notifications.push({
        text: `Nova entrega aprovada para ${booking.fullName || booking.user} em ${school} (${booking.date} ${booking.time}).`,
        timestamp: new Date().toISOString()
      });
    });
    localStorage.setItem('motoristas', JSON.stringify(driverUsers));
  }

  if (status === 'aprovado') {
    bookingsData[city][school] = (bookingsData[city][school] || []).filter((item) => item !== booking);
  }

  if (status === 'rejeitado') {
    if (!Array.isArray(bookingsData.trash)) bookingsData.trash = [];
    const rejected = { ...booking, city, school, rejectedAt: new Date().toISOString() };
    bookingsData.trash.push(rejected);
    bookingsData[city][school] = (bookingsData[city][school] || []).filter((item) => item !== booking);
  }

  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
  if (userType === 'driver' && loggedUser?.role === 'driver') {
    loadDriverDashboard();
  }
  loadAdminDashboard();
}

function distributeSchoolStockFairly(city, school) {
  const stockEntry = ensureStockEntry(city, school);
  const cityStock = getCityStock(city);
  const targetStock = cityStock > 0 ? cityStock : (stockEntry.totalStock || 0);
  const selectedDateInput = document.getElementById(`${safeHtmlId(city)}-${safeHtmlId(school)}-distribution-date`);
  const selectedDate = selectedDateInput?.value || new Date().toISOString().slice(0, 10);
  const base = Math.floor(targetStock / slots.length);
  const remainder = targetStock % slots.length;
  const distribution = {};

  slots.forEach((slot, index) => {
    distribution[slot] = index < remainder ? base + 1 : base;
  });

  stockEntry.totalStock = targetStock;
  stockEntry.distribution[selectedDate] = distribution;
  saveStockData();
  renderTimeDistribution(city, school);
}

function loadTrash() {
  const trashList = document.getElementById('trashList');
  trashList.innerHTML = '';
  const trashItems = bookingsData.trash || [];
  if (trashItems.length === 0) {
    trashList.innerHTML = `
      <div class="empty-state">
        <h4>Nenhuma solicitação rejeitada</h4>
        <p>As solicitações rejeitadas aparecerão aqui para possível restauração.</p>
      </div>`;
    return;
  }
  for (let i = trashItems.length - 1; i >= 0; i -= 1) {
    const item = trashItems[i];
    const div = document.createElement('div');
    div.className = 'request-card';
    div.innerHTML = `
      <div class="request-card__header">
        <strong>${item.fullName || item.user}</strong>
        <span class="request-pill">rejeitado</span>
      </div>
      <p><strong>Login:</strong> ${item.login || item.user}</p>
      <p><strong>CPF:</strong> ${item.cpf || '---'}</p>
      <p><strong>Escola:</strong> ${item.school}</p>
      <p><strong>Cidade:</strong> ${item.city}</p>
      <p><strong>Data:</strong> ${item.date} ${item.time}</p>
      <div class="request-actions">
        <button onclick="restoreFromTrash(${i})">Restaurar</button>
        <button onclick="deleteFromTrash(${i})" class="danger">Excluir permanentemente</button>
      </div>`;
    trashList.appendChild(div);
  }
}

function restoreFromTrash(index) {
  const trashItems = bookingsData.trash || [];
  const item = trashItems[index];
  if (!item) return;
  if (!bookingsData[item.city]) bookingsData[item.city] = {};
  if (!bookingsData[item.city][item.school]) bookingsData[item.city][item.school] = [];
  item.status = 'pendente';
  delete item.rejectedAt;
  bookingsData[item.city][item.school].push(item);
  bookingsData.trash.splice(index, 1);
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
  loadTrash();
}

function assignDelivery(city, school, index) {
  const booking = bookingsData[city][school][index];
  if (!loggedUser || userType !== 'driver') return alert('Somente motoristas podem assumir entregas.');
  if (booking.driverAssigned && booking.driverAssigned !== loggedUser.username) return alert('Entrega já foi assumida por outro motorista.');
  booking.driverAssigned = loggedUser.username;
  booking.driverName = loggedUser.name || loggedUser.username;
  booking.driverLocation = 'Saiu para entrega';
  booking.driverRouteStage = 1;
  booking.driverStatus = 'em rota';
  if (booking.status === 'pendente') booking.status = 'aprovado';
  const user = normalUsers.find(u => u.username === booking.user);
  if (user) {
    if (!Array.isArray(user.notifications)) user.notifications = [];
    user.notifications.push({ text: `Seu pedido foi assumido pelo motorista ${booking.driverName}. Ele já saiu para entrega.`, timestamp: new Date().toISOString() });
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
  }
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
  loadDriverDashboard();
  loadUserBookings();
}

function completeDelivery(city, school, index) {
  const booking = bookingsData[city][school][index];
  if (!loggedUser || userType !== 'driver') return alert('Somente motoristas podem concluir entregas.');
  if (booking.driverAssigned !== loggedUser.username) return alert('Você precisa assumir esta entrega antes de concluir.');
  booking.driverStatus = 'entregue';
  booking.status = 'entregue';
  booking.driverLocation = 'Entrega concluída';
  booking.driverRouteStage = 4;
  const user = normalUsers.find(u => u.username === booking.user);
  if (user) {
    if (!Array.isArray(user.notifications)) user.notifications = [];
    user.notifications.push({ text: `Sua entrega em casa foi concluída pelo motorista ${loggedUser.name || loggedUser.username} em ${booking.date} ${booking.time}.`, timestamp: new Date().toISOString() });
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
  }
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
  loadDriverDashboard();
  loadUserBookings();
}

function requestDriverCoordinates() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  });
}

async function updateDriverLocation(city, school, index) {
  const booking = bookingsData[city][school][index];
  if (!loggedUser || userType !== 'driver') return alert('Somente motoristas podem atualizar a localização.');
  if (booking.driverAssigned !== loggedUser.username) return alert('Você precisa assumir esta entrega antes de atualizar a localização.');
  if (!booking.driverRouteStage) booking.driverRouteStage = 1;
  booking.driverRouteStage = Math.min(4, booking.driverRouteStage + 1);
  const locations = ['Saiu para entrega', 'A caminho', 'Quase chegando', 'Chegando'];
  const coords = await requestDriverCoordinates();
  const coordsText = coords ? ` • ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '';
  booking.driverLocation = `${locations[Math.min(3, booking.driverRouteStage - 1)]}${coordsText}`;
  booking.driverStatus = booking.driverRouteStage >= 4 ? 'em rota' : 'em rota';
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
  loadDriverDashboard();
  loadUserBookings();
}


function loadDriverDashboard() {
  const container = document.getElementById('driverDeliveries');
  if (!container) return;
  container.innerHTML = '';
  const driverRegion = String(loggedUser?.region || loggedUser?.city || '').trim().toLowerCase();
  const deliveries = [];
  for (const city in bookingsData) {
    if (!bookingsData[city] || typeof bookingsData[city] !== 'object') continue;
    if (String(city).trim().toLowerCase() !== driverRegion) continue;
    for (const school in bookingsData[city]) {
      if (!Array.isArray(bookingsData[city][school])) continue;
      bookingsData[city][school].forEach((b, index) => {
        if (String(b.deliveryType || '').includes('casa') && ['aprovado','pendente','em rota'].includes(b.status)) {
          deliveries.push({ city, school, booking: b, index });
        }
      });
    }
  }

  if (deliveries.length === 0) {
    container.innerHTML = '<p class="no-bookings">Sem entregas disponíveis para sua região no momento.</p>';
    return;
  }

  deliveries.forEach(({ city, school, booking, index }) => {
    const div = document.createElement('div');
    div.className = 'booking-item';
    const assignedText = booking.driverAssigned ? `Motorista atual: ${booking.driverName || booking.driverAssigned}` : 'Nenhum motorista atribuído';
    const homeAddressText = booking.deliveryType === 'Entrega em casa' ? `<br><strong>Endereço do cliente:</strong> ${booking.homeAddress || '---'}` : '';
    const locationText = booking.driverLocation ? `<br><strong>Localização:</strong> ${booking.driverLocation}` : '';
    const routeText = booking.driverRouteStage ? `<br><strong>Rota:</strong> ${['Saiu para entrega','A caminho','Quase chegando','Chegando'][Math.max(0, Math.min(booking.driverRouteStage - 1, 3))]}` : '';
    const isAssignedToMe = booking.driverAssigned === loggedUser.username;
    div.innerHTML = `
      <strong>${booking.fullName || booking.user}</strong><br>
      Cidade: ${city}<br>
      Escola: ${school}<br>
      Data: ${booking.date} ${booking.time}<br>
      ${homeAddressText}
      ${assignedText}${locationText}${routeText}<br>
      Status de entrega: ${booking.driverStatus || 'pendente'}<br>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        ${booking.driverAssigned && !isAssignedToMe ? '' : `<button onclick="assignDelivery('${city}','${school}',${index})">Assumir entrega</button>`}
        ${isAssignedToMe ? `<button onclick="updateDriverLocation('${city}','${school}',${index})">Atualizar localização</button>` : ''}
        ${isAssignedToMe ? `<button onclick="completeDelivery('${city}','${school}',${index})" style="background:#28a745">Marcar entregue</button>` : ''}
      </div>`;
    container.appendChild(div);
  });
}

function openTrash() {
  loadTrash();
  const screen = document.getElementById('requestsScreen');
  if (screen) screen.classList.remove('hidden');
}

function closeModalTrash() {
  const screen = document.getElementById('requestsScreen');
  if (screen) screen.classList.add('hidden');
}


/* ================== Usuário: escolas / horários / agendamento ================== */
function populateBookingCities() {
  const citySelect = document.getElementById('citySelect');
  if (!citySelect) return;
  const isRestrictedUser = userType === 'user' && loggedUser?.city;
  const excludedCities = ['trash', 'Almirante Tamandaré', 'Araucária'];
  const cities = isRestrictedUser
    ? [loggedUser.city].filter(city => city && !excludedCities.includes(city))
    : Object.keys(bookingsData || {}).filter(city => !excludedCities.includes(city));
  citySelect.innerHTML = '<option value="">Selecione uma cidade</option>';
  cities.forEach(city => {
    citySelect.innerHTML += `<option value="${city}">${city}</option>`;
  });
  if (isRestrictedUser && loggedUser.city) {
    citySelect.value = loggedUser.city;
  }
  const dateSelect = document.getElementById('dateSelect');
  if (dateSelect) {
    const nextWednesday = getNextWednesday();
    dateSelect.min = formatDateInput(nextWednesday);
    if (dateSelect.value && (!isWednesday(dateSelect.value) || isDateInPast(dateSelect.value))) {
      dateSelect.value = '';
    }
  }
  if (citySelect.value) {
    loadSchools();
  }
  loadUserBookings();
}

function loadUserBookings() {
  const list = document.getElementById('userBookingsList');
  if (!list) return;
  if (!loggedUser || userType !== 'user') {
    list.innerHTML = '<p>Faça login para ver seus agendamentos.</p>';
    return;
  }
  const userBookings = [];
  for (const city in bookingsData) {
    if (!bookingsData[city] || typeof bookingsData[city] !== 'object') continue;
    for (const school in bookingsData[city]) {
      if (!Array.isArray(bookingsData[city][school])) continue;
      bookingsData[city][school].forEach((b) => {
        if (isBookingForCurrentUser(b)) {
          userBookings.push({ city, school, booking: b });
        }
      });
    }
  }
  if (userBookings.length === 0) {
    list.innerHTML = '<p>Você ainda não tem agendamentos.</p>';
    return;
  }
  list.innerHTML = '';
  userBookings.forEach(({ city, school, booking }) => {
    const isPickup = booking.deliveryType === 'Retirar presencial';
    const driverText = isPickup
      ? 'Não aplicável'
      : booking.driverName
        ? `${booking.driverName} (${booking.driverAssigned})`
        : 'Aguardando motorista';
    const statusText = booking.driverStatus || booking.status || 'pendente';
    const trackingSteps = ['Aguardando motorista', 'Saiu para entrega', 'A caminho', 'Quase chegando', 'Chegando', 'Entregue'];
    const stage = Number(booking.driverRouteStage || 0);
    const currentStageLabel = booking.driverStatus === 'entregue'
      ? 'Entregue'
      : (booking.driverRouteStage ? trackingSteps[Math.min(stage, trackingSteps.length - 1)] : 'Aguardando motorista');
    const trackingHtml = !isPickup && booking.driverAssigned ? `
      <div class="tracking-card">
        <div class="tracking-title">Rastreio da entrega</div>
        <div class="tracking-steps">
          ${trackingSteps.slice(1).map((step, index) => {
            const isActive = booking.driverStatus === 'entregue'
              ? index === trackingSteps.slice(1).length - 1
              : index + 1 <= stage;
            return `<span class="tracking-step ${isActive ? 'active' : ''}">${step}</span>`;
          }).join('')}
        </div>
        <div class="tracking-footer">${booking.driverLocation || currentStageLabel}</div>
      </div>` : '';
    const homeAddressText = booking.deliveryType === 'Entrega em casa' ? `<br><strong>Endereço:</strong> ${booking.homeAddress || '---'}` : '';
    const item = document.createElement('div');
    item.className = 'booking-item';
    item.innerHTML = `
      <strong>${booking.fullName || loggedUser.name || loggedUser.username}</strong><br>
      Cidade: ${city}<br>
      Escola: ${school}<br>
      Data: ${booking.date} ${booking.time}<br>
      Tipo de entrega: ${booking.deliveryType || '---'}${homeAddressText}<br>
      <strong>Motorista:</strong> ${driverText}<br>
      <strong>Status:</strong> ${statusText}<br>
      ${trackingHtml}
    `;
    list.appendChild(item);
  });
}

function loadSchools() {
  const city = document.getElementById('citySelect').value;
  const select = document.getElementById('schoolSelect');
  select.innerHTML = '<option value="">Escolha uma escola</option>';
  document.getElementById('suggestions').textContent = 'Escolha cidade, escola e data para ver sugestões.';
  document.getElementById('timeSelect').innerHTML = '<option value="">Escolha um horário</option>';
  if (!city) return;
  for (const school in bookingsData[city]) select.innerHTML += `<option value="${school}">${school}</option>`;
  loadAvailableTimes();
}

function isWeekend(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isBusinessTime(timeStr) {
  if (!timeStr) return false;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
  if (hours < 9 || hours > 17) return false;
  if (hours === 17 && minutes > 0) return false;
  return true;
}

function getBookingCountForSlot(city, school, date, time) {
  if (!city || !school || !date || !time) return 0;
  if (!bookingsData[city] || !bookingsData[city][school]) return 0;
  return bookingsData[city][school].filter(b => b.date === date && b.time === time).length;
}

function isTimeSlotFull(city, school, date, time) {
  return getBookingCountForSlot(city, school, date, time) >= maxUsersPerTimeSlot;
}

function getRemainingSeats(city, school, date, time) {
  return Math.max(0, maxUsersPerTimeSlot - getBookingCountForSlot(city, school, date, time));
}

function saveMaxUsersPerTimeSlot(newValue) {
  maxUsersPerTimeSlot = newValue;
  localStorage.setItem('maxUsersPerTimeSlot', String(maxUsersPerTimeSlot));
}

function loadAvailableTimes() {
  const city   = document.getElementById('citySelect').value;
  const school = document.getElementById('schoolSelect').value;
  const date   = document.getElementById('dateSelect').value;
  const timeSelect    = document.getElementById('timeSelect');
  const suggestionsDiv = document.getElementById('suggestions');

  timeSelect.innerHTML = '<option value="">Escolha um horário</option>';
  suggestionsDiv.textContent = 'Escolha cidade, escola e data para ver sugestões.';
  if (!city || !school || !date) return;

  if (!isWednesday(date)) {
    timeSelect.innerHTML = '<option value="">Escolha uma quarta-feira</option>';
    suggestionsDiv.textContent = 'Agendamentos só podem ser feitos nas quartas-feiras.';
    return;
  }

  const distribution = getDistributionForDate(city, school, date);
  const distributionDefined = distribution && Object.keys(distribution).length > 0;
  const schoolStock = getSchoolStock(city, school);
  const totalStock = schoolStock.totalStock || 0;

  const freeSlots = slots.filter(s => {
    const slotHasStock = distributionDefined ? (distribution[s] || 0) > 0 : totalStock !== 0;
    return !isTimeSlotFull(city, school, date, s) && isBusinessTime(s) && slotHasStock;
  });

  if (freeSlots.length === 0) {
    timeSelect.innerHTML = '<option value="">Sem horários disponíveis</option>';
  } else {
    freeSlots.forEach(s => {
      const seats = getRemainingSeats(city, school, date, s);
      const stockQty = distribution[s] || 0;
      const stockLabel = distributionDefined ? ` • ${stockQty} litros` : '';
      const label = seats === 1 ? `${s} — 1 vaga restante${stockLabel}` : `${s} — ${seats} vagas restantes${stockLabel}`;
      timeSelect.innerHTML += `<option value="${s}">${label}</option>`;
    });
  }

  const suggestedSlots = getStockSuggestedSlots(city, school, date, freeSlots);
  const suggestions = smartSuggestAvailableSlots(suggestedSlots, date);
  suggestionsDiv.innerHTML = suggestions.length === 0
    ? 'Nenhuma sugestão — sem horários livres nessa data.'
    : '<strong>Próximos horários sugeridos:</strong> ' + suggestions.join(' — ');
}

function smartSuggestAvailableSlots(freeSlots, dateStr, count = 3) {
  if (!freeSlots || freeSlots.length === 0) return [];
  const today = new Date();
  const selectedDate = dateStr ? new Date(dateStr + 'T00:00:00') : null;
  let filtered = freeSlots.slice();
  if (selectedDate && selectedDate.toDateString() === today.toDateString()) {
    const curH = today.getHours();
    filtered = filtered.filter(slot => parseInt(slot.split(':')[0], 10) > curH);
  }
  return filtered.slice(0, count);
}

document.getElementById('dateSelect').addEventListener('change', loadAvailableTimes);
document.getElementById('schoolSelect').addEventListener('change', loadAvailableTimes);
document.getElementById('deliveryTypeSelect').addEventListener('change', toggleAddressField);

function toggleAddressField() {
  const deliveryType = document.getElementById('deliveryTypeSelect')?.value;
  const addressGroup = document.getElementById('addressGroup');
  const addressInput = document.getElementById('homeAddressInput');
  if (!addressGroup || !addressInput) return;
  const show = deliveryType === 'Entrega em casa';
  addressGroup.style.display = show ? 'block' : 'none';
  if (!show) addressInput.value = '';
}

function getWeekKey(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function isWednesday(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 3;
}

function getNextWednesday(fromDate = new Date()) {
  const date = new Date(fromDate);
  const day = date.getDay();
  const offset = (3 - day + 7) % 7;
  if (offset === 0) return date;
  date.setDate(date.getDate() + offset);
  return date;
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function userHasBookingThisWeek(username, dateStr) {
  if (!username || !dateStr) return false;
  const weekKey = getWeekKey(dateStr);
  for (const city in bookingsData) {
    for (const school in bookingsData[city]) {
      const found = bookingsData[city][school].some(b => b.user === username && !['rejeitado'].includes(b.status) && getWeekKey(b.date) === weekKey);
      if (found) return true;
    }
  }
  return false;
}

function makeBooking() {
  if (!loggedUser) { alert('Faça login para agendar.'); return; }
  const city         = document.getElementById('citySelect').value;
  const school       = document.getElementById('schoolSelect').value;
  const date         = document.getElementById('dateSelect').value;
  const time         = document.getElementById('timeSelect').value;
  const deliveryType = document.getElementById('deliveryTypeSelect').value;
  const homeAddress  = document.getElementById('homeAddressInput')?.value?.trim() || '';
  const msg          = document.getElementById('userMessage');

  if (!city || !school || !date || !time || !deliveryType) {
    alert('Preencha todos os campos');
    return;
  }
  // Temporarily disable weekly restriction to restore booking functionality for users.
  // Uncomment the lines below to re-enable "one booking per week" rule per user.
  // if (!isWednesday(date)) {
  //   alert('Agendamentos só podem ser feitos para quartas-feiras.');
  //   return;
  // }
  // if (userType === 'user' && userHasBookingThisWeek(loggedUser.username, date)) {
  //   alert('Você só pode fazer um agendamento por semana. Aguarde a próxima semana para reservar novamente.');
  //   return;
  // }
  if (userType === 'user' && loggedUser?.city && city !== loggedUser.city) {
    alert(`Usuários comuns só podem agendar para a cidade ${loggedUser.city}.`);
    return;
  }
  if (isDateInPast(date)) {
    alert('Não é possível agendar para datas passadas.');
    return;
  }
  if (deliveryType === 'Entrega em casa' && !homeAddress) {
    alert('Informe o endereço para entrega em casa.');
    return;
  }
  if (isWeekend(date)) {
    alert('Agendamento indisponível aos sábados e domingos. Escolha um dia útil.');
    return;
  }
  if (!isBusinessTime(time)) {
    alert('Escolha um horário dentro do expediente comercial (09:00–17:00).');
    return;
  }
  if (isTimeSlotFull(city, school, date, time)) {
    msg.textContent = 'Poxa, o horário está esgotado. Volte na próxima.';
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
    loadAvailableTimes();
    return;
  }

  bookingsData[city][school].push({
    user: loggedUser.username,
    login: loggedUser.username,
    fullName: loggedUser.name || loggedUser.username,
    createdBy: loggedUser.username,
    cpf: loggedUser.cpf || '---',
    date,
    time,
    deliveryType,
    homeAddress: deliveryType === 'Entrega em casa' ? homeAddress : '',
    driverAssigned: null,
    driverName: null,
    driverLocation: 'Aguardando motorista',
    driverRouteStage: 0,
    driverStatus: deliveryType === 'Entrega em casa' ? 'pendente' : 'não aplicável',
    status: 'pendente'
  });
  localStorage.setItem('agendamentos', JSON.stringify(bookingsData));
  msg.textContent = 'Agendamento enviado! Aguarde aprovação.';
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 3000);
  loadAvailableTimes();
  loadUserBookings();
}

/* ================== Notificações ================== */
function updateNotificationIcon() {
  const container = document.getElementById('notification');
  if (container) {
    container.innerHTML = '🔔';
    container.classList.remove('has-badge');
  }
  if (!loggedUser || !Array.isArray(loggedUser.notifications)) return;
  const count = loggedUser.notifications.length;
  if (count > 0) {
    const span = document.createElement('span');
    span.className = 'badge';
    span.textContent = count;
    container.appendChild(span);
    container.classList.add('has-badge');
  }
}

function openNotificationsModal() {
  if (!loggedUser) return alert('Faça login para ver notificações.');
  const modal = document.getElementById('modalNotif');
  const list = document.getElementById('notifList');
  list.innerHTML = '';
  if (!Array.isArray(loggedUser.notifications) || loggedUser.notifications.length === 0) {
    list.innerHTML = '<p>Sem notificações novas.</p>';
  } else {
    loggedUser.notifications.forEach(n => {
      const p = document.createElement('p');
      const time = n.timestamp ? new Date(n.timestamp).toLocaleString() : '';
      p.innerHTML = `<strong>${time}</strong><br>${n.text}`;
      p.style.marginBottom = '10px';
      list.appendChild(p);
      list.appendChild(document.createElement('hr'));
    });
  }
  modal.style.display = 'block';
}

const notificationButton = document.getElementById('notification');
if (notificationButton) {
  notificationButton.addEventListener('click', openNotificationsModal);
}

function markAllRead() {
  if (!loggedUser) return;
  const idx = normalUsers.findIndex(u => u.username === loggedUser.username);
  if (idx !== -1) {
    normalUsers[idx].notifications = [];
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    loggedUser.notifications = [];
    localStorage.setItem('loggedUser', JSON.stringify({ username: loggedUser.username, password: loggedUser.password }));
    updateNotificationIcon();
    document.getElementById('notifList').innerHTML = '<p>Sem notificações novas.</p>';
  }
}

function closeModalNotif() { document.getElementById('modalNotif').style.display = 'none'; }

/* ================== Perfil e Suporte ================== */
const profileIcon = document.getElementById('profileIcon');
if (profileIcon) {
  profileIcon.addEventListener('click', () => {
    if (!loggedUser) return alert('Faça login para ver o perfil.');
    document.getElementById('profileName').textContent     = loggedUser.name     || loggedUser.username;
    document.getElementById('profileCPF').textContent      = loggedUser.cpf      || '---';
    document.getElementById('profileMatricula').textContent= loggedUser.matricula || '---';
    document.getElementById('profileCity').textContent     = loggedUser.city || loggedUser.region || '---';
    document.getElementById('profileInfo').classList.remove('hidden');
  });
}

const profileIconDriver = document.getElementById('profileIconDriver');
if (profileIconDriver) {
  profileIconDriver.addEventListener('click', () => {
    if (!loggedUser) return alert('Faça login para ver o perfil.');
    const profileInfo = document.getElementById('profileInfo');
    if (profileInfo) {
      document.getElementById('profileName').textContent     = loggedUser.name     || loggedUser.username;
      document.getElementById('profileCPF').textContent      = loggedUser.cpf      || '---';
      document.getElementById('profileMatricula').textContent= loggedUser.matricula || '---';
      document.getElementById('profileCity').textContent     = loggedUser.city || loggedUser.region || '---';
      profileInfo.classList.remove('hidden');
    }
  });
}

const notificationIconDriver = document.getElementById('notificationDriver');
if (notificationIconDriver) {
  notificationIconDriver.addEventListener('click', () => {
    if (!loggedUser) return alert('Faça login para ver notificações.');
    const modal = document.getElementById('modalNotif');
    const list  = document.getElementById('notifList');
    list.innerHTML = '';
    if (!Array.isArray(loggedUser.notifications) || loggedUser.notifications.length === 0) {
      list.innerHTML = '<p>Sem notificações novas.</p>';
    } else {
      loggedUser.notifications.forEach(n => {
        const p = document.createElement('p');
        const time = n.timestamp ? new Date(n.timestamp).toLocaleString() : '';
        p.innerHTML = `<strong>${time}</strong><br>${n.text}`;
        p.style.marginBottom = '10px';
        list.appendChild(p);
        list.appendChild(document.createElement('hr'));
      });
    }
    modal.style.display = 'block';
  });
}

const supportIcon = document.getElementById('supportIcon');
if (supportIcon) {
  supportIcon.addEventListener('click', () => {
    const supportInfo = document.getElementById('supportInfo');
    if (supportInfo) supportInfo.classList.toggle('hidden');
  });
}

/* ================== Configuração (Engrenagem) ================== */
const configIcon = document.getElementById('configIcon');
if (configIcon) {
  configIcon.addEventListener('click', () => {
    if (!['admin','master'].includes(userType)) { alert('Somente o administrador ou usuário master pode acessar configurações.'); return; }
    openAdminConfig();
  });
}
const adminConfigIcon = document.getElementById('adminConfigIcon');
if (adminConfigIcon) {
  adminConfigIcon.addEventListener('click', () => {
    if (!['admin','master'].includes(userType)) { alert('Somente o administrador ou usuário master pode acessar configurações.'); return; }
    openAdminConfig();
  });
}
const trashIcon = document.getElementById('trashIcon');
if (trashIcon) {
  trashIcon.addEventListener('click', () => {
    if (!['admin','master'].includes(userType)) { alert('Somente o administrador ou usuário master pode acessar a lixeira.'); return; }
    openTrash();
  });
}

/* ================== Configurações ADM ================== */
function openAdminConfig() {
  const listDiv = document.getElementById('adminUserList');
  listDiv.innerHTML = '';
  const capacityControl = document.createElement('div');
  capacityControl.style.cssText = 'border:1px solid #007BFF;border-radius:6px;padding:12px;margin-bottom:16px;background:#f5f9ff;';
  capacityControl.innerHTML = `
    <strong>Capacidade por horário</strong><br>
    <p>Defina quantos usuários podem reservar o mesmo horário.</p>
    <input id="maxCapacityInput" type="number" min="1" value="${maxUsersPerTimeSlot}" style="width:100px;padding:6px;margin-right:8px;" />
    <button onclick="updateMaxCapacity()" style="background:#007BFF;color:#fff;border:none;padding:6px 10px;border-radius:4px;">Salvar</button>
    <p style="margin-top:8px;font-size:0.95rem;color:#333;">Atualização imediata: horários livres e mensagens de limite serão aplicados</p>
  `;
  listDiv.appendChild(capacityControl);
  if (!normalUsers || normalUsers.length === 0) {
    listDiv.innerHTML += '<p>Nenhum usuário cadastrado.</p>';
  } else {
    normalUsers.forEach((u, i) => {
      const status = u.blocked ? '🚫 Bloqueado' : '✅ Ativo';
      const div = document.createElement('div');
      div.style.cssText = 'border:1px solid #ccc;border-radius:6px;padding:8px;margin-bottom:10px';
      div.innerHTML = `
        <strong>${u.name || '(sem nome)'}</strong><br>
        <b>Email:</b> ${u.username}<br>
        <b>Senha:</b> ${u.password}<br>
        <b>Criado em:</b> ${u.createdAt || '---'}<br>
        <button onclick="changeUserPassword(${i})" style="margin-right:8px;margin-top:8px;">Trocar senha</button>
        <b>Último acesso:</b> ${u.lastLogin || '---'}<br>
        <b>Status:</b> ${status}<br><br>
        <button onclick="toggleBlockUser(${i})" style="margin-right:8px">${u.blocked ? 'Desbloquear' : 'Bloquear'}</button>
        <button onclick="deleteUser(${i})" style="background:#6c757d">Excluir</button>
      `;
      listDiv.appendChild(div);
    });
  }

  const pendingDriversControl = document.createElement('div');
  pendingDriversControl.style.cssText = 'border:1px solid #ffc107;border-radius:6px;padding:12px;margin-top:16px;background:#fff8e1;';
  pendingDriversControl.innerHTML = `
    <strong>Solicitações de cadastro de motoristas</strong><br>
    <p>Aprovar ou rejeitar cadastros aguardando autorização.</p>
  `;
  listDiv.appendChild(pendingDriversControl);

  if (!pendingDriverRequests || pendingDriverRequests.length === 0) {
    pendingDriversControl.innerHTML += '<p>Nenhuma solicitação pendente.</p>';
  } else {
    pendingDriverRequests.forEach((request, i) => {
      const div = document.createElement('div');
      div.style.cssText = 'border:1px solid #f0c36d;border-radius:6px;padding:8px;margin-top:8px;background:#fffdf5;';
      div.innerHTML = `
        <strong>${request.name || request.username}</strong><br>
        <b>Login:</b> ${request.username}<br>
        <b>CPF:</b> ${request.cpf || '---'}<br>
        <b>CNH:</b> ${request.cnhNumber || '---'}<br>
        <b>Região:</b> ${request.region || '---'}<br>
        <b>Placa:</b> ${request.licensePlate || '---'}<br><br>
        <button onclick="approveDriverRequest(${i})" style="margin-right:8px;background:#28a745;color:#fff;border:none;padding:6px 10px;border-radius:4px;">Aprovar</button>
        <button onclick="rejectDriverRequest(${i})" style="background:#dc3545;color:#fff;border:none;padding:6px 10px;border-radius:4px;">Rejeitar</button>
      `;
      pendingDriversControl.appendChild(div);
    });
  }

  const supportControl = document.createElement('div');
  supportControl.style.cssText = 'border:1px solid #6c757d;border-radius:6px;padding:12px;margin-top:16px;background:#f8f9fa;';
  supportControl.innerHTML = `
    <strong>Solicitações de suporte</strong><br>
    <p>Visualize pedidos de suporte recebidos pelo sistema.</p>
    <div id="supportRequestsList"></div>
  `;
  listDiv.appendChild(supportControl);
  const supportRequestsList = document.getElementById('supportRequestsList');
  if (!supportRequests || supportRequests.length === 0) {
    supportRequestsList.innerHTML = '<p>Nenhuma solicitação de suporte registrada.</p>';
  } else {
    supportRequests.forEach((request, i) => {
      const item = document.createElement('div');
      item.style.cssText = 'border:1px solid #ddd;border-radius:6px;padding:8px;margin-top:8px;';
      item.innerHTML = `<strong>${request.user || 'Usuário'}</strong><br>${request.message || '---'}<br><small>${request.createdAt || ''}</small>`;
      supportRequestsList.appendChild(item);
    });
  }

  const driverControl = document.createElement('div');
  driverControl.style.cssText = 'border:1px solid #28a745;border-radius:6px;padding:12px;margin-top:16px;background:#eff9f0;';
  driverControl.innerHTML = `
    <strong>Motoristas</strong><br>
    <p>Adicione ou gerencie motoristas da sua região.</p>
    <input id="newDriverUsername" placeholder="Login do motorista" style="width:100%;padding:6px;margin-top:6px;" />
    <input id="newDriverPassword" placeholder="Senha do motorista" type="password" style="width:100%;padding:6px;margin-top:6px;" />
    <input id="newDriverName" placeholder="Nome do motorista" style="width:100%;padding:6px;margin-top:6px;" />
    <input id="newDriverRegion" placeholder="Região (cidade)" style="width:100%;padding:6px;margin-top:6px;" />
    <button onclick="addDriver()" style="margin-top:8px;padding:6px 10px;background:#28a745;color:#fff;border:none;border-radius:4px;">Adicionar motorista</button>
    <div id="driverMessage" style="margin-top:10px;font-size:0.95rem;color:#155724;"></div>
  `;
  listDiv.appendChild(driverControl);

  if (!driverUsers || driverUsers.length === 0) {
    listDiv.innerHTML += '<p>Nenhum motorista cadastrado.</p>';
  } else {
    driverUsers.forEach((u, i) => {
      const status = u.blocked ? '🚫 Bloqueado' : '✅ Ativo';
      const div = document.createElement('div');
      div.style.cssText = 'border:1px solid #ccc;border-radius:6px;padding:8px;margin-bottom:10px';
      div.innerHTML = `
        <strong>${u.name || '(sem nome)'}</strong><br>
        <b>Login:</b> ${u.username}<br>
        <b>Região:</b> ${u.region || '---'}<br>
        <b>Último acesso:</b> ${u.lastLogin || '---'}<br>
        <b>Status:</b> ${status}<br><br>
        <button onclick="toggleBlockDriver(${i})" style="margin-right:8px">${u.blocked ? 'Desbloquear' : 'Bloquear'}</button>
        <button onclick="deleteDriver(${i})" style="background:#6c757d">Excluir</button>
      `;
      listDiv.appendChild(div);
    });
  }

  document.getElementById('modalAdminConfig').style.display = 'block';
}

function closeAdminConfig() { document.getElementById('modalAdminConfig').style.display = 'none'; }

function updateMaxCapacity() {
  const input = document.getElementById('maxCapacityInput');
  const newValue = parseInt(input.value, 10);
  if (Number.isNaN(newValue) || newValue < 1) {
    alert('Informe um número válido maior ou igual a 1.');
    input.value = maxUsersPerTimeSlot;
    return;
  }
  saveMaxUsersPerTimeSlot(newValue);
  alert(`Capacidade por horário ajustada para ${newValue} usuário(s).`);
  openAdminConfig();
}

function changeUserPassword(index) {
  const user = normalUsers[index];
  if (!user) return;
  const newPassword = prompt(`Nova senha para ${user.name || user.username}:`);
  if (!newPassword) return;
  normalUsers[index].password = newPassword.trim();
  localStorage.setItem('usuarios', JSON.stringify(normalUsers));
  openAdminConfig();
}

function toggleBlockUser(index) {
  normalUsers[index].blocked = !normalUsers[index].blocked;
  localStorage.setItem('usuarios', JSON.stringify(normalUsers));
  openAdminConfig();
}

function addDriver() {
  const username = document.getElementById('newDriverUsername').value.trim();
  const password = document.getElementById('newDriverPassword').value.trim();
  const name = document.getElementById('newDriverName').value.trim();
  const region = document.getElementById('newDriverRegion').value.trim();
  const driverMessage = document.getElementById('driverMessage');
  if (!username || !password || !name || !region) {
    driverMessage.textContent = 'Preencha todos os campos do motorista.';
    return;
  }
  if (driverUsers.find(d => d.username === username) || normalUsers.find(u => u.username === username) || pendingDriverRequests.find(u => u.username === username)) {
    driverMessage.textContent = 'Este login já está em uso.';
    return;
  }
  const newDriver = { username, password, name, role:'driver', region, notifications: [], lastLogin: null, blocked: false };
  driverUsers.push(newDriver);
  localStorage.setItem('motoristas', JSON.stringify(driverUsers));
  driverMessage.textContent = 'Motorista cadastrado com sucesso!';
  openAdminConfig();
}

function approveDriverRequest(index) {
  const request = pendingDriverRequests[index];
  if (!request) return;
  const approvedDriver = {
    username: request.username,
    password: request.password,
    name: request.name,
    role: 'driver',
    region: request.region || '---',
    cpf: request.cpf,
    birthDate: request.birthDate,
    cnhNumber: request.cnhNumber,
    cnhValidity: request.cnhValidity,
    cnhCategory: request.cnhCategory,
    rg: request.rg,
    phone: request.phone,
    address: request.address,
    licensePlate: request.licensePlate,
    vehicleModelYear: request.vehicleModelYear,
    availability: request.availability,
    photo: request.photo || '',
    notifications: [],
    lastLogin: null,
    blocked: false
  };
  driverUsers.push(approvedDriver);
  pendingDriverRequests.splice(index, 1);
  localStorage.setItem('motoristas', JSON.stringify(driverUsers));
  savePendingDriverRequests();
  openAdminConfig();
}

function rejectDriverRequest(index) {
  pendingDriverRequests.splice(index, 1);
  savePendingDriverRequests();
  openAdminConfig();
}

function toggleBlockDriver(index) {
  driverUsers[index].blocked = !driverUsers[index].blocked;
  localStorage.setItem('motoristas', JSON.stringify(driverUsers));
  openAdminConfig();
}

function deleteDriver(index) {
  if (confirm('Tem certeza que deseja excluir este motorista?')) {
    driverUsers.splice(index, 1);
    localStorage.setItem('motoristas', JSON.stringify(driverUsers));
    openAdminConfig();
  }
}

function deleteUser(index) {
  const u = normalUsers[index];
  if (!u) return;
  // Special confirmation when deleting a master account
  if (u.role === 'master') {
    const ok = confirm('ATENÇÃO: Você está prestes a excluir um usuário master. Ao confirmar, a sessão atual será encerrada e o sistema retornará à tela inicial. Confirma exclusão?');
    if (!ok) return;
    normalUsers.splice(index, 1);
    localStorage.setItem('usuarios', JSON.stringify(normalUsers));
    // clear current session and show login overlay
    localStorage.removeItem('loggedUser');
    loggedUser = null;
    userType = null;
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('userDashboard').classList.add('hidden');
    document.getElementById('driverDashboard').classList.add('hidden');
    document.getElementById('loginOverlay').style.display = 'flex';
    return;
  }

  if (confirm('Tem certeza que deseja excluir este usuário?')) {
    const currently = JSON.parse(localStorage.getItem('loggedUser') || 'null');
    if (currently && currently.username === normalUsers[index].username) {
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

/* ================== Utils ================== */
window.clearAppData = function () {
  localStorage.removeItem('usuarios');
  localStorage.removeItem('agendamentos');
  localStorage.removeItem('loggedUser');
  alert('Dados apagados. Recarregue a página.');
};
