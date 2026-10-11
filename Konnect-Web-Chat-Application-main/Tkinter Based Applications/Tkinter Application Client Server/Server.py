import socket
from threading import Thread
from tkinter import messagebox
from tkinter import *

BUFFER_SIZE = 4096
client_socket = None
s = None


def start_server_listener():
    SERVER_HOST = "0.0.0.0"
    SERVER_PORT = 33000
    global s, client_socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((SERVER_HOST, SERVER_PORT))
        s.listen(5)
        status_label.config(text="Status: Listening on port 33000...", fg="#38bdf8")
        msg_list.insert(END, "[SYSTEM] Server online. Waiting for client to connect...")
        
        client_socket, address = s.accept()
        status_label.config(text=f"Status: Connected to {address[0]}", fg="#10b981")
        msg_list.insert(END, f"[SYSTEM] Client connected from {address[0]}:{address[1]}")
        
        receive_thread = Thread(target=receive, daemon=True)
        receive_thread.start()
    except Exception as e:
        status_label.config(text="Status: Connection Error", fg="#f43f5e")
        msg_list.insert(END, f"[ERROR] {e}")


def connect():
    # Run listening in background thread so GUI never freezes
    Thread(target=start_server_listener, daemon=True).start()


def receive():
    while True:
        try:
            if not client_socket:
                break
            msg = client_socket.recv(1024).decode("utf8")
            if not msg:
                break
            msg_list.insert(END, "Client: " + msg)
            msg_list.see(END)
        except OSError:
            break


def send(event=None):
    display_mess = my_msg.get()
    if not display_mess:
        return
    if client_socket:
        try:
            mess = bytes(display_mess, "utf-8")
            client_socket.send(mess)
            msg_list.insert(END, "You: " + display_mess)
            msg_list.see(END)
            my_msg.set("")

            if display_mess == "{quit}":
                client_socket.close()
                root.quit()
        except Exception as e:
            msg_list.insert(END, f"[ERROR] Failed to send: {e}")
    else:
        msg_list.insert(END, "[NOTICE] No client connected yet. Click 'Listen / Connect' first.")


def on_closing(event=None):
    my_msg.set("{quit}")
    send()
    root.destroy()


# GUI Construction - Modern Dark Tech Theme
root = Tk()
root.title("Unstable Connection Desktop Server - Socket Relay")
root.geometry('480x520')
root.configure(bg="#0f172a")

# Top Header
header_frame = Frame(root, bg="#1e293b", pady=10, padx=15)
header_frame.pack(fill=X)

title_label = Label(header_frame, text="UNSTABLE CONNECTION SERVER", font=("Segoe UI", 12, "bold"), fg="#f8fafc", bg="#1e293b")
title_label.pack(anchor=W)

status_label = Label(header_frame, text="Status: Standby (Click Listen to start)", font=("Segoe UI", 9), fg="#94a3b8", bg="#1e293b")
status_label.pack(anchor=W)

# Message Log Frame
messages_frame = Frame(root, padx=15, pady=10, bg="#0f172a")
messages_frame.pack(fill=BOTH, expand=True)

scrollbar = Scrollbar(messages_frame)
msg_list = Listbox(messages_frame, height=15, bg="#1e293b", fg="#f8fafc", selectbackground="#38bdf8",
                   font=("Segoe UI", 10), relief=FLAT, bd=0, yscrollcommand=scrollbar.set,
                   highlightthickness=1, highlightbackground="#334155")

scrollbar.pack(side=RIGHT, fill=Y)
msg_list.pack(side=LEFT, fill=BOTH, expand=True)

# Input Box Frame
input_frame = Frame(root, padx=15, pady=8, bg="#0f172a")
input_frame.pack(fill=X)

my_msg = StringVar()
entry_field = Entry(input_frame, textvariable=my_msg, font=("Segoe UI", 10), bg="#1e293b", fg="#f8fafc",
                    insertbackground="#38bdf8", relief=FLAT, bd=6, highlightthickness=1, highlightbackground="#334155")
entry_field.bind("<Return>", send)
entry_field.pack(side=LEFT, fill=X, expand=True, padx=(0, 8))

send_button = Button(input_frame, text="Send", command=send, font=("Segoe UI", 9, "bold"),
                     bg="#38bdf8", fg="#0f172a", activebackground="#0284c7", activeforeground="#ffffff",
                     relief=FLAT, padx=15, pady=4, cursor="hand2")
send_button.pack(side=RIGHT)

# Bottom Actions Bar
actions_frame = Frame(root, padx=15, pady=10, bg="#0f172a")
actions_frame.pack(fill=X)

connect_btn = Button(actions_frame, text="▶ Start Listening", command=connect, font=("Segoe UI", 9, "bold"),
                     bg="#10b981", fg="#ffffff", activebackground="#059669", relief=FLAT, padx=12, pady=5, cursor="hand2")
connect_btn.pack(side=LEFT)

exit_btn = Button(actions_frame, text="Exit", command=on_closing, font=("Segoe UI", 9),
                  bg="#334155", fg="#f8fafc", activebackground="#475569", relief=FLAT, padx=12, pady=5, cursor="hand2")
exit_btn.pack(side=RIGHT)

root.protocol("WM_DELETE_WINDOW", on_closing)

if __name__ == "__main__":
    root.mainloop()