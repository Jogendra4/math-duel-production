// index.js (Backend Server for Render)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // Import CORS middleware

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS for cross-domain communication
const io = new Server(server, {
  cors: {
    origin: "*", // Allow connections from any origin (your Vercel frontend)
    methods: ["GET", "POST"]
  }
});

// A simple route to check if the server is running
app.get('/', (req, res) => {
  res.send('Socket.IO Server is running.');
});

// --- Game State Management (In-Memory, which works perfectly on Render) ---
let lobbies = {}; 
const LOBBY_CAPACITY = 2;

function createLobbyId() { return Math.random().toString(36).substring(2, 8); }
function generateQuestions(count = 10) {
    const questions = [];
    const operations = ['+', '-', '×', '÷'];
    for (let i = 0; i < count; i++) {
        let a, b, answer;
        const op = operations[Math.floor(Math.random() * 4)];
        switch (op) {
            case '+': a = Math.floor(Math.random()*20)+1; b = Math.floor(Math.random()*20)+1; answer = a+b; questions.push({ text: `${a} + ${b} = ?`, answer }); break;
            case '-': a = Math.floor(Math.random()*30)+10; b = Math.floor(Math.random()*a)+1; answer = a-b; questions.push({ text: `${a} - ${b} = ?`, answer }); break;
            case '×': a = Math.floor(Math.random()*10)+2; b = Math.floor(Math.random()*10)+2; answer = a*b; questions.push({ text: `${a} × ${b} = ?`, answer }); break;
            case '÷': answer = Math.floor(Math.random()*10)+2; b = Math.floor(Math.random()*10)+2; a = b*answer; questions.push({ text: `${a} ÷ ${b} = ?`, answer }); break;
        }
    }
    return questions;
}

// --- Socket.IO Event Handling ---
io.on('connection', (socket) => {
    socket.on('findMatch', (username) => {
        socket.username = username;
        let joined = false;
        for (const lobbyId in lobbies) {
            const lobby = lobbies[lobbyId];
            if (lobby.players.length < LOBBY_CAPACITY && !lobby.inGame) {
                socket.join(lobbyId);
                lobby.players.push({ id: socket.id, username, score: 0 });
                socket.emit('joinedLobby', lobbyId, lobby.players);
                io.to(lobbyId).emit('playerUpdate', lobby.players);
                joined = true;
                if (lobby.players.length === LOBBY_CAPACITY) startGame(lobbyId);
                break;
            }
        }
        if (!joined) {
            const lobbyId = createLobbyId();
            socket.join(lobbyId);
            lobbies[lobbyId] = { id: lobbyId, players: [{ id: socket.id, username, score: 0 }], questions: generateQuestions(), inGame: false };
            socket.emit('joinedLobby', lobbyId, lobbies[lobbyId].players);
        }
    });
    
    socket.on('submitAnswer', ({ lobbyId, isCorrect }) => {
        const lobby = lobbies[lobbyId];
        if (!lobby) return;
        const player = lobby.players.find(p => p.id === socket.id);
        if (player && isCorrect) player.score += 10;
        io.to(lobbyId).emit('playerUpdate', lobby.players);
    });

    socket.on('quizFinished', (lobbyId) => {
        const lobby = lobbies[lobbyId];
        if (!lobby) return;
        const player = lobby.players.find(p => p.id === socket.id);
        if (player) player.finished = true;
        if (lobby.players.every(p => p.finished)) endGame(lobbyId);
    });

    socket.on('disconnect', () => {
        for (const lobbyId in lobbies) {
            const lobby = lobbies[lobbyId];
            const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                lobby.players.splice(playerIndex, 1);
                if (lobby.players.length === 0) { delete lobbies[lobbyId]; } 
                else {
                    io.to(lobbyId).emit('playerUpdate', lobby.players);
                    if (lobby.inGame && lobby.players.every(p => p.finished)) endGame(lobbyId);
                }
                break;
            }
        }
    });
});

function startGame(lobbyId) { /* ... same as before ... */ }
function endGame(lobbyId) { /* ... same as before ... */ }

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server is live on port ${PORT}`);
});
