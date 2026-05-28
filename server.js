// server.js - Run using Node.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

let rooms = {}; // Stores game state for different match lobbies

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle joining a specific multiplayer lobby
    socket.on('joinRoom', ({ roomId, skinColor }) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { players: {}, zombies: [], round: 1 };
        }
        
        // Register new player in the room state
        rooms[roomId].players[socket.id] = {
            x: 150, y: 150,
            angle: 0,
            hp: 100, maxHp: 100,
            points: 500,
            skinColor: skinColor || '#2980b9',
            currentWeapon: "M1911 Colt"
        };

        // Notify everyone in the lobby
        io.to(roomId).emit('roomStateUpdate', rooms[roomId]);
    });

    // Sync individual player input and movement
    socket.on('playerInput', ({ roomId, x, y, angle, hp }) => {
        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
            rooms[roomId].players[socket.id].x = x;
            rooms[roomId].players[socket.id].y = y;
            rooms[roomId].players[socket.id].angle = angle;
            rooms[roomId].players[socket.id].hp = hp;
            
            // Broadcast updated positions to other clients rapidly
            socket.to(roomId).emit('playerMoved', { id: socket.id, x, y, angle, hp });
        }
    });

    // Broadcast combat actions (shooting, slashes) to teammates
    socket.on('playerFire', ({ roomId, targetX, targetY, weaponType }) => {
        socket.to(roomId).emit('peerFireEffect', { id: socket.id, targetX, targetY, weaponType });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Clean up player references across rooms
        for (let roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                io.to(roomId).emit('playerLeft', socket.id);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Multiplayer server running on port ${PORT}`));
