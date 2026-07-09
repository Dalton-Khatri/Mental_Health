import React, { useState } from "react";
import { Heart, Mail, Lock, User, Loader2, CheckCircle2 } from "lucide-react";

const API_URL = "http://localhost:5000/api/auth";
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function Auth({ onLoginSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const resetFields = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    resetFields();
    setInfoMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    if (mode === "signup") {
      if (!PASSWORD_RULE.test(password)) {
        setError("Password must be at least 8 characters and include a letter and a number");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setLoading(true);

    let endpoint = "/login";
    let body = { email, password };
    if (mode === "signup") {
      endpoint = "/signup";
      body = { name, email, password };
    } else if (mode === "forgot") {
      endpoint = "/forgot-password";
      body = { email };
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (mode === "login") {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onLoginSuccess(data.user, data.token);
      } else if (mode === "signup") {
        setInfoMessage(data.message || "Account created. Please check your email to verify your account before logging in.");
        resetFields();
      } else if (mode === "forgot") {
        setInfoMessage(data.message || "If that email is registered, a reset link has been sent.");
        resetFields();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sr-auth-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap');

        .sr-auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #f0f4f3 0%, #e8eff5 50%, #f2eef8 100%);
          font-family: 'Outfit', 'Nunito', sans-serif;
          position: relative;
          overflow: hidden;
          padding: 24px;
        }

        /* ─── Floating Background Blobs ─── */
        .sr-auth-page::before,
        .sr-auth-page::after {
          content: '';
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.45;
          pointer-events: none;
          z-index: 0;
        }
        .sr-auth-page::before {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(91,154,139,0.3), transparent 70%);
          top: -100px; right: -80px;
          animation: sr-auth-float1 20s ease-in-out infinite;
        }
        .sr-auth-page::after {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(196,181,224,0.25), transparent 70%);
          bottom: -50px; left: 100px;
          animation: sr-auth-float2 25s ease-in-out infinite;
        }
        .sr-auth-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.45;
          pointer-events: none;
          z-index: 0;
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(232,160,180,0.3), transparent 70%);
          top: 40%; left: 50%;
          animation: sr-auth-float3 22s ease-in-out infinite;
        }

        @keyframes sr-auth-float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes sr-auth-float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.05); }
          66% { transform: translate(25px, -35px) scale(0.98); }
        }
        @keyframes sr-auth-float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(35px, 40px) scale(1.08); }
        }

        @keyframes sr-auth-fadeIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes sr-auth-spin {
          to { transform: rotate(360deg); }
        }

        /* ─── Auth Card ─── */
        .sr-auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 26px;
          padding: 40px 36px 36px;
          box-shadow: 0 30px 60px -20px rgba(45, 52, 54, 0.15);
          animation: sr-auth-fadeIn 0.5s ease both;
        }

        /* ─── Brand Header ─── */
        .sr-auth-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 32px;
        }
        .sr-auth-brand-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: #2b614f;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(43, 97, 79, 0.25);
        }
        .sr-auth-brand-text {
          display: flex;
          flex-direction: column;
        }
        .sr-auth-brand-name {
          font-weight: 700;
          font-size: 19px;
          color: #2b614f;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .sr-auth-brand-tagline {
          font-size: 11.5px;
          color: #636e72;
        }

        /* ─── Heading ─── */
        .sr-auth-heading {
          font-size: 24px;
          font-weight: 700;
          color: #2d3436;
          margin: 0 0 6px;
          letter-spacing: -0.02em;
          text-align: center;
        }
        .sr-auth-subheading {
          font-size: 14px;
          color: #636e72;
          margin: 0 0 28px;
          text-align: center;
          line-height: 1.5;
        }

        /* ─── Form ─── */
        .sr-auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ─── Input Group ─── */
        .sr-auth-input-group {
          position: relative;
          display: flex;
          align-items: center;
        }
        .sr-auth-input-icon {
          position: absolute;
          left: 16px;
          color: #95a5a6;
          pointer-events: none;
          transition: color 0.2s ease;
          z-index: 1;
        }
        .sr-auth-input-group:focus-within .sr-auth-input-icon {
          color: #5b9a8b;
        }
        .sr-auth-input {
          width: 100%;
          background: #f1f3f2;
          border: 1.5px solid transparent;
          border-radius: 14px;
          padding: 13px 16px 13px 46px;
          font-family: 'Outfit', 'Nunito', sans-serif;
          font-size: 14px;
          color: #2d3436;
          outline: none;
          transition: all 0.25s ease;
          box-sizing: border-box;
        }
        .sr-auth-input::placeholder {
          color: #95a5a6;
          font-weight: 400;
        }
        .sr-auth-input:focus {
          background: #fff;
          border-color: #5b9a8b;
          box-shadow: 0 0 0 3px rgba(91, 154, 139, 0.1);
        }

        /* ─── Password hint ─── */
        .sr-auth-hint {
          font-size: 12px;
          color: #95a5a6;
          margin: -8px 0 0 4px;
          line-height: 1.4;
        }

        /* ─── Forgot password link ─── */
        .sr-auth-forgot-link {
          text-align: right;
          margin: -8px 0 0;
        }
        .sr-auth-forgot-link button {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 12.5px;
          color: #5b9a8b;
          cursor: pointer;
          font-weight: 600;
        }
        .sr-auth-forgot-link button:hover {
          color: #2b614f;
          text-decoration: underline;
        }

        /* ─── Error Message ─── */
        .sr-auth-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 16px;
          background: rgba(231, 76, 60, 0.06);
          border: 1px solid rgba(231, 76, 60, 0.15);
          border-radius: 12px;
          font-size: 13px;
          color: #c0392b;
          line-height: 1.4;
          animation: sr-auth-fadeIn 0.25s ease;
        }

        /* ─── Info / Success Message ─── */
        .sr-auth-info {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          background: rgba(91, 154, 139, 0.08);
          border: 1px solid rgba(91, 154, 139, 0.2);
          border-radius: 12px;
          font-size: 13.5px;
          color: #2b614f;
          line-height: 1.5;
          animation: sr-auth-fadeIn 0.25s ease;
        }

        /* ─── Submit Button ─── */
        .sr-auth-submit {
          width: 100%;
          border: none;
          background: #2b614f;
          color: #fff;
          padding: 14px 24px;
          border-radius: 999px;
          font-family: 'Outfit', 'Nunito', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 14px rgba(43, 97, 79, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
        }
        .sr-auth-submit:hover:not(:disabled) {
          background: #1f4739;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(43, 97, 79, 0.3);
        }
        .sr-auth-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .sr-auth-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .sr-auth-submit-spinner {
          animation: sr-auth-spin 0.8s linear infinite;
        }

        /* ─── Mode Toggle ─── */
        .sr-auth-toggle {
          text-align: center;
          margin-top: 20px;
          font-size: 13.5px;
          color: #636e72;
        }
        .sr-auth-toggle-link {
          color: #2b614f;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: none;
          font-family: inherit;
          font-size: inherit;
          padding: 0;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .sr-auth-toggle-link:hover {
          color: #1f4739;
          text-decoration: underline;
        }

        /* ─── Decorative divider ─── */
        .sr-auth-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 4px 0;
          color: #95a5a6;
          font-size: 12px;
          font-weight: 500;
        }
        .sr-auth-divider::before,
        .sr-auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(91, 154, 139, 0.15);
        }

        /* ─── Responsive ─── */
        @media (max-width: 480px) {
          .sr-auth-card {
            padding: 32px 24px 28px;
            border-radius: 22px;
          }
          .sr-auth-heading {
            font-size: 21px;
          }
          .sr-auth-brand-name {
            font-size: 17px;
          }
        }
      `}</style>

      {/* Floating blob */}
      <div className="sr-auth-blob" />

      <div className="sr-auth-card">
        {/* Brand */}
        <div className="sr-auth-brand">
          <div className="sr-auth-brand-icon">
            <Heart size={18} fill="#fff" stroke="none" />
          </div>
          <div className="sr-auth-brand-text">
            <span className="sr-auth-brand-name">SerenityScreen</span>
            <span className="sr-auth-brand-tagline">Your Wellness Companion</span>
          </div>
        </div>

        {/* Heading */}
        <h2 className="sr-auth-heading">
          {mode === "login" && "Welcome back"}
          {mode === "signup" && "Create your account"}
          {mode === "forgot" && "Reset your password"}
        </h2>
        <p className="sr-auth-subheading">
          {mode === "login" && "Sign in to continue your wellness journey"}
          {mode === "signup" && "Start your path to better mental wellbeing"}
          {mode === "forgot" && "Enter your email and we'll send you a reset link"}
        </p>

        {/* Success / Info message (replaces the form once shown for signup/forgot) */}
        {infoMessage && (
          <div className="sr-auth-info" role="status" style={{ marginBottom: 20 }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{infoMessage}</span>
          </div>
        )}

        {!infoMessage && (
          <form onSubmit={handleSubmit} className="sr-auth-form">
            {mode === "signup" && (
              <div className="sr-auth-input-group">
                <User size={16} className="sr-auth-input-icon" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="sr-auth-input"
                  id="input-auth-name"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="sr-auth-input-group">
              <Mail size={16} className="sr-auth-input-icon" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="sr-auth-input"
                id="input-auth-email"
                autoComplete="email"
              />
            </div>

            {mode !== "forgot" && (
              <>
                <div className="sr-auth-input-group">
                  <Lock size={16} className="sr-auth-input-icon" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="sr-auth-input"
                    id="input-auth-password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </div>

                {mode === "signup" && (
                  <>
                    <span className="sr-auth-hint">
                      At least 8 characters, with a letter and a number
                    </span>
                    <div className="sr-auth-input-group">
                      <Lock size={16} className="sr-auth-input-icon" />
                      <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="sr-auth-input"
                        id="input-auth-confirm-password"
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {mode === "login" && (
              <div className="sr-auth-forgot-link">
                <button type="button" onClick={() => switchMode("forgot")} id="btn-forgot-password">
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="sr-auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="sr-auth-submit"
              id="btn-auth-submit"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="sr-auth-submit-spinner" />
                  Please wait...
                </>
              ) : mode === "login" ? (
                "Sign in"
              ) : mode === "signup" ? (
                "Create account"
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        )}

        {/* Divider + Mode Toggle (hidden while forgot-password info message is showing) */}
        {mode !== "forgot" && (
          <>
            <div className="sr-auth-divider">or</div>
            <p className="sr-auth-toggle">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                className="sr-auth-toggle-link"
                onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </>
        )}

        {mode === "forgot" && (
          <p className="sr-auth-toggle">
            <button
              type="button"
              className="sr-auth-toggle-link"
              onClick={() => switchMode("login")}
              id="btn-back-to-login"
            >
              Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}