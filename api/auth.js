// Serverless API for authentication
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const users = [
    { id: 1, username: 'manager', password: 'password123', role: 'manager', name: 'Manager Admin' },
    { id: 2, username: 'john', password: 'password123', role: 'employee', name: 'John' },
    { id: 3, username: 'sarah', password: 'password123', role: 'employee', name: 'Sarah' },
    { id: 4, username: 'alex', password: 'password123', role: 'employee', name: 'Alex' }
  ];

  if (req.method === 'POST') {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name
        }
      });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
