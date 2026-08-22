const API_URL = 'http://localhost:5000/api';

let currentUser = null;
let allTasks = [];
let allUsers = [];
let currentTask = null;
let selectedFiles = { photos: [], docs: [] };

// ============== INITIALIZATION ==============
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkLogin();
});

function setupEventListeners() {
  // Login
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Tasks
  document.getElementById('addTaskBtn').addEventListener('click', openNewTaskModal);
  document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
  document.getElementById('deleteTaskBtn').addEventListener('click', deleteTask);
  document.getElementById('cancelTaskBtn').addEventListener('click', closeTaskModal);
  document.getElementById('taskStatus').addEventListener('change', (e) => {
    if (currentTask && currentTask.id) {
      updateTaskStatus(currentTask.id, e.target.value);
    }
  });

  // File uploads
  document.getElementById('photoUpload').addEventListener('click', () => {
    document.getElementById('photoInput').click();
  });
  document.getElementById('docUpload').addEventListener('click', () => {
    document.getElementById('docInput').click();
  });
  document.getElementById('photoInput').addEventListener('change', handlePhotoUpload);
  document.getElementById('docInput').addEventListener('change', handleDocUpload);

  // Users
  document.getElementById('addUserBtn').addEventListener('click', openUserModal);
  document.getElementById('createUserBtn').addEventListener('click', createUser);
  document.getElementById('cancelUserBtn').addEventListener('click', closeUserModal);

  // Modal close
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      modal.classList.remove('active');
    });
  });

  // Tag input
  document.getElementById('tagInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(e.target.value);
      e.target.value = '';
    }
  });
}

// ============== LOGIN ==============
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
      showDashboard();
    } else {
      alert('Invalid credentials');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed');
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('user');
  location.reload();
}

function checkLogin() {
  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showDashboard();
  }
}

// ============== DASHBOARD ==============
async function showDashboard() {
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('dashboardContainer').style.display = 'block';

  // Show/hide manager buttons
  if (currentUser.role === 'manager') {
    document.getElementById('addTaskBtn').style.display = 'inline-block';
    document.getElementById('addUserBtn').style.display = 'inline-block';
  }

  document.getElementById('userGreeting').textContent = `Welcome, ${currentUser.name}!`;

  await loadUsers();
  await loadTasks();
  setupDragAndDrop();
}

async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/users`);
    allUsers = await response.json();
    
    // Populate user select for tagging
    const userSelect = document.getElementById('userSelect');
    userSelect.innerHTML = '<option value="">Select user to tag...</option>';
    allUsers.forEach(user => {
      if (user.id !== currentUser.id) {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        userSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

async function loadTasks() {
  try {
    const response = await fetch(`${API_URL}/tasks`);
    allTasks = await response.json();
    renderTasks();
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

function renderTasks() {
  // Clear all columns
  ['todo', 'in-progress', 'done', 'need-help', 'hold', 'future'].forEach(status => {
    document.getElementById(status).innerHTML = '';
  });

  // Filter tasks based on user role
  const tasksToShow = currentUser.role === 'manager' 
    ? allTasks 
    : allTasks.filter(t => 
        t.assignedTo.includes(currentUser.id) || 
        t.taggedFor.includes(currentUser.id)
      );

  // Render tasks in their columns
  tasksToShow.forEach(task => {
    const columnId = task.status;
    const column = document.getElementById(columnId);
    
    if (column) {
      const card = createTaskCard(task);
      column.appendChild(card);
    }
  });
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card urgency-${task.urgency}`;
  card.draggable = true;
  card.dataset.taskId = task.id;

  const assignedUser = allUsers.find(u => u.id === task.assignedTo[0]);
  const deadline = new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  card.innerHTML = `
    <div class="task-name">${task.name}</div>
    <div class="task-info">
      ${assignedUser ? `👤 ${assignedUser.name}` : ''}
      <br>
      📅 ${deadline}
      <br>
      ${task.urgency === 'high' ? '🔴' : task.urgency === 'medium' ? '🟡' : '🟢'} ${task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)}
    </div>
  `;

  card.addEventListener('click', () => openTaskModal(task));
  return card;
}

// ============== DRAG AND DROP ==============
function setupDragAndDrop() {
  const columns = document.querySelectorAll('.column-content');
  
  columns.forEach(column => {
    new Sortable(column, {
      group: 'tasks',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      onEnd: async (evt) => {
        const taskId = parseInt(evt.item.dataset.taskId);
        const newStatus = evt.to.closest('.column').dataset.status;
        await updateTaskStatus(taskId, newStatus);
        await loadTasks();
      }
    });
  });
}

// ============== TASK MODAL ==============
function openNewTaskModal() {
  resetTaskForm();
  document.getElementById('modalTitle').textContent = 'Create New Task';
  document.getElementById('deleteTaskBtn').style.display = 'none';
  document.getElementById('taskModal').classList.add('active');
  currentTask = null;
}

async function openTaskModal(task) {
  currentTask = task;
  
  document.getElementById('modalTitle').textContent = 'Edit Task';
  document.getElementById('deleteTaskBtn').style.display = 'inline-block';
  
  document.getElementById('taskName').value = task.name;
  document.getElementById('taskDescription').value = task.description;
  document.getElementById('taskDeadline').value = task.deadline;
  document.getElementById('taskUrgency').value = task.urgency;
  document.getElementById('taskStatus').value = task.status;
  
  const creator = allUsers.find(u => u.id === task.createdBy);
  document.getElementById('taskCreatedBy').value = creator ? creator.name : 'Unknown';

  // Load tagged users
  document.getElementById('taggedUsers').innerHTML = '';
  task.taggedFor.forEach(userId => {
    const user = allUsers.find(u => u.id === userId);
    if (user) addTagToUI(user.name, userId);
  });

  // Load attachments
  loadAttachments(task);
  
  // Check if user can edit
  const canEdit = currentUser.role === 'manager' || 
                  task.createdBy === currentUser.id || 
                  task.assignedTo.includes(currentUser.id);
  
  document.querySelectorAll('.modal-input, .modal-textarea, .modal-select').forEach(el => {
    if (el.id !== 'taskCreatedBy') el.disabled = !canEdit;
  });

  document.getElementById('taskModal').classList.add('active');
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('active');
}

function resetTaskForm() {
  document.getElementById('taskName').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskDeadline').value = '';
  document.getElementById('taskUrgency').value = 'low';
  document.getElementById('taskStatus').value = 'todo';
  document.getElementById('taskCreatedBy').value = currentUser.name;
  document.getElementById('taggedUsers').innerHTML = '';
  document.getElementById('photoList').innerHTML = '';
  document.getElementById('docList').innerHTML = '';
  selectedFiles = { photos: [], docs: [] };
  
  // Enable all inputs
  document.querySelectorAll('.modal-input, .modal-textarea, .modal-select').forEach(el => {
    el.disabled = false;
  });
}

async function saveTask() {
  const name = document.getElementById('taskName').value;
  const description = document.getElementById('taskDescription').value;
  const deadline = document.getElementById('taskDeadline').value;
  const urgency = document.getElementById('taskUrgency').value;
  const status = document.getElementById('taskStatus').value;
  
  const taggedUsers = Array.from(document.querySelectorAll('.tag')).map(tag => 
    parseInt(tag.dataset.userId)
  );

  if (!name) {
    alert('Please enter task name');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('deadline', deadline);
  formData.append('urgency', urgency);
  formData.append('status', status);
  formData.append('taggedFor', JSON.stringify(taggedUsers));
  formData.append('userId', currentUser.id);
  formData.append('assignedTo', JSON.stringify([currentUser.id])); // Can be modified later

  // Add files
  selectedFiles.photos.forEach(file => formData.append('photos', file));
  selectedFiles.docs.forEach(file => formData.append('docs', file));

  try {
    const url = currentTask 
      ? `${API_URL}/tasks/${currentTask.id}`
      : `${API_URL}/tasks`;
    
    const method = currentTask ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      body: formData
    });

    if (response.ok) {
      await loadTasks();
      closeTaskModal();
      alert(currentTask ? 'Task updated!' : 'Task created!');
    }
  } catch (error) {
    console.error('Error saving task:', error);
    alert('Error saving task');
  }
}

async function deleteTask() {
  if (!currentTask || !confirm('Delete this task?')) return;

  try {
    const response = await fetch(`${API_URL}/tasks/${currentTask.id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await loadTasks();
      closeTaskModal();
      alert('Task deleted!');
    }
  } catch (error) {
    console.error('Error deleting task:', error);
  }
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    await fetch(`${API_URL}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (error) {
    console.error('Error updating task status:', error);
  }
}

// ============== FILE UPLOAD ==============
function handlePhotoUpload(e) {
  const files = e.target.files;
  Array.from(files).forEach(file => {
    selectedFiles.photos.push(file);
    addPhotoToUI(file);
  });
}

function handleDocUpload(e) {
  const files = e.target.files;
  Array.from(files).forEach(file => {
    selectedFiles.docs.push(file);
    addDocToUI(file);
  });
}

function addPhotoToUI(file) {
  const photoList = document.getElementById('photoList');
  const item = document.createElement('div');
  item.className = 'uploaded-item';
  item.innerHTML = `
    <span>📷 ${file.name}</span>
    <button type="button" class="remove-btn">×</button>
  `;
  
  item.querySelector('.remove-btn').addEventListener('click', () => {
    selectedFiles.photos = selectedFiles.photos.filter(f => f !== file);
    item.remove();
  });
  
  photoList.appendChild(item);
}

function addDocToUI(file) {
  const docList = document.getElementById('docList');
  const item = document.createElement('div');
  item.className = 'uploaded-item';
  item.innerHTML = `
    <span>📄 ${file.name}</span>
    <button type="button" class="remove-btn">×</button>
  `;
  
  item.querySelector('.remove-btn').addEventListener('click', () => {
    selectedFiles.docs = selectedFiles.docs.filter(f => f !== file);
    item.remove();
  });
  
  docList.appendChild(item);
}

function loadAttachments(task) {
  document.getElementById('photoList').innerHTML = '';
  document.getElementById('docList').innerHTML = '';
  
  if (task.attachments) {
    task.attachments.forEach(att => {
      const item = document.createElement('div');
      item.className = 'uploaded-item';
      item.innerHTML = `
        <a href="${att.path}" target="_blank" style="color: var(--primary-color); text-decoration: none;">
          ${att.type === 'photos' ? '📷' : '📄'} ${att.originalName}
        </a>
      `;
      
      const list = att.type === 'photos' ? 
        document.getElementById('photoList') : 
        document.getElementById('docList');
      list.appendChild(item);
    });
  }
}

// ============== TAGS ==============
function addTag(userName) {
  const user = allUsers.find(u => u.name === userName);
  if (user && !document.querySelector(`[data-user-id="${user.id}"]`)) {
    addTagToUI(userName, user.id);
  }
}

function addTagToUI(userName, userId) {
  const container = document.getElementById('taggedUsers');
  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.dataset.userId = userId;
  tag.innerHTML = `
    ${userName}
    <button type="button" class="tag-remove">×</button>
  `;
  
  tag.querySelector('.tag-remove').addEventListener('click', () => {
    tag.remove();
  });
  
  container.appendChild(tag);
}

// ============== USER MANAGEMENT ==============
function openUserModal() {
  document.getElementById('newUserName').value = '';
  document.getElementById('newUsername').value = '';
  document.getElementById('newUserRole').value = 'employee';
  document.getElementById('tempPasswordDisplay').style.display = 'none';
  document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('active');
}

async function createUser() {
  const name = document.getElementById('newUserName').value;
  const username = document.getElementById('newUsername').value;
  const role = document.getElementById('newUserRole').value;

  if (!name || !username) {
    alert('Please fill all fields');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, role })
    });

    const data = await response.json();
    
    if (data.success) {
      document.getElementById('tempPassword').value = data.tempPassword;
      document.getElementById('tempPasswordDisplay').style.display = 'block';
      alert(`Employee created! Temporary password: ${data.tempPassword}`);
      
      await loadUsers();
      setTimeout(closeUserModal, 2000);
    }
  } catch (error) {
    console.error('Error creating user:', error);
    alert('Error creating user');
  }
}
