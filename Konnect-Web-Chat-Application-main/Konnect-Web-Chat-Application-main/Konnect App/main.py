from flask import session, request
from flask_socketio import SocketIO, join_room, leave_room
import time
import random
from datetime import datetime
from application import create_app
from application.database import DataBase
import config

# SETUP
app = create_app()
socketio = SocketIO(app, max_http_buffer_size=25 * 1024 * 1024)  # 25MB buffer for voice notes and photos

# ONLINE USERS TRACKER
online_users = {}  # {sid: username}


def generate_bot_reply(prompt):
    p = prompt.strip().lower()
    if not p or p == "help":
        return (
            "🤖 Hello! I'm Unstable Connection AI Assistant. Here is what I can do:\n"
            "• Ask network questions: 'what is a socket?', 'tcp vs udp', 'what is e2ee?'\n"
            "• Math calculations: 'calc 45 * 12'\n"
            "• Current time/date: 'time' or 'date'\n"
            "• Tech humor: 'joke'\n"
            "• Project info: 'about unstable connection'"
        )
    elif "joke" in p:
        jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
            "There are 10 types of people in the world: those who understand binary, and those who don't. 💻",
            "A TCP packet walks into a bar: 'I’d like a beer.' Bartender: 'You’d like a beer?' Packet: 'Yes, a beer.' 🍻",
            "Why was the JavaScript developer sad? Because they didn't Node how to Express themselves! 😄",
            "Why is my Wi-Fi called 'Unstable Connection'? Because commitment issues run deep! 📶"
        ]
        return random.choice(jokes)
    elif "socket" in p:
        return "🔌 Sockets are endpoints of a two-way communication link between programs across a network. Unstable Connection uses WebSockets (Socket.IO) over TCP for persistent, low-latency streaming!"
    elif "tcp" in p and "udp" in p:
        return "📡 TCP (Transmission Control Protocol) guarantees reliable, ordered packet delivery with handshake acknowledgments. UDP is connectionless and faster, but does not guarantee delivery."
    elif "e2ee" in p or "encryption" in p:
        return "🔒 End-to-End Encryption (E2EE) ensures that only the communicating users can read the messages. In Unstable Connection, ciphered messages are stored in ciphertext on the database so intermediate nodes cannot inspect plaintext."
    elif "tcp" in p:
        return "📶 TCP provides reliable, ordered, and error-checked byte stream delivery between applications over an IP network."
    elif "time" in p or "date" in p:
        return f"⏰ Current Server Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    elif "about" in p or "unstable" in p:
        return "🚀 Unstable Connection is a real-time socket-programming group chat application featuring multi-room channels, E2EE simulation, voice notes, photo sharing, and WhatsApp/Telegram aesthetics!"
    elif p.startswith("calc ") or p.startswith("calculate "):
        expr = p.replace("calc ", "").replace("calculate ", "")
        try:
            allowed = set("0123456789+-*/(). %")
            if all(c in allowed for c in expr):
                return f"🧮 Result: {eval(expr)}"
            else:
                return "⚠️ Invalid characters in calculation expression."
        except Exception as e:
            return f"⚠️ Calculation error: {e}"
    else:
        return f"🤖 Processed query: '{prompt}'. Ask about Computer Networks, TCP, Sockets, E2EE, or type '/ai help'!"


# COMMUNICATION FUNCTIONS

@socketio.on('join')
def handle_join(data):
    room = data.get('room', 'general')
    name = data.get('name')
    join_room(room)
    if name:
        online_users[request.sid] = name
        unique_users = list(set(online_users.values()))
        socketio.emit('online_users_update', {
            'count': len(unique_users),
            'users': unique_users
        }, to=room)


@socketio.on('leave')
def handle_leave(data):
    room = data.get('room', 'general')
    leave_room(room)


@socketio.on('user_join')
def handle_user_join(data):
    name = data.get('name')
    room = data.get('room', 'general')
    join_room(room)
    if name:
        online_users[request.sid] = name
        unique_users = list(set(online_users.values()))
        socketio.emit('online_users_update', {
            'count': len(unique_users),
            'users': unique_users
        })


@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in online_users:
        del online_users[request.sid]
        unique_users = list(set(online_users.values()))
        socketio.emit('online_users_update', {
            'count': len(unique_users),
            'users': unique_users
        })


@socketio.on('typing')
def handle_typing(data):
    room = data.get('room', 'general')
    socketio.emit('user typing', data, to=room, include_self=False)


@socketio.on('stop_typing')
def handle_stop_typing(data):
    room = data.get('room', 'general')
    socketio.emit('user stop typing', data, to=room, include_self=False)


@socketio.on('event')
def handle_my_custom_event(json, methods=['GET', 'POST']):
    """
    handles saving messages once received from web server
    and sending message to other clients
    """
    data = dict(json)
    room = data.get('room', 'general')

    if "name" in data:
        db = DataBase()
        saved_text = data.get("message", "")
        if "audio" in data:
            saved_text = "[Voice Note 🎤]"
        elif "image" in data:
            saved_text = "[Photo Attachment 📷]"
        db.save_message(data["name"], saved_text)

    # Broadcast message to clients in the room (or globally)
    socketio.emit('message response', json, to=room)

    # Check for AI Bot command (/ai <query> or @bot <query>)
    msg_content = data.get("message", "")
    if "name" in data and (msg_content.startswith("/ai ") or msg_content.startswith("@bot ")):
        prompt = msg_content.replace("/ai ", "").replace("@bot ", "").strip()
        bot_reply = generate_bot_reply(prompt)
        time.sleep(0.3)  # Natural reply delay
        bot_data = {
            'name': '🤖 Unstable Connection AI Bot',
            'message': bot_reply,
            'is_bot': True,
            'room': room,
            'time': datetime.now().strftime("%H:%M")
        }
        db = DataBase()
        db.save_message(bot_data['name'], bot_data['message'])
        socketio.emit('message response', bot_data, to=room)


# MAINLINE
if __name__ == "__main__":  # start the web server 
    socketio.run(app, debug=True, host=str(config.Config.SERVER), allow_unsafe_werkzeug=True)