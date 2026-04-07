import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {

  // ================= STATE =================
  const [page, setPage] = useState("home");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [quiz, setQuiz] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(0);

  const [history, setHistory] = useState([]);
  const [sidebar, setSidebar] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [image, setImage] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);

  // ================= REGISTER =================
  const register = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/register", {
        username,
        password
      });

      if (res.data.message === "Registered") {
        alert("✅ Account Created");
        setPage("home");
      } else {
        alert("User exists");
      }
    } catch {
      alert("Register error");
    }
  };

  // ================= LOGIN =================
  const login = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/login", {
        username: username.trim(),
        password: password.trim()
      });

      if (res.data.message.toLowerCase() === "success") {
        alert("✅ Login Success");
        setPage("chat");
      } else {
        alert("Invalid credentials");
      }
    } catch {
      alert("Login error");
    }
  };

  // ================= ASK =================
  const askAI = async () => {
    if (!input) return;

    setMessages(prev => [...prev, { sender: "user", text: input }]);
    setLoading(true);

    try {
      const res = await axios.post("http://127.0.0.1:8000/ask", {
        question: input,
        username
      });

      setMessages(prev => [...prev, { sender: "ai", text: res.data.answer }]);
      speak(res.data.answer);

    } catch {
      alert("AI error");
    }

    setInput("");
    setLoading(false);
  };

  // ================= SPEAK =================
  const speak = (text) => {
    const speech = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(speech);
  };

  const stopSpeak = () => {
    window.speechSynthesis.cancel();
  };

  // ================= MIC =================
  const startMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.start();

    recognition.onresult = (e) => {
      setInput(e.results[0][0].transcript);
    };

    recognitionRef.current = recognition;
  };

  const stopMic = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  // ================= CAMERA =================
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (!videoRef.current) {
        alert("Camera not ready");
        return;
      }

      videoRef.current.srcObject = stream;
      videoRef.current.play(); // ✅ FIX ADDED
      setCameraOn(true);

    } catch (err) {
      console.error(err);
      alert("Camera permission denied ❌");
    }
  };

  const stopCamera = () => {
    if (!videoRef.current) return;

    const stream = videoRef.current.srcObject;

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  };

  const capture = () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      alert("Camera not on");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(videoRef.current, 0, 0, 300, 200);

    const img = canvas.toDataURL("image/png");
    setImage(img);

    alert("✅ Image captured");
  };

  const sendImage = async () => {
    if (!image) {
      alert("Capture image first");
      return;
    }

    try {
      const res = await axios.post("http://127.0.0.1:8000/image", {
        image,
        username
      });

      setMessages(prev => [...prev, { sender: "ai", text: res.data.answer }]);

    } catch {
      alert("Image error ❌");
    }
  };

  // ================= QUIZ =================
  const startQuiz = async () => {
    const topic = prompt("Enter topic:");
    const num = prompt("Number of questions:");

    if (!topic || !num) return;

    try {
      const res = await axios.post("http://127.0.0.1:8000/quiz", {
        topic,
        num_questions: parseInt(num)
      });

      const quizData = res.data.quiz || [];

      if (!Array.isArray(quizData) || quizData.length === 0) {
        alert("Quiz failed ❌");
        return;
      }

      setQuiz(quizData);
      setAnswers([]);
      setQIndex(0);
      setPage("quiz");

    } catch {
      alert("Quiz error ❌");
    }
  };

  const submitQuiz = () => {
    let sc = 0;

    quiz.forEach((q, i) => {
      if (answers[i] === q.answer) sc++;
    });

    setScore(sc);
    setPage("result");
  };

  // ================= HISTORY =================
  const loadHistory = async () => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/history/${username}`);
      setHistory(Array.isArray(res.data) ? res.data : []);
      setPage("history");
    } catch {
      alert("History error");
    }
  };

  // ================= UI =================

  if (page === "home") {
    return (
      <div className="center">
        <h1>OmniLearn AI</h1>
        <button onClick={() => setPage("register")}>Register</button>
        <button onClick={() => setPage("login")}>Login</button>
      </div>
    );
  }

  if (page === "register") {
    return (
      <div className="center">
        <h2>Register</h2>
        <input onChange={e => setUsername(e.target.value)} />
        <input type="password" onChange={e => setPassword(e.target.value)} />
        <button onClick={register}>Save</button>
        <button onClick={() => setPage("home")}>Back</button>
      </div>
    );
  }

  if (page === "login") {
    return (
      <div className="center">
        <h2>Login</h2>
        <input onChange={e => setUsername(e.target.value)} />
        <input type="password" onChange={e => setPassword(e.target.value)} />
        <button onClick={login}>Login</button>
        <button onClick={() => setPage("home")}>Back</button>
      </div>
    );
  }

  if (page === "quiz") {

    if (!quiz || quiz.length === 0) {
      return <div>Loading Quiz...</div>;
    }

    const q = quiz[qIndex];

    if (!q || !q.options) {
      return <div>Invalid question ❌</div>;
    }

    return (
      <div className="center">
        <h3>{q.question}</h3>

        {q.options.map((opt, i) => (
          <button key={i} onClick={() => {
            const copy = [...answers];
            copy[qIndex] = opt;
            setAnswers(copy);
          }}>
            {opt}
          </button>
        ))}

        <div>
          <button onClick={() => setQIndex(prev => Math.max(prev - 1, 0))}>Prev</button>
          <button onClick={() => setQIndex(prev => Math.min(prev + 1, quiz.length - 1))}>Next</button>
          <button onClick={submitQuiz}>Submit</button>
          <button onClick={() => setPage("chat")}>Back</button>
        </div>
      </div>
    );
  }

  if (page === "result") {
    return (
      <div className="center">
        <h2>Score: {score}</h2>
        <button onClick={() => setPage("chat")}>Back</button>
      </div>
    );
  }

  if (page === "history") {
    return (
      <div>
        <button onClick={() => setPage("chat")}>Back</button>

        {history.map((h, i) => (
          <div key={i}>
            <b>{h.question}</b>
            <pre>{h.answer}</pre>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <button onClick={() => setSidebar(!sidebar)}>☰</button>
        OmniLearn AI
      </div>

      {sidebar && (
        <div className="sidebar">
          <button onClick={loadHistory}>History</button>
          <button onClick={() => setSidebar(false)}>Close</button>
        </div>
      )}

      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={m.sender === "user" ? "user" : "ai"}>
            <pre>{m.text}</pre>
          </div>
        ))}
        {loading && <div className="ai">AI is typing...</div>}
      </div>

      <div className="input">
        <input value={input} onChange={e => setInput(e.target.value)} />

        <button onClick={askAI}>Send</button>
        <button onClick={startMic}>🎤</button>
        <button onClick={stopMic}>Stop</button>
        <button onClick={startQuiz}>Quiz</button>

        <button onClick={openCamera}>📷</button>
        <button onClick={stopCamera}>Stop Cam</button>
        <button onClick={capture}>Capture</button>
        <button onClick={sendImage}>Send Img</button>

        <button onClick={stopSpeak}>Stop Voice</button>
      </div>

      {cameraOn && <video ref={videoRef} autoPlay width="300" />}
      <canvas ref={canvasRef} width="300" height="200" style={{ display: "none" }} />

    </div>
  );
}

export default App;
