const tonConnect = new TonConnectSDK.TonConnect({
  manifestUrl: 'http://localhost:8080/tonconnect-manifest.json'
});

let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
let walletAddress = localStorage.getItem('walletAddress');
let currentTaskIndex = null;

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function getRole() {
  return localStorage.getItem('userRole') || 'client';
}

function getNickname() {
  return localStorage.getItem('userNickname') || 'A';
}

function showNotification(message, type = 'info') {
  const notifications = document.getElementById('notifications');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notifications.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

async function connectWallet() {
  try {
    if (walletAddress && !confirm('Сменить кошелек?')) return;

    if (tonConnect.connected) {
      showNotification('Кошелек уже подключен', 'info');
      return;
    }

    openModal('connect-modal');
    
    const tonkeeperUniversalLink = await tonConnect.connect({
      universalLink: 'https://app.tonkeeper.com/ton-connect',
      bridgeUrl: 'https://bridge.tonapi.io/bridge'
    }, { timeout: 600000 });

    const connectBtn = document.getElementById('ton-connect-btn');
    connectBtn.textContent = 'Подключить через Tonkeeper';
    connectBtn.onclick = () => {
      console.log('Universal Link:', tonkeeperUniversalLink);
      window.open(tonkeeperUniversalLink, '_blank');
      showNotification('Откройте Tonkeeper и подтвердите подключение', 'info');
    };

    tonConnect.onStatusChange(async (wallet) => {
      console.log('Wallet status:', wallet);
      if (wallet && wallet.account) {
        walletAddress = wallet.account.address;
        localStorage.setItem('walletAddress', walletAddress);
        localStorage.setItem('walletBalance', await getBalance());
        document.getElementById('wallet-status').textContent = `Подключен: ${walletAddress.slice(0, 6)}...`;
        updateAvatar();
        renderTasks();
        closeModal('connect-modal');
        showNotification('Кошелек Tonkeeper успешно подключен', 'success');
      } else if (wallet === null) {
        console.log('Connection failed or aborted');
        showNotification('Подключение прервано. Проверьте Tonkeeper и повторите попытку', 'error');
      }
    });

  } catch (error) {
    console.error('Connection error:', error);
    if (error.message.includes('404')) {
      showNotification('Мост TON недоступен (404). Попробуйте позже', 'error');
    } else {
      showNotification(`Ошибка подключения: ${error.message}`, 'error');
    }
  }
}

async function getBalance() {
  try {
    if (!tonConnect.connected) return '0';
    // Здесь может быть реальный запрос к TON API
    return '10'; // Заглушка
  } catch (error) {
    showNotification('Ошибка получения баланса', 'error');
    return '0';
  }
}

async function sendPayment(amount, toAddress) {
  try {
    if (!tonConnect.connected) {
      throw new Error('Кошелек не подключен');
    }

    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 60,
      messages: [{
        address: toAddress,
        amount: String(Math.floor(amount * 1e9)), // TON в нанотонах
      }]
    };
    
    const result = await tonConnect.sendTransaction(transaction);
    showNotification('Платеж успешно отправлен', 'success');
    return result;
  } catch (error) {
    showNotification(`Ошибка платежа: ${error.message}`, 'error');
    throw error;
  }
}

function toggleRole() {
  const toggle = document.getElementById('role-toggle');
  const label = document.getElementById('role-label');
  if (toggle.checked) {
    localStorage.setItem('userRole', 'executor');
    label.textContent = 'Исполнитель';
    document.getElementById('task-form').style.display = 'none';
  } else {
    localStorage.setItem('userRole', 'client');
    label.textContent = 'Заказчик';
    document.getElementById('task-form').style.display = 'block';
  }
  renderTasks();
}

function updateAvatar() {
  const avatar = document.getElementById('user-avatar');
  if (avatar) avatar.textContent = getNickname().charAt(0).toUpperCase();
}

function toggleUserMenu(event) {
  const menu = document.getElementById('user-menu');
  menu.classList.toggle('visible');
  event.stopPropagation();
}

document.addEventListener('click', (event) => {
  const menu = document.getElementById('user-menu');
  if (menu.classList.contains('visible') && !menu.contains(event.target) && !document.getElementById('user-avatar').contains(event.target)) {
    menu.classList.remove('visible');
  }
});

function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function logout() {
  tonConnect.disconnect();
  localStorage.clear();
  walletAddress = null;
  updateAvatar();
  renderTasks();
  showNotification('Выход выполнен', 'success');
}

function openProfile() {
  if (!walletAddress) {
    connectWallet();
    return;
  }
  window.location.href = 'profile.html';
}

async function createTask() {
  if (!walletAddress) {
    connectWallet();
    return;
  }
  
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-description').value.trim();
  const amount = parseFloat(document.getElementById('task-amount').value);
  const deadline = document.getElementById('task-deadline').value;

  if (!title || !description || !amount || amount <= 0) {
    showNotification('Заполните все поля корректно', 'error');
    return;
  }

  try {
    const task = {
      id: Date.now(),
      title,
      description,
      amount,
      deadline,
      creator: walletAddress,
      executor: null,
      status: 'open',
      responses: [],
      chat: [],
      reportFile: null,
      completed: false,
      clientRating: null,
      executorRating: null,
      depositTx: null
    };

    const escrowAddress = 'EQ...'; // Замените на реальный escrow-адрес
    task.depositTx = await sendPayment(amount, escrowAddress);
    
    tasks.push(task);
    saveTasks();
    renderTasks();
    
    document.getElementById('task-title').value = '';
    document.getElementById('task-description').value = '';
    document.getElementById('task-amount').value = '';
    
    showNotification('Задание создано и оплачено', 'success');
  } catch (error) {
    showNotification('Ошибка создания задания', 'error');
  }
}

function respondToTask(index) {
  if (!walletAddress) {
    connectWallet();
    return;
  }
  if (getRole() !== 'executor') {
    showNotification('Только исполнители могут откликаться', 'error');
    return;
  }
  currentTaskIndex = index;
  openModal('response-modal');
}

function submitResponse() {
  const message = document.getElementById('response-message').value.trim();
  if (!message || currentTaskIndex === null) {
    showNotification('Введите сообщение', 'error');
    return;
  }
  const task = tasks[currentTaskIndex];
  if (task.status !== 'open' || task.responses.some(r => r.wallet === walletAddress)) {
    showNotification('Вы уже откликнулись или задача закрыта', 'error');
    closeModal('response-modal');
    return;
  }
  task.responses.push({ wallet: walletAddress, message });
  saveTasks();
  closeModal('response-modal');
  renderTasks();
  showNotification('Отклик отправлен', 'success');
}

async function chooseExecutor(index, executorWallet) {
  const task = tasks[index];
  if (task.creator !== walletAddress || task.status !== 'open') {
    showNotification('Вы не можете выбрать исполнителя', 'error');
    return;
  }
  task.executor = executorWallet;
  task.status = 'in_progress';
  saveTasks();
  renderTasks();
  showNotification('Исполнитель выбран', 'success');
}

function renderTasks() {
  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';
  const role = getRole();
  let filteredTasks = [];
  if (role === 'client') {
    filteredTasks = tasks.filter(t => t.creator === walletAddress && !t.completed);
  } else {
    filteredTasks = tasks.filter(t => t.status === 'open' && !t.responses.some(r => r.wallet === walletAddress));
  }

  filteredTasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    let action = '';
    if (role === 'executor' && task.status === 'open') {
      action = `<button onclick="respondToTask(${index})">Откликнуться</button>`;
    } else if (role === 'client' && task.status === 'open' && task.responses.length) {
      action = `
        <select onchange="chooseExecutor(${index}, this.value)">
          <option value="">Выбрать исполнителя</option>
          ${task.responses.map(r => `<option value="${r.wallet}">${r.message} (${r.wallet.slice(0, 6)}...)</option>`).join('')}
        </select>`;
    } else if ((task.executor === walletAddress || task.creator === walletAddress) && task.status !== 'open') {
      action = `<button onclick="openProfile()">В профиль</button>`;
    }
    li.innerHTML = `
      <div>
        <div class="task-header">
          <strong>${task.title}</strong>
          <span class="deadline ${task.deadline}">${task.deadline.replace('_', ' ')}</span>
        </div>
        <p>${task.description}</p>
        <p>Цена: ${task.amount} TON</p>
        <p>Статус: ${task.status}</p>
      </div>
      ${action}
    `;
    taskList.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const role = getRole();
  const toggle = document.getElementById('role-toggle');
  const label = document.getElementById('role-label');
  if (role === 'executor') {
    toggle.checked = true;
    label.textContent = 'Исполнитель';
    document.getElementById('task-form').style.display = 'none';
  } else {
    toggle.checked = false;
    label.textContent = 'Заказчик';
    document.getElementById('task-form').style.display = 'block';
  }
  
  // Восстанавливаем сессию TonConnect, если она была
  try {
    await tonConnect.restoreConnection();
    if (tonConnect.connected && tonConnect.wallet) {
      walletAddress = tonConnect.wallet.account.address;
      localStorage.setItem('walletAddress', walletAddress);
      showNotification('Сессия кошелька восстановлена', 'success');
    }
  } catch (error) {
    console.error('Ошибка восстановления сессии:', error);
  }

  if (!walletAddress) connectWallet();
  updateAvatar();
  renderTasks();
});