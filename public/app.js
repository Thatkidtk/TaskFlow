class TaskFlow {
    constructor() {
        this.token = localStorage.getItem('token');
        this.currentUser = null;
        this.currentGroup = null;
        this.groups = [];
        this.members = [];
        this.tasks = {};
        
        this.init();
    }

    init() {
        this.bindEvents();
        
        if (this.token) {
            this.showMainSection();
            this.loadGroups();
        } else {
            this.showAuthSection();
        }
    }

    bindEvents() {
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleAuthForms(false);
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleAuthForms(true);
        });

        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('register-btn').addEventListener('click', () => this.register());
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        document.getElementById('add-group-btn').addEventListener('click', () => this.showAddGroupModal());
        document.getElementById('create-first-group').addEventListener('click', () => this.showAddGroupModal());
        document.getElementById('delete-group-btn').addEventListener('click', () => this.deleteCurrentGroup());
        document.getElementById('add-member-btn').addEventListener('click', () => this.showAddMemberModal());

        document.querySelector('.modal-close').addEventListener('click', () => this.hideModal());
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') this.hideModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                if (activeElement.id === 'login-email' || activeElement.id === 'login-password') {
                    this.login();
                } else if (activeElement.id === 'register-email' || activeElement.id === 'register-password') {
                    this.register();
                }
            }
        });
    }

    toggleAuthForms(showLogin) {
        document.getElementById('login-form').classList.toggle('hidden', !showLogin);
        document.getElementById('register-form').classList.toggle('hidden', showLogin);
    }

    showAuthSection() {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('main-section').classList.add('hidden');
    }

    showMainSection() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
    }

    async login() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('token', this.token);
                this.showMainSection();
                this.loadGroups();
                this.showNotification('Login successful!', 'success');
            } else {
                this.showNotification(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async register() {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        if (!email || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('token', this.token);
                this.showMainSection();
                this.loadGroups();
                this.showNotification('Registration successful!', 'success');
            } else {
                this.showNotification(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    logout() {
        this.token = null;
        this.currentUser = null;
        this.currentGroup = null;
        this.groups = [];
        this.members = [];
        this.tasks = {};
        localStorage.removeItem('token');
        this.showAuthSection();
        this.clearForms();
        this.showNotification('Logged out successfully', 'success');
    }

    clearForms() {
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
    }

    async loadGroups() {
        try {
            const response = await fetch('/api/groups', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.groups = await response.json();
                this.renderGroups();
                
                if (this.groups.length === 0) {
                    this.showWelcomeScreen();
                }
            } else if (response.status === 401) {
                this.logout();
            }
        } catch (error) {
            this.showNotification('Failed to load groups', 'error');
        }
    }

    renderGroups() {
        const groupsList = document.getElementById('groups-list');
        groupsList.innerHTML = '';

        this.groups.forEach(group => {
            const groupItem = document.createElement('div');
            groupItem.className = 'group-item';
            groupItem.innerHTML = `
                <h4>${group.name}</h4>
                <p>${group.description || 'No description'}</p>
            `;
            
            groupItem.addEventListener('click', () => this.selectGroup(group));
            groupsList.appendChild(groupItem);
        });
    }

    async selectGroup(group) {
        this.currentGroup = group;
        document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
        event.currentTarget.classList.add('active');
        
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('group-view').classList.remove('hidden');
        document.getElementById('current-group-name').textContent = group.name;

        await this.loadMembers();
    }

    async loadMembers() {
        if (!this.currentGroup) return;

        try {
            const response = await fetch(`/api/groups/${this.currentGroup.id}/members`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.members = await response.json();
                await this.loadAllTasks();
                this.renderMembers();
            }
        } catch (error) {
            this.showNotification('Failed to load members', 'error');
        }
    }

    async loadAllTasks() {
        this.tasks = {};
        
        for (const member of this.members) {
            try {
                const response = await fetch(`/api/members/${member.id}/tasks`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                if (response.ok) {
                    this.tasks[member.id] = await response.json();
                }
            } catch (error) {
                console.error(`Failed to load tasks for member ${member.id}`);
            }
        }
    }

    renderMembers() {
        const membersList = document.getElementById('members-list');
        membersList.innerHTML = '';

        this.members.forEach(member => {
            const memberTasks = this.tasks[member.id] || [];
            const completedTasks = memberTasks.filter(task => task.completed).length;
            const totalTasks = memberTasks.length;

            const memberCard = document.createElement('div');
            memberCard.className = 'member-card';
            memberCard.innerHTML = `
                <div class="member-header">
                    <h4>${member.name}</h4>
                    <div class="member-actions">
                        <button class="btn btn-small" onclick="taskFlow.showAddTaskModal(${member.id})">+ Task</button>
                        <button class="btn btn-small btn-danger" onclick="taskFlow.deleteMember(${member.id})">Delete</button>
                    </div>
                </div>
                <div class="task-summary">
                    <span>${completedTasks}/${totalTasks} tasks completed</span>
                </div>
                <div class="task-list">
                    ${memberTasks.map(task => this.renderTask(task)).join('')}
                </div>
            `;

            membersList.appendChild(memberCard);
        });
    }

    renderTask(task) {
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;
        
        return `
            <div class="task-item">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                       onchange="taskFlow.toggleTask(${task.id}, this.checked)">
                <div class="task-content">
                    <div class="task-title ${task.completed ? 'completed' : ''}">${task.title}</div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                </div>
                ${task.due_date ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${new Date(task.due_date).toLocaleDateString()}</span>` : ''}
                <div class="task-actions">
                    <button class="btn btn-small" onclick="taskFlow.editTask(${task.id})">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="taskFlow.deleteTask(${task.id})">Delete</button>
                </div>
            </div>
        `;
    }

    showWelcomeScreen() {
        document.getElementById('welcome-screen').classList.remove('hidden');
        document.getElementById('group-view').classList.add('hidden');
    }

    showAddGroupModal() {
        document.getElementById('modal-body').innerHTML = `
            <h3>Create New Group</h3>
            <input type="text" id="group-name" placeholder="Group Name" required>
            <textarea id="group-description" placeholder="Description (optional)" rows="3"></textarea>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="taskFlow.hideModal()">Cancel</button>
                <button class="btn btn-primary" onclick="taskFlow.createGroup()">Create Group</button>
            </div>
        `;
        document.getElementById('modal').classList.remove('hidden');
        document.getElementById('group-name').focus();
    }

    async createGroup() {
        const name = document.getElementById('group-name').value.trim();
        const description = document.getElementById('group-description').value.trim();

        if (!name) {
            this.showNotification('Group name is required', 'error');
            return;
        }

        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ name, description })
            });

            if (response.ok) {
                const newGroup = await response.json();
                this.groups.push(newGroup);
                this.renderGroups();
                this.hideModal();
                this.showNotification('Group created successfully!', 'success');
            } else {
                this.showNotification('Failed to create group', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async deleteCurrentGroup() {
        if (!this.currentGroup) return;

        if (!confirm(`Are you sure you want to delete the group "${this.currentGroup.name}"? This will also delete all members and their tasks.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/groups/${this.currentGroup.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.groups = this.groups.filter(g => g.id !== this.currentGroup.id);
                this.currentGroup = null;
                this.members = [];
                this.tasks = {};
                this.renderGroups();
                this.showWelcomeScreen();
                this.showNotification('Group deleted successfully', 'success');
            } else {
                this.showNotification('Failed to delete group', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    showAddMemberModal() {
        if (!this.currentGroup) return;

        document.getElementById('modal-body').innerHTML = `
            <h3>Add New Member</h3>
            <input type="text" id="member-name" placeholder="Member Name" required>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="taskFlow.hideModal()">Cancel</button>
                <button class="btn btn-primary" onclick="taskFlow.createMember()">Add Member</button>
            </div>
        `;
        document.getElementById('modal').classList.remove('hidden');
        document.getElementById('member-name').focus();
    }

    async createMember() {
        const name = document.getElementById('member-name').value.trim();

        if (!name) {
            this.showNotification('Member name is required', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/groups/${this.currentGroup.id}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ name })
            });

            if (response.ok) {
                const newMember = await response.json();
                this.members.push(newMember);
                this.tasks[newMember.id] = [];
                this.renderMembers();
                this.hideModal();
                this.showNotification('Member added successfully!', 'success');
            } else {
                this.showNotification('Failed to add member', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async deleteMember(memberId) {
        const member = this.members.find(m => m.id === memberId);
        if (!member) return;

        if (!confirm(`Are you sure you want to delete "${member.name}" and all their tasks?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/members/${memberId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.members = this.members.filter(m => m.id !== memberId);
                delete this.tasks[memberId];
                this.renderMembers();
                this.showNotification('Member deleted successfully', 'success');
            } else {
                this.showNotification('Failed to delete member', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    showAddTaskModal(memberId) {
        const member = this.members.find(m => m.id === memberId);
        if (!member) return;

        document.getElementById('modal-body').innerHTML = `
            <h3>Add Task for ${member.name}</h3>
            <input type="text" id="task-title" placeholder="Task Title" required>
            <textarea id="task-description" placeholder="Description (optional)" rows="3"></textarea>
            <input type="date" id="task-due-date" placeholder="Due Date (optional)">
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="taskFlow.hideModal()">Cancel</button>
                <button class="btn btn-primary" onclick="taskFlow.createTask(${memberId})">Add Task</button>
            </div>
        `;
        document.getElementById('modal').classList.remove('hidden');
        document.getElementById('task-title').focus();
    }

    async createTask(memberId) {
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const due_date = document.getElementById('task-due-date').value;

        if (!title) {
            this.showNotification('Task title is required', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/members/${memberId}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ title, description, due_date: due_date || null })
            });

            if (response.ok) {
                const newTask = await response.json();
                if (!this.tasks[memberId]) this.tasks[memberId] = [];
                this.tasks[memberId].push(newTask);
                this.renderMembers();
                this.hideModal();
                this.showNotification('Task added successfully!', 'success');
            } else {
                this.showNotification('Failed to add task', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async toggleTask(taskId, completed) {
        let task = null;
        let memberId = null;

        for (const [mId, tasks] of Object.entries(this.tasks)) {
            task = tasks.find(t => t.id === taskId);
            if (task) {
                memberId = mId;
                break;
            }
        }

        if (!task) return;

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    ...task,
                    completed
                })
            });

            if (response.ok) {
                task.completed = completed;
                this.renderMembers();
            } else {
                this.showNotification('Failed to update task', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    editTask(taskId) {
        let task = null;
        let memberId = null;

        for (const [mId, tasks] of Object.entries(this.tasks)) {
            task = tasks.find(t => t.id === taskId);
            if (task) {
                memberId = mId;
                break;
            }
        }

        if (!task) return;

        const member = this.members.find(m => m.id == memberId);
        const dueDateValue = task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '';

        document.getElementById('modal-body').innerHTML = `
            <h3>Edit Task for ${member ? member.name : 'Unknown'}</h3>
            <input type="text" id="task-title" placeholder="Task Title" value="${task.title}" required>
            <textarea id="task-description" placeholder="Description (optional)" rows="3">${task.description || ''}</textarea>
            <input type="date" id="task-due-date" value="${dueDateValue}">
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="taskFlow.hideModal()">Cancel</button>
                <button class="btn btn-primary" onclick="taskFlow.updateTask(${taskId})">Update Task</button>
            </div>
        `;
        document.getElementById('modal').classList.remove('hidden');
        document.getElementById('task-title').focus();
    }

    async updateTask(taskId) {
        let task = null;

        for (const tasks of Object.values(this.tasks)) {
            task = tasks.find(t => t.id === taskId);
            if (task) break;
        }

        if (!task) return;

        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const due_date = document.getElementById('task-due-date').value;

        if (!title) {
            this.showNotification('Task title is required', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    completed: task.completed,
                    due_date: due_date || null
                })
            });

            if (response.ok) {
                task.title = title;
                task.description = description;
                task.due_date = due_date || null;
                this.renderMembers();
                this.hideModal();
                this.showNotification('Task updated successfully!', 'success');
            } else {
                this.showNotification('Failed to update task', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async deleteTask(taskId) {
        let task = null;
        let memberId = null;

        for (const [mId, tasks] of Object.entries(this.tasks)) {
            const index = tasks.findIndex(t => t.id === taskId);
            if (index !== -1) {
                task = tasks[index];
                memberId = mId;
                break;
            }
        }

        if (!task) return;

        if (!confirm(`Are you sure you want to delete the task "${task.title}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.tasks[memberId] = this.tasks[memberId].filter(t => t.id !== taskId);
                this.renderMembers();
                this.showNotification('Task deleted successfully', 'success');
            } else {
                this.showNotification('Failed to delete task', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    hideModal() {
        document.getElementById('modal').classList.add('hidden');
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.remove('hidden');

        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }
}

const taskFlow = new TaskFlow();