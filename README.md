# TeamTasks - Team Task Management Application

A complete task management system where managers assign tasks and employees track their work.

## Features ✨

✅ **User Authentication** - Login with username and password  
✅ **Manager Dashboard** - See all team tasks and employees  
✅ **Employee Portal** - View assigned tasks and tagged tasks  
✅ **Kanban Board** - Drag & drop tasks between statuses  
✅ **Task Details** - Full popup with description, deadline, urgency  
✅ **Tag for Help** - Tag multiple people for assistance  
✅ **File Uploads** - Attach photos and documents to tasks  
✅ **Task Statuses** - To Do, In Progress, Done, Need Help, Hold, Future  
✅ **User Management** - Managers can create new employee accounts  

## Quick Start

### 1. Install Dependencies
```bash
cd /home/claude/teamtasks
npm install
```

### 2. Start the Server
```bash
node server.js
```
Server runs on `http://localhost:5000`

### 3. Open in Browser
```
http://localhost:5000
```

### 4. Demo Login
**Manager Account:**
- Username: `manager`
- Password: `password123`

**Employee Accounts:**
- Username: `john`, `sarah`, or `alex`
- Password: `password123`

## Project Structure

```
teamtasks/
├── server.js              # Express backend (authentication, tasks, users)
├── public/
│   ├── index.html        # Main HTML page
│   ├── style.css         # Styling
│   ├── app.js            # Frontend logic (React-style, vanilla JS)
├── uploads/              # File storage (auto-created)
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/login` - Login user

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task (with file uploads)
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/status` - Change task status
- `DELETE /api/tasks/:id` - Delete task

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user (manager only)

## How It Works

### For Managers:
1. Login as manager
2. See all tasks from all team members
3. Create new tasks (click "+ New Task")
4. Assign tasks to employees
5. Tag people for help
6. Add photos/documents
7. Move tasks between columns by dragging

### For Employees:
1. Login with your credentials
2. See only your assigned and tagged tasks
3. Click tasks to view details
4. Update task status by dragging
5. Can view but not edit others' tasks

## Technologies Used

- **Frontend:** HTML, CSS, JavaScript (Vanilla)
- **Backend:** Node.js, Express.js
- **File Storage:** Local filesystem
- **Drag & Drop:** Sortable.js library
- **Database:** In-memory (can be replaced with MongoDB/PostgreSQL)

## Customization

### Change Demo Users
Edit `server.js` lines 26-31:
```javascript
let users = [
  { id: 1, username: 'manager', password: 'password123', role: 'manager', name: 'Manager Admin' },
  // Add more users here
];
```

### Change Colors/Styling
Edit `public/style.css` `:root` variables:
```css
:root {
  --primary-color: #3b82f6;
  --urgency-high: #e2534a;
  --urgency-medium: #ba7517;
  --urgency-low: #639922;
}
```

### Change Port
Edit `server.js` line 5:
```javascript
const PORT = 5000; // Change this
```

## Future Enhancements

- [ ] Connect to MongoDB/PostgreSQL
- [ ] Real-time notifications
- [ ] Email notifications
- [ ] Task comments & collaboration
- [ ] User profiles
- [ ] Task filters & search
- [ ] Calendar view
- [ ] Mobile app
- [ ] Dark mode
- [ ] User roles customization

## Troubleshooting

**Port already in use:**
```bash
lsof -i :5000  # Find process using port 5000
kill -9 <PID>  # Kill the process
```

**Files not uploading:**
- Make sure `uploads/` folder exists
- Check file permissions

**Can't login:**
- Use demo credentials: manager/password123
- Check server is running on port 5000

## Support

For issues or questions, check:
1. Browser console (F12) for JavaScript errors
2. Server logs in terminal
3. Check network tab for API calls

---

**Built with ❤️ for your team**
