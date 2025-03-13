let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
const walletAddress = localStorage.getItem('walletAddress');
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

function updateAvatar() {
  const avatar = document.getElementById('profile-avatar');
  if (avatar) avatar.textContent = getNickname().charAt(0).toUpperCase();
}

function calculateRating() {
  const role = getRole();
  const relevantTasks = tasks.filter(t => t.completed && (t[role === 'client' ? 'creator' : 'executor']) === walletAddress);
  const ratings = relevantTasks.map(t => role === 'client' ? t.executorRating : t.clientRating).filter(r => r);
  return ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0;
}

function renderActiveTasks() {
  const taskList = document.getElementById('active-tasks');
  taskList.innerHTML = '';
  const activeTasks = tasks.filter(t => !t.completed && (t.creator === walletAddress || t.executor === walletAddress));
  if (!activeTasks.length) {
    taskList.innerHTML = '<li class="task-item">Нет активных заданий</li>';
    return;
  }
  activeTasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    let action = `<button onclick="openChat(${index})">Чат</button>`;
    if (getRole() === 'executor' && task.status === 'in_progress' && task.executor === walletAddress) {
      action += `<button onclick="openChat(${index}); document.getElementById('report-section').style.display = 'block'">Сдать отчет</button>`;
    } else if (getRole() === 'client' && task.status === 'submitted' && task.creator === walletAddress) {
      action += `<button onclick="confirmCompletion(${index})">Подтвердить</button>`;
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
        ${task.reportFile ? `<a href="${task.reportFile}" download>Отчет</a>` : ''}
      </div>
      <div>${action}</div>
    `;
    taskList.appendChild(li);
  });
}

function renderCompletedTasks() {
  const taskList = document.getElementById('completed-tasks');
  taskList.innerHTML = '';
  const completedTasks = tasks.filter(t => t.completed && (t.creator === walletAddress || t.executor === walletAddress));
  if (!completedTasks.length) {
    taskList.innerHTML = '<li class="task-item">Нет выполненных заданий</li>';
    return;
  }
  completedTasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.innerHTML = `
      <div>
        <div class="task-header">
          <strong>${task.title}</strong>
          <span class="deadline ${task.deadline}">${task.deadline.replace('_', ' ')}</span>
        </div>
        <p>${task.description}</p>
        <p>Цена: ${task.amount} TON</p>
        ${task.clientRating ? `<p>Оценка исполнителя: ${task.clientRating}/5</p>` : ''}
        ${task.executorRating ? `<p>Оценка заказчика: ${task.executorRating}/5</p>` : ''}
      </div>
      <div><button onclick="openChat(${index})">Чат</button></div>
    `;
    taskList.appendChild(li);
  });
}

function openChat(index) {
  currentTaskIndex = index;
  const task = tasks[index];
  const chatSection = document.getElementById('chat-section');
  chatSection.style.display = 'block';
  document.getElementById('chat-task-title').textContent = task.title;
  const messages = document.getElementById('chat-messages');
  messages.innerHTML = task.chat.length ? task.chat.map(msg => `
    <div class="chat-message ${msg.sender === walletAddress ? 'sent' : 'received'}">
      <p>${msg.message}</p>
      <span>${new Date(msg.timestamp).toLocaleString()}</span>
    </div>
  `).join('') : '<p>Нет сообщений</p>';
  document.getElementById('report-section').style.display = (getRole() === 'executor' && task.status === 'in_progress' && task.executor === walletAddress) ? 'block' : 'none';
  document.getElementById('rating-section').style.display = (task.completed && ((!task.clientRating && task.creator === walletAddress) || (!task.executorRating && task.executor === walletAddress))) ? 'block' : 'none';
}

function closeChat() {
  document.getElementById('chat-section').style.display = 'none';
}

function sendMessage() {
  const message = document.getElementById('chat-input').value.trim();
  if (!message || currentTaskIndex === null) return;
  const task = tasks[currentTaskIndex];
  task.chat.push({ sender: walletAddress, message, timestamp: new Date().toISOString() });
  saveTasks();
  document.getElementById('chat-input').value = '';
  openChat(currentTaskIndex);
}

function submitReport() {
  const task = tasks[currentTaskIndex];
  if (getRole() !== 'executor' || task.status !== 'in_progress' || task.executor !== walletAddress) {
    alert('Вы не можете сдать отчет!');
    return;
  }
  const file = document.getElementById('report-file').files[0];
  if (!file) {
    alert('Выберите файл!');
    return;
  }
  task.reportFile = URL.createObjectURL(file);
  task.status = 'submitted';
  saveTasks();
  renderActiveTasks();
  openChat(currentTaskIndex);
}

function confirmCompletion(index) {
  const task = tasks[index];
  if (getRole() !== 'client' || task.status !== 'submitted' || task.creator !== walletAddress) {
    alert('Вы не можете подтвердить!');
    return;
  }
  task.status = 'completed';
  task.completed = true;
  saveTasks();
  renderActiveTasks();
  renderCompletedTasks();
  openChat(index);
}

function submitRating() {
  const rating = parseInt(document.getElementById('rating-input').value);
  if (!rating || rating < 1 || rating > 5 || currentTaskIndex === null) {
    alert('Оценка должна быть от 1 до 5!');
    return;
  }
  const task = tasks[currentTaskIndex];
  if (getRole() === 'client' && !task.clientRating) {
    task.clientRating = rating;
  } else if (getRole() === 'executor' && !task.executorRating) {
    task.executorRating = rating;
  } else {
    alert('Вы уже поставили оценку!');
    return;
  }
  saveTasks();
  renderCompletedTasks();
  openChat(currentTaskIndex);
  document.getElementById('user-rating').textContent = calculateRating();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!walletAddress) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('profile-role').textContent = `Роль: ${getRole() === 'client' ? 'Заказчик' : 'Исполнитель'}`;
  document.getElementById('wallet-address').textContent = walletAddress;
  document.getElementById('wallet-balance').textContent = `${localStorage.getItem('walletBalance') || 0} TON`;
  document.getElementById('user-rating').textContent = calculateRating();
  updateAvatar();
  renderActiveTasks();
  renderCompletedTasks();
});