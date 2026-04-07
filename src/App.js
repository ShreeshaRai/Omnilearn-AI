from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import datetime
import random
import requests
import os
from dotenv import load_dotenv
import json

load_dotenv()

app = FastAPI()

# =========================
# ✅ CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ✅ DATABASE
# =========================
conn = sqlite3.connect("app.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT,
    streak INTEGER DEFAULT 0,
    last_login TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    question TEXT,
    answer TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    score INTEGER
)
""")

conn.commit()

# =========================
# ✅ MODELS
# =========================
class User(BaseModel):
    username: str
    password: str

class Question(BaseModel):
    username: str
    question: str

class QuizRequest(BaseModel):
    topic: str
    num_questions: int

class ScoreData(BaseModel):
    username: str
    score: int


# =========================
# 🔐 REGISTER
# =========================
@app.post("/register")
def register(user: User):
    try:
        cursor.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (user.username, user.password)
        )
        conn.commit()
        return {"message": "success"}
    except:
        return {"message": "user exists"}


# =========================
# 🔐 LOGIN (FIXED PROPERLY)
# =========================
@app.post("/login")
def login(user: User):
    cursor.execute(
        "SELECT * FROM users WHERE username=? AND password=?",
        (user.username, user.password)
    )
    result = cursor.fetchone()

    if result:
        # 🔥 STREAK LOGIC
        today = str(datetime.date.today())

        last_login = result[3]

        if last_login == today:
            streak = result[2]
        else:
            streak = result[2] + 1

        cursor.execute(
            "UPDATE users SET streak=?, last_login=? WHERE username=?",
            (streak, today, user.username)
        )
        conn.commit()

        return {"message": "success", "streak": streak}

    return {"message": "invalid"}


# =========================
# 🤖 AI RESPONSE
# =========================
@app.post("/ask")
def ask(data: Question):

    api_key = os.getenv("GROQ_API_KEY")

    try:
        url = "https://api.groq.com/openai/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {
                    "role": "system",
                    "content": "Explain in student friendly format with Definition, Explanation, Example, Key Points"
                },
                {
                    "role": "user",
                    "content": data.question
                }
            ]
        }

        res = requests.post(url, json=payload, headers=headers)
        answer = res.json()["choices"][0]["message"]["content"]

    except:
        # ✅ FALLBACK (NO CRASH)
        answer = f"""
Topic: {data.question}

Definition:
Basic explanation of {data.question}

Explanation:
This is simple explanation for students.

Example:
Example of {data.question}

Key Points:
• Easy  
• Important  
• Useful  

INSTRUCTIONS:
Keep it simple and clear for students.
Use proper spacing and line breaks.
Do NOT use symbols like **.
Do not write everything in one paragraph.
Use line breaks to separate sections.
Use bullet points for key points.
Use the exact format specified above. Do not deviate from it.
Use simple language and avoid jargon.
Make it easy to understand for students.
Use examples to illustrate concepts.
Use a friendly and encouraging tone.
Use clear and concise explanations. Avoid unnecessary complexity.
Use proper grammar and punctuation.
Make it easy to read and understand.
Use a consistent format for all responses.
Follow the specified format strictly.
Add a blank line between sections for better readability.
"""

    # ✅ SAVE HISTORY
    cursor.execute(
        "INSERT INTO history (username, question, answer) VALUES (?, ?, ?)",
        (data.username, data.question, answer)
    )
    conn.commit()

    return {"answer": answer}


# =========================
# 🎯 QUIZ GENERATION
# =========================
@app.post("/quiz")
def generate_quiz(data: QuizRequest):
    API_KEY = os.getenv("GROQ_API_KEY")
    try:
        prompt = f"""
Create {data.num_questions} MCQ questions on "{data.topic}".

Return ONLY JSON:
[
  {{
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "answer": "..."
  }}
]
"""

        url = "https://api.groq.com/openai/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.5
        }

        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=15   # 🔥 prevents infinite loading
        )

        result = response.json()
        content = result["choices"][0]["message"]["content"]

        start = content.find("[")
        end = content.rfind("]")

        if start == -1 or end == -1:
            return {"quiz": [], "error": "No JSON", "raw": content}

        quiz = json.loads(content[start:end+1])

        return {"quiz": quiz}

    except Exception as e:
        return {"quiz": [], "error": str(e)}



# =========================
# 📊 SAVE SCORE
# =========================
@app.post("/score")
def save_score(data: ScoreData):
    cursor.execute(
        "INSERT INTO scores (username, score) VALUES (?, ?)",
        (data.username, data.score)
    )
    conn.commit()

    return {"message": "saved"}


# =========================
# 📚 HISTORY
# =========================
@app.get("/history/{username}")
def get_history(username: str):
    cursor.execute(
        "SELECT question, answer FROM history WHERE username=?",
        (username,)
    )
    return {"history": cursor.fetchall()}


# =========================
# 🏆 LEADERBOARD
# =========================
@app.get("/leaderboard")
def leaderboard():
    cursor.execute(
        "SELECT username, MAX(score) FROM scores GROUP BY username ORDER BY MAX(score) DESC LIMIT 10"
    )
    return {"leaderboard": cursor.fetchall()}


# =========================
# 🧪 TEST
# =========================
@app.get("/")
def home():
    return {"message": "Backend running 🚀"}
