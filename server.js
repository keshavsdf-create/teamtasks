const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ============== IN-MEMORY DATABASE ==============
let users = [
  { id: 1, username: 'manager', password: 'password123', role: 'manager', name: 'Manager Admin' },
  { id: 2, username: 'john', password: 'password123', role: 'employee', name: 'John' },
  { id: 3, username: 'sarah', password: 'password123', role: 'employee', name: 'Sarah' },
  { id: 4, username: 'alex', password: 'password123', role: 'employee', name: 'Alex' }
];

let tasks = [
  {
    id: 1,
    name: 'Design Dashboard',
    description: 'Create UI mockups for dashboard',
    assignedTo: [2],
    taggedFor: [3],
    deadline: '2026-08-28',
    urgency: 'high',
    status: 'in-progress',
    createdBy: 1,
    attachments: [],
    createdAt: new Date()
  },
  {
    id: 2,
    name: 'Setup Database',
    description: 'Configure MongoDB',
    assignedTo: [4],
    taggedFor: [],
    deadline: '2026-08-25',
    urgency: 'high',
    status: 'todo',
    createdBy: 1,
    attachments: [],
    createdAt: new Date()
  }
];

// ============== ROUTES ==============

// LOGIN
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// GET ALL USERS
app.get('/api/users', (req, res) => {
  res.json(users.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role })));
});

// CREATE NEW USER (Manager only)
app.post('/api/users', (req, res) => {
  const { name, username, role } = req.body;
  const tempPassword = Math.random().toString(36).substring(2, 10);
  
  const newUser = {
    id: Math.max(...users.map(u => u.id), 0) + 1,
    username,
    password: tempPassword,
    role,
    name
  };
  
  users.push(newUser);
  res.json({ success: true, user: newUser, tempPassword });
});

// GET ALL TASKS
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

// GET SINGLE TASK
app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  res.json(task);
});

// CREATE TASK
app.post('/api/tasks', upload.any(), (req, res) => {
  const { name, description, assignedTo, taggedFor, deadline, urgency, status, userId } = req.body;
  
  const attachments = req.files ? req.files.map(f => ({
    filename: f.filename,
    path: `/uploads/${f.filename}`,
    originalName: f.originalname,
    type: f.fieldname
  })) : [];
  
  const newTask = {
    id: Math.max(...tasks.map(t => t.id), 0) + 1,
    name,
    description,
    assignedTo: assignedTo ? JSON.parse(assignedTo) : [],
    taggedFor: taggedFor ? JSON.parse(taggedFor) : [],
    deadline,
    urgency,
    status: status || 'todo',
    createdBy: parseInt(userId),
    attachments,
    createdAt: new Date()
  };
  
  tasks.push(newTask);
  res.json({ success: true, task: newTask });
});

// UPDATE TASK
app.put('/api/tasks/:id', upload.any(), (req, res) => {
  const taskIndex = tasks.findIndex(t => t.id === parseInt(req.params.id));
  
  if (taskIndex === -1) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  const { name, description, assignedTo, taggedFor, deadline, urgency, status } = req.body;
  const existingAttachments = tasks[taskIndex].attachments || [];
  
  const newAttachments = req.files ? req.files.map(f => ({
    filename: f.filename,
    path: `/uploads/${f.filename}`,
    originalName: f.originalname,
    type: f.fieldname
  })) : [];
  
  tasks[taskIndex] = {
    ...tasks[taskIndex],
    name: name || tasks[taskIndex].name,
    description: description || tasks[taskIndex].description,
    assignedTo: assignedTo ? JSON.parse(assignedTo) : tasks[taskIndex].assignedTo,
    taggedFor: taggedFor ? JSON.parse(taggedFor) : tasks[taskIndex].taggedFor,
    deadline: deadline || tasks[taskIndex].deadline,
    urgency: urgency || tasks[taskIndex].urgency,
    status: status || tasks[taskIndex].status,
    attachments: [...existingAttachments, ...newAttachments]
  };
  
  res.json({ success: true, task: tasks[taskIndex] });
});

// DELETE TASK
app.delete('/api/tasks/:id', (req, res) => {
  const taskIndex = tasks.findIndex(t => t.id === parseInt(req.params.id));
  
  if (taskIndex === -1) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  // Delete attachments
  const task = tasks[taskIndex];
  if (task.attachments) {
    task.attachments.forEach(att => {
      const filePath = path.join(__dirname, 'uploads', att.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }
  
  tasks.splice(taskIndex, 1);
  res.json({ success: true, message: 'Task deleted' });
});

// UPDATE TASK STATUS (Drag & Drop)
app.patch('/api/tasks/:id/status', (req, res) => {
  const { status } = req.body;
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  
  if (task) {
    task.status = status;
    res.json({ success: true, task });
  } else {
    res.status(404).json({ message: 'Task not found' });
  }
});

app.listen(PORT, () => {
  console.log(`TeamTasks server running on http://localhost:${PORT}`);
});
