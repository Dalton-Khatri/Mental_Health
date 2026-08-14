import React, { useState } from "react";
import { Lock, CheckCircle2, Loader2, Heart } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/auth` : "http://localhost:5000/api/auth";
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!PASSWORD_RULE.test(newPassword)) {
      setError("Password must be at least 8 characters and include a letter and a number");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setError("No reset token found in the link.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={brandIconStyle}>
          <Heart size={20} fill="#fff" stroke="none" />
        </div>

        {success ? (
          <>
            <CheckCircle2 size={40} color="#5b9a8b" />
            <h2 style={headingStyle}>Password reset!</h2>
            <p style={textStyle}>You can now log in with your new password.</p>
            <a href="/" style={buttonStyle}>Go to login</a>
          </>
        ) : (
          <>
            <h2 style={headingStyle}>Set a new password</h2>
            <p style={textStyle}>Choose a new password for your account.</p>

            <form onSubmit={handleSubmit} style={formStyle}>
              <div style={inputGroupStyle}>
                <Lock size={16} color="#95a5a6" />
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={inputStyle}
                  id="input-new-password"
                  autoComplete="new-password"
                />
              </div>
              <span style={hintStyle}>At least 8 characters, with a letter and a number</span>

              <div style={inputGroupStyle}>
                <Lock size={16} color="#95a5a6" />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                  id="input-confirm-new-password"
                  autoComplete="new-password"
                />
              </div>

              {error && <div style={errorStyle}>{error}</div>}

              <button type="submit" disabled={loading} style={submitStyle} id="btn-reset-password">
                {loading ? (
                  <>
                    <Loader2 size={18} style={{ animation: "sr-spin 0.8s linear infinite" }} />
                    Please wait...
                  </>
                ) : (
                  "Reset password"
                )}
              </button>
            </form>
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
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: 14, marginTop: 12, textAlign: "left" };
const inputGroupStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#f1f3f2",
  border: "1.5px solid transparent",
  borderRadius: 14,
  padding: "12px 16px",
};
const inputStyle = { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, fontFamily: "inherit", color: "#2d3436" };
const hintStyle = { fontSize: 12, color: "#95a5a6", marginTop: -8 };
const errorStyle = {
  padding: "11px 16px",
  background: "rgba(231,76,60,0.06)",
  border: "1px solid rgba(231,76,60,0.15)",
  borderRadius: 12,
  fontSize: 13,
  color: "#c0392b",
};
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
const submitStyle = {
  border: "none",
  background: "#2b614f",
  color: "#fff",
  padding: "13px 24px",
  borderRadius: 999,
  fontSize: 14.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};