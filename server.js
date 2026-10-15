const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const users = {};

function emitUserList() {
    const list = Object.entries(users).map(([socketId, u]) => ({
        socketId,
        username: u.username,
        color: u.color
    }));
    io.emit('user list', list);
}

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    socket.on('add user', (data) => {
        users[socket.id] = { 
            username: data.username, 
            color: data.color || '#000000' 
        };

        const existingUsers = Object.values(users)
            .filter(u => u.username !== data.username)
            .map(u => u.username);

        if (existingUsers.length === 0) {
            socket.emit('welcome', 'Добро пожаловать. Вы первый в чате.');
        } else {
            socket.emit('welcome', `Добро пожаловать. В чате уже присутствуют: ${existingUsers.join(', ')}.`);
        }

        socket.broadcast.emit('user joined', data.username);

        emitUserList();
    });

    socket.on('chat message', (msg) => {
        const user = users[socket.id];
        if (user) {
            io.emit('chat message', {
                username: user.username,
                color: user.color,
                text: msg
            });
        }
    });

    socket.on('private message', ({ toSocketId, text }) => {
        const sender = users[socket.id];
        const recipient = users[toSocketId];

        if (sender && recipient) {
            const messageData = {
                username: sender.username,
                color: sender.color,
                text: text,
                isPrivate: true
            };

            io.to(toSocketId).emit('private message', messageData);
            
            socket.emit('private message', { ...messageData, username: `Вы -> ${recipient.username}` });
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            delete users[socket.id];

            io.emit('user left', user.username);

            emitUserList();
        }
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});