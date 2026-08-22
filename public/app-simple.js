// ===== TEAMTASKS - SIMPLIFIED VERSION =====
let currentUser = null;
let allTasks = [];
let allUsers = [
  { id: 1, username: 'manager', name: 'Manager Admin', role: 'manager' },
  { id: 2, username: 'john', name: 'John', role: 'employee' },
  { id: 3, username: 'sarah', name: 'Sarah', role: 'employee' },
  { id: 4, username: 'alex', name: 'Alex', role: 'employee' }
];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  checkLogin();
  setupEventListeners();
});

function checkLogin() {
  const user = localStorage.getItem('user');
  if (user) {
    currentUser = JSON.parse(user);
    showDashboard();
  } else {
    showLogin();
  }
}

function setupEventListeners() {
  // Login
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Task modal
  const addTaskBtn = document.getElementById('addTaskBtn');
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
      document.getElementById('addTaskModal').style.display = 'flex';
    });
  }

  const closeTaskModal = document.getElementById('closeTaskModal');
  if (closeTaskModal) {
    closeTaskModal.addEventListener('click', () => {
      document.getElementById('addTaskModal').style.display = 'none';
    });
  }

  const saveTaskBtn = document.getElementById('saveTaskBtn');
  if (saveTaskBtn) {
    saveTaskBtn.addEventListener('click', handleAddTask);
  }
}

// ===== LOGIN =====
function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  const credentials = {
    'manager': 'password123',
    'john': 'password123',
    'sarah': 'password123',
    'alex': 'password123'
  };

  if (credentials[username] === password) {
    const user = allUsers.find(u => u.username === username);
    currentUser = user;
    localStorage.setItem('user', JSON.stringify(currentUser));
    showDashboard();
    return;
  }

  alert('❌ Invalid username or password');
  document.getElementById('loginForm').reset();
}

function handleLogout() {
  if (confirm('Logout?')) {
    currentUser = null;
    localStorage.removeItem('user');
    localStorage.removeItem('tasks');
    showLogin();
  }
}

// ===== DASHBOARD =====
function showLogin() {
  document.getElementById('loginContainer').style.display = 'flex';
  document.getElementById('dashboardContainer').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('dashboardContainer').style.display = 'block';
  document.getElementById('userName').textContent = currentUser.name;
  loadTasks();
  renderDashboard();
}

function loadTasks() {
  const saved = localStorage.getItem('tasks');
  allTasks = saved ? JSON.parse(saved) : [
    {
      id: 1,
      name: 'Design Dashboard',
      assignedTo: 'john',
      deadline: '2026-08-28',
      urgency: 'high',
      status: 'in-progress',
      createdBy: 'manager',
      description: 'Create modern UI'
    },
    {
      id: 2,
      name: 'Setup Backend',
      assignedTo: 'alex',
      deadline: '2026-08-25',
      urgency: 'high',
      status: 'todo',
      createdBy: 'manager',
      description: 'Configure server'
    }
  ];
}

function renderDashboard() {
  const statuses = ['todo', 'in-progress', 'done', 'need-help', 'hold', 'future'];
  const dashboard = document.getElementById('kanbanBoard');
  
  if (!dashboard) return;

  dashboard.innerHTML = '';

  statuses.forEach(status => {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.id = `column-${status}`;

    const title = document.createElement('h3');
    title.textContent = status.replace('-', ' ').toUpperCase();
    column.appendChild(title);

    const cards = allTasks.filter(t => t.status === status);
    cards.forEach(task => {
      const card = createTaskCard(task);
      column.appendChild(card);
    });

    dashboard.appendChild(column);
  });

  setupDragDrop();
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card urgency-${task.urgency}`;
  card.draggable = true;
  card.id = `task-${task.id}`;

  const urgencyColor = {
    high: '#FF6B6B',
    medium: '#FFA500',
    low: '#95E1D3'
  };

  card.innerHTML = `
    <div style="border-top: 4px solid ${urgencyColor[task.urgency] || '#999'}; padding-top: 8px;">
      <strong>${task.name}</strong>
      <p style="font-size: 11px; color: #666; margin: 4px 0;">👤 ${task.assignedTo}</p>
      <p style="font-size: 10px; color: #999;">📅 ${task.deadline}</p>
      <button onclick="editTask(${task.id})" style="width: 100%; padding: 4px; margin-top: 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
    </div>
  `;

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('fromStatus', task.status);
  });

  return card;
}

function setupDragDrop() {
  const columns = document.querySelectorAll('.kanban-column');
  
  columns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      column.style.backgroundColor = 'rgba(0,0,0,0.05)';
    });

    column.addEventListener('dragleave', () => {
      column.style.backgroundColor = 'transparent';
    });

    column.addEventListener('drop', (e) => {
      e.preventDefault();
      const taskId = parseInt(e.dataTransfer.getData('taskId'));
      const newStatus = column.id.replace('column-', '');
      
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        task.status = newStatus;
        localStorage.setItem('tasks', JSON.stringify(allTasks));
        renderDashboard();
      }
      
      column.style.backgroundColor = 'transparent';
    });
  });
}

function handleAddTask() {
  const name = document.getElementById('taskName').value.trim();
  const assignedTo = document.getElementById('assignedTo').value;
  const deadline = document.getElementById('taskDeadline').value;
  const urgency = document.getElementById('taskUrgency').value;
  const description = document.getElementById('taskDescription').value;

  if (!name) {
    alert('Task name required');
    return;
  }

  const newTask = {
    id: Date.now(),
    name,
    assignedTo,
    deadline,
    urgency,
    status: 'todo',
    createdBy: currentUser.username,
    description
  };

  allTasks.push(newTask);
  localStorage.setItem('tasks', JSON.stringify(allTasks));

  document.getElementById('addTaskForm').reset();
  document.getElementById('addTaskModal').style.display = 'none';
  renderDashboard();
}

function editTask(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;

  const newName = prompt('Task name:', task.name);
  if (newName !== null) {
    task.name = newName;
    localStorage.setItem('tasks', JSON.stringify(allTasks));
    renderDashboard();
  }
}

// Close modal on outside click
window.addEventListener('click', (e) => {
  const modal = document.getElementById('addTaskModal');
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});
