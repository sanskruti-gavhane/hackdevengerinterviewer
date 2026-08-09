import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  const [interviewStarted, setInterviewStarted] = useState(false);

  const [question, setQuestion] = useState(
    "Tell me about yourself and your technical background."
  );

  const [answer, setAnswer] = useState("");

  const [interviewLoading, setInterviewLoading] = useState(false);

  const [interviewHistory, setInterviewHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // --------------------------------------------------
  // FILE SELECTION
  // --------------------------------------------------

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  // --------------------------------------------------
  // RESUME ANALYSIS
  // --------------------------------------------------

  const analyzeResume = async () => {
    if (!file) {
      alert("Please choose a resume first.");
      return;
    }

    setLoading(true);

    try {
      /*
       * IMPORTANT:
       * At this stage of the project, we are not yet extracting
       * actual PDF text in the browser.
       *
       * We send the resume information to the existing
       * /api/analyze endpoint.
       *
       * Your next planned feature is proper PDF text extraction.
       */

     const arrayBuffer = await file.arrayBuffer();

const base64PDF = btoa(
  new Uint8Array(arrayBuffer).reduce(
    (data, byte) => data + String.fromCharCode(byte),
    ""
  )
);

const response = await fetch("http://localhost:5000/api/analyze", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    resumeText: base64PDF,
    fileType: file.type,
  }),
});

      if (!response.ok) {
        throw new Error(`Resume analysis failed: ${response.status}`);
      }

      const data = await response.json();

      console.log("Resume analysis response:", data);

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data.analysis || "");

    } catch (error) {
      console.error("Resume analysis failed:", error);

      setAnalysis(
        "Something went wrong while analyzing the resume. Check the backend terminal and browser console."
      );
    }

    setLoading(false);
  };

  // --------------------------------------------------
  // START INTERVIEW
  // --------------------------------------------------

  const startInterview = () => {
    setInterviewStarted(true);

    // Reset interview state when starting a new interview
    setQuestion(
      "Tell me about yourself and your technical background."
    );

    setAnswer("");

    setInterviewHistory([]);
  };

  // --------------------------------------------------
  // SUBMIT INTERVIEW ANSWER
  // --------------------------------------------------
   const startVoiceInput = () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "Speech recognition is not supported in this browser. Please use Google Chrome."
    );
    return;
  }

  if (isListening) {
    recognitionRef.current?.stop();
    setIsListening(false);
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-IN";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognitionRef.current = recognition;

  recognition.onstart = () => {
    console.log("Voice input started");
    setIsListening(true);
  };

  recognition.onresult = (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      setAnswer((previous) =>
        `${previous} ${finalTranscript}`.trim()
      );
    }

    console.log("Interim:", interimTranscript);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);

    if (event.error === "not-allowed") {
      alert(
        "Microphone permission was denied. Please allow microphone access."
      );
    } else {
      alert(`Voice input error: ${event.error}`);
    }

    setIsListening(false);
  };

  recognition.onend = () => {
    console.log("Voice input stopped");
    setIsListening(false);
  };

  recognition.start();
};
  const submitAnswer = async () => {
    if (!answer.trim()) {
      alert("Please enter your answer first.");
      return;
    }

    setInterviewLoading(true);

    try {
      // DEBUG:
      // This tells us exactly what is being sent to Gemini.
      console.log(
        "ANSWER BEING SENT TO BACKEND:",
        answer
      );

      console.log(
        "CURRENT QUESTION BEING SENT:",
        question
      );

      console.log(
        "INTERVIEW HISTORY BEING SENT:",
        interviewHistory
      );

      const response = await fetch(
        "http://localhost:5000/api/interview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resume: analysis,
            question: question,
            answer: answer,
            history: interviewHistory,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Interview request failed with status ${response.status}`
        );
      }

      const data = await response.json();

      // DEBUG:
      console.log("INTERVIEW RESPONSE FROM BACKEND:", data);

      // Temporarily keep this alert so we can verify
      // exactly what Gemini returns.
      alert(JSON.stringify(data, null, 2));

      if (data.error) {
        throw new Error(data.error);
      }

      // Make sure Gemini actually returned a next question.
      if (!data.nextQuestion) {
        throw new Error(
          "Backend did not return a nextQuestion."
        );
      }

      // Save the current question + answer + evaluation.
      setInterviewHistory((previous) => [
        ...previous,
        {
          question: question,
          answer: answer,
          evaluation: data.evaluation,
        },
      ]);

      // THIS IS THE IMPORTANT PART:
      // Update the question displayed in the UI.
      setQuestion(data.nextQuestion);

      // Clear the textarea for the next answer.
      setAnswer("");

    } catch (error) {
      console.error(
        "Interview request failed:",
        error
      );

      alert(
        "Unable to generate the next question. Check the browser console and backend terminal."
      );
    }

    setInterviewLoading(false);
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="app">

      {/* NAVBAR */}

      <nav className="navbar">
        <div className="logo">
          InterviewAI
        </div>

        <button className="nav-btn">
          Home
        </button>
      </nav>

      {/* RESUME UPLOAD SECTION */}

      <main className="upload-page">

        <div className="badge">
          📄 Resume Analysis
        </div>

        <h1>
          Upload Your <span>Resume</span>
        </h1>

        <p className="description">
          Upload your resume and let our AI analyze your
          skills, experience and technical knowledge.
        </p>

        <div className="upload-box">

          <div className="upload-icon">
            📄
          </div>

          <h2>
            {file
              ? file.name
              : "Upload your resume"}
          </h2>

          <p>
            PDF files are supported
          </p>

          <label className="upload-btn">
            Choose Resume

            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              hidden
            />
          </label>

          {file && (
            <button
              className="analyze-btn"
              onClick={analyzeResume}
              disabled={loading}
            >
              {loading
                ? "Analyzing..."
                : "Analyze Resume →"}
            </button>
          )}

        </div>

        {/* RESUME ANALYSIS RESULT */}

        {analysis && (
          <section className="analysis-section">

            <ReactMarkdown>
              {analysis}
            </ReactMarkdown>

            {!interviewStarted && (
              <button
                className="start-interview-btn"
                onClick={startInterview}
              >
                🎤 Start AI Interview
              </button>
            )}

          </section>
        )}

        {/* INTERVIEW SECTION */}

        {interviewStarted && (
          <section className="interview-section">

            <div className="interview-header">
              <span>
                🤖 AI Interviewer
              </span>

              <span>
                Question {interviewHistory.length + 1}
              </span>
            </div>

            {/* CURRENT QUESTION */}

            <div className="question-card">

              <p className="question-label">
                AI Interviewer asks:
              </p>

              <h2>
                {question}
              </h2>

            </div>

            {/* ANSWER AREA */}

            <div className="answer-section">

              <label className="answer-label">
                Your Answer
              </label>
<button
  type="button"
  className={`voice-input-btn ${
    isListening ? "listening" : ""
  }`}
  onClick={startVoiceInput}
  disabled={interviewLoading}
  title={isListening ? "Stop listening" : "Speak your answer"}
  aria-label={isListening ? "Stop listening" : "Speak your answer"}
>
  {isListening ? "⏹" : "🎙️"}
</button>
              <textarea
                className="answer-box"
                placeholder={
    isListening
      ? "🎙️ Listening... Speak your answer..."
      : "Type your answer or use the microphone..."
  }
                value={answer}
                onChange={(e) =>
                  setAnswer(e.target.value)
                }
                disabled={interviewLoading}
              />

              <button
                className="submit-answer-btn"
                onClick={submitAnswer}
                disabled={interviewLoading}
              >
                {interviewLoading
                  ? "AI is thinking..."
                  : "Submit Answer →"}
              </button>

            </div>

            {/* PREVIOUS ANSWERS */}

            {interviewHistory.length > 0 && (
              <div className="interview-history">

                <h3>
                  Interview Progress
                </h3>

                {interviewHistory.map(
                  (item, index) => (
                    <div
                      className="history-item"
                      key={index}
                    >

                      <p>
                        <strong>
                          Question {index + 1}:
                        </strong>{" "}
                        {item.question}
                      </p>

                      <p>
                        <strong>
                          Your answer:
                        </strong>{" "}
                        {item.answer}
                      </p>

                      {item.evaluation && (
                        <p>
                          <strong>
                            AI Score:
                          </strong>{" "}
                          {item.evaluation.score}/10
                        </p>
                      )}

                    </div>
                  )
                )}

              </div>
            )}

          </section>
        )}

      </main>

    </div>
  );
}

export default App;