import sqlite3
from sqlite3 import Error
from datetime import datetime
import os
from pathlib import Path

# Local SQLite File Setup
FILE = str(Path(__file__).resolve().parent.parent / "messages.db")
SQLITE_TABLE = "Messages"

# Supabase Client Setup
try:
    from supabase import create_client, Client
    import config
    SUPABASE_URL = getattr(config.Config, 'SUPABASE_URL', None) or os.getenv('SUPABASE_URL')
    SUPABASE_KEY = getattr(config.Config, 'SUPABASE_KEY', None) or os.getenv('SUPABASE_KEY')
    if SUPABASE_URL and SUPABASE_KEY:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    else:
        supabase_client = None
except Exception as e:
    print(f"[Supabase Init Notice]: {e}")
    supabase_client = None


class DataBase:
    """
    Hybrid Database Engine for Unstable Connection:
    - Primary: Supabase Cloud PostgreSQL Database (Persistent in Cloud)
    - Fallback & Local Cache: SQLite3 Local Database (Offline/LAN Resilience)
    """

    def __init__(self):
        self.supabase: Client = supabase_client
        self.conn = None
        try:
            self.conn = sqlite3.connect(FILE)
        except Error as e:
            print(f"[SQLite Connect Error]: {e}")

        self.cursor = self.conn.cursor()
        self._create_sqlite_table()

    def close(self):
        if self.conn:
            self.conn.close()

    def _create_sqlite_table(self):
        query = f"""CREATE TABLE IF NOT EXISTS {SQLITE_TABLE}
                    (name TEXT, content TEXT, time Date, id INTEGER PRIMARY KEY AUTOINCREMENT)"""
        self.cursor.execute(query)
        self.conn.commit()

    def save_message(self, name, msg):
        """
        Saves the message to Supabase Cloud Database, and caches locally to SQLite.
        """
        now_dt = datetime.now()
        iso_time = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        # 1. Save to Supabase Cloud
        supabase_saved = False
        if self.supabase:
            try:
                res = self.supabase.table('messages').insert({
                    'name': name,
                    'content': msg,
                    'time': iso_time
                }).execute()
                supabase_saved = True
                print(f"[Supabase] Saved cloud record for: {name}")
            except Exception as e:
                # If Supabase table isn't created yet or network issue, fallback to SQLite
                print(f"[Supabase Notice]: Table not created or sync pending ({e}). Cached in local SQLite.")

        # 2. Always persist to local SQLite
        query = f"INSERT INTO {SQLITE_TABLE} VALUES (?, ?, ?, ?)"
        self.cursor.execute(query, (name, msg, now_dt, None))
        self.conn.commit()

    def get_all_messages(self, limit=100, name=None):
        """
        Retrieves messages from Supabase Cloud (Primary).
        Seamlessly falls back to SQLite if cloud is unavailable or table not created yet.
        """
        # 1. Attempt retrieval from Supabase Cloud
        if self.supabase:
            try:
                query = self.supabase.table('messages').select('*').order('id', desc=True).limit(limit)
                if name:
                    query = query.eq('name', name)
                response = query.execute()

                if response and response.data:
                    results = []
                    for row in response.data:
                        raw_time = str(row.get('time', ''))
                        results.append({
                            "name": row.get('name', ''),
                            "message": row.get('content', ''),
                            "time": raw_time
                        })
                    return list(reversed(results))
            except Exception as e:
                print(f"[Supabase Query Notice]: {e}. Reading from SQLite fallback.")

        # 2. Fallback to Local SQLite
        if not name:
            query = f"SELECT * FROM {SQLITE_TABLE}"
            self.cursor.execute(query)
        else:
            query = f"SELECT * FROM {SQLITE_TABLE} WHERE NAME = ?"
            self.cursor.execute(query, (name,))

        result = self.cursor.fetchall()
        results = []
        for r in sorted(result, key=lambda x: x[3], reverse=True)[:limit]:
            r_name, content, date, _id = r
            data = {"name": r_name, "message": content, "time": str(date)}
            results.append(data)

        return list(reversed(results))

    def get_messages_by_name(self, name, limit=100):
        return self.get_all_messages(limit, name)
