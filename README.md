# TaskFlow - Multi-Group Task Management

A minimalistic, dark-themed task management application that allows you to organize tasks for multiple groups, teams, or family members.

## Features

- **User Authentication**: Secure account-based system
- **Multiple Groups**: Create and manage different groups (teams, families, projects)
- **Member Management**: Add team members or family members to each group
- **Task Lists**: Individual to-do lists and reminders for each member
- **Dark Theme**: Clean, minimalistic dark interface
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

## Usage

### 1. Authentication
- **Register**: Create a new account with email and password
- **Login**: Access your existing account

### 2. Group Management
- **Create Groups**: Add groups for different teams or purposes
- **Delete Groups**: Remove groups and all associated data
- **Switch Groups**: Click on group names in the sidebar to switch between them

### 3. Member Management
- **Add Members**: Add team members or family members to each group
- **Delete Members**: Remove members and all their tasks

### 4. Task Management
- **Add Tasks**: Create tasks for any member with optional descriptions and due dates
- **Edit Tasks**: Modify task details, descriptions, and due dates
- **Complete Tasks**: Check off completed tasks
- **Delete Tasks**: Remove tasks that are no longer needed

## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - Login user

### Groups
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create new group
- `DELETE /api/groups/:id` - Delete group

### Members
- `GET /api/groups/:groupId/members` - Get group members
- `POST /api/groups/:groupId/members` - Add member to group
- `DELETE /api/members/:id` - Delete member

### Tasks
- `GET /api/members/:memberId/tasks` - Get member's tasks
- `POST /api/members/:memberId/tasks` - Create task for member
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Database Schema

The application uses SQLite with the following tables:

- **users**: User accounts and authentication
- **groups**: Group information and ownership
- **members**: Group members
- **tasks**: Individual tasks with completion status and due dates

## Security

- Passwords are hashed using bcrypt
- JWT tokens for secure API access
- Authorization checks for all protected endpoints

## Deployment

For production deployment:

1. Set environment variables:
   ```bash
   export JWT_SECRET="your-secure-secret-key"
   export PORT=3000
   ```

2. The application uses SQLite, so no additional database setup is required

3. Serve static files and run the Node.js server

## File Structure

```
taskflow/
├── server.js          # Express server and API routes
├── package.json       # Project dependencies and scripts
├── taskflow.db        # SQLite database (created automatically)
├── public/
│   ├── index.html     # Main HTML structure
│   ├── styles.css     # Dark theme styling
│   └── app.js         # Frontend JavaScript functionality
└── README.md          # This file
```

## Browser Support

The application works on modern browsers that support:
- ES6+ JavaScript features
- CSS Grid and Flexbox
- Fetch API
- Local Storage

## License

MIT License