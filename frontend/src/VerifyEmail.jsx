import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Heart } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/auth` : "http://localhost:5000/api/auth";

export default function VerifyEmail() {
  const [status, setStatus] = useState("loading"); // "loading" | "success" | "error"
  const [message, setMessage] = useState("");
  const hasRun = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode calling this effect twice in development,
    // which would otherwise send the verification request twice and show a
    // false "invalid or expired" error on the second call.
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }

    fetch(`${API_URL}/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Verification failed");
        setStatus("success");
        setMessage(data.message || "Email verified successfully. You can now log in.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, []);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={brandIconStyle}>
          <Heart size={20} fill="#fff" stroke="none" />
        </div>

        {status === "loading" && (
          <>
            <Loader2 size={36} color="#5b9a8b" style={{ animation: "sr-spin 0.8s linear infinite" }} />
            <h2 style={headingStyle}>Verifying your email...</h2>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 size={40} color="#5b9a8b" />
            <h2 style={headingStyle}>Email verified!</h2>
            <p style={textStyle}>{message}</p>
            <a href="/" style={buttonStyle}>Go to login</a>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={40} color="#c0392b" />
            <h2 style={headingStyle}>Verification failed</h2>
            <p style={textStyle}>{message}</p>
            <a href="/" style={buttonStyle}>Back to login</a>
          </>
        )}
      </div>

      <style>{`
        @keyframes sr-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(145deg, #f0f4f3 0%, #e8eff5 50%, #f2eef8 100%)",
  fontFamily: "'Outfit', 'Nunito', sans-serif",
  padding: 24,
};

const cardStyle = {
  width: "100%",
  maxWidth: 400,
  background: "rgba(255,255,255,0.85)",
  borderRadius: 26,
  padding: "40px 32px",
  boxShadow: "0 30px 60px -20px rgba(45,52,54,0.15)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  textAlign: "center",
};

const brandIconStyle = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "#2b614f",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 8,
};

const headingStyle = { margin: "8px 0 0", fontSize: 20, fontWeight: 700, color: "#2d3436" };
const textStyle = { margin: 0, fontSize: 14, color: "#636e72", lineHeight: 1.5 };
const buttonStyle = {
  marginTop: 12,
  padding: "12px 28px",
  borderRadius: 999,
  background: "#2b614f",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 14,
};