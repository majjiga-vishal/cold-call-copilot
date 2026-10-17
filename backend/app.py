import os
import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

DB_PATH = 'database.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Automatically create tables if they do not exist
def setup_database():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prospect_name TEXT NOT NULL,
            company_name TEXT,
            phone TEXT,
            current_stage TEXT DEFAULT 'Opener',
            outcome TEXT DEFAULT 'In Progress',
            follow_up_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            call_id INTEGER NOT NULL,
            stage_name TEXT NOT NULL,
            caller_notes TEXT,
            prospect_reaction TEXT,
            ai_guidance TEXT,
            logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (call_id) REFERENCES calls (id)
        )
    ''')
    conn.commit()
    conn.close()
    print("Database tables verified and ready.")

setup_database()

# Health Check Endpoint
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "Cold Call Co-pilot API"}), 200

# 1. Start Call
@app.route('/api/calls', methods=['POST'])
def start_call():
    try:
        data = request.get_json(force=True, silent=True) or {}
        prospect_name = data.get('prospect_name', 'Prospect')
        company_name = data.get('company_name', 'Company')
        phone = data.get('phone', '')

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO calls (prospect_name, company_name, phone, current_stage) VALUES (?, ?, ?, 'Opener')",
            (prospect_name, company_name, phone)
        )
        conn.commit()
        call_id = cursor.lastrowid
        conn.close()
        return jsonify({"call_id": call_id, "stage": "Opener"}), 201
    except Exception as e:
        print(f"Error in start_call: {e}")
        return jsonify({"error": str(e)}), 500

# 2. Log Stage Notes
@app.route('/api/calls/<int:call_id>/stage', methods=['POST'])
def log_stage(call_id):
    try:
        data = request.get_json(force=True, silent=True) or {}
        stage_name = data.get('stage_name', 'Opener')
        caller_notes = data.get('caller_notes', '')
        prospect_reaction = data.get('prospect_reaction', '')
        ai_guidance = data.get('ai_guidance', '')

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO stage_logs (call_id, stage_name, caller_notes, prospect_reaction, ai_guidance) VALUES (?, ?, ?, ?, ?)",
            (call_id, stage_name, caller_notes, prospect_reaction, ai_guidance)
        )
        cursor.execute("UPDATE calls SET current_stage = ? WHERE id = ?", (stage_name, call_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "stage": stage_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 3. LLM Live Advice
@app.route('/api/ai-assist', methods=['POST'])
def ai_assist():
    data = request.get_json(force=True, silent=True) or {}
    current_stage = data.get('current_stage', 'Opener')
    prospect_words = data.get('prospect_words', '')

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        return jsonify({"advice": "Add GEMINI_API_KEY to your .env file."})

    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        prompt = f"""
        You are a cold call coach listening to a live call.
        Stage: {current_stage}
        Prospect said: "{prospect_words}"

        Respond concisely:
        1. Trap: (Mistake to avoid)
        2. What to Say: (Exact 1-2 sentence script for caller)
        3. Next Step: (Stay or move forward)
        """
        response = client.models.generate_content(
            model='gemini-3.8-flash',
            contents=prompt,
        )
        return jsonify({"advice": response.text})
    except Exception as e:
        return jsonify({"advice": f"AI Guidance: Acknowledge their concern and ask a qualifying question. ({str(e)})"})

# 4. End Call
@app.route('/api/calls/<int:call_id>/end', methods=['POST'])
def end_call(call_id):
    try:
        data = request.get_json(force=True, silent=True) or {}
        outcome = data.get('outcome', 'Completed')
        notes = data.get('notes', '')

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE calls SET outcome = ?, follow_up_notes = ? WHERE id = ?", (outcome, notes, call_id))
        conn.commit()
        conn.close()
        return jsonify({"status": "Call closed", "outcome": outcome})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)