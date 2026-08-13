import React, { useState } from "react";
import { Heart, Mail, Lock, User, Loader2, CheckCircle2, ShieldCheck, Phone, FileText, X, ShieldAlert, Check } from "lucide-react";

const API_URL = "http://localhost:5000/api/auth";
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function Auth({ onLoginSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot" | "verify"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [code, setCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState(""); // email waiting on verification
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const resetFields = () => {
    setName("");
    setEmail("");
    setEmergencyPhone("");
    setPassword("");
    setConfirmPassword("");
    setCode("");
    setError("");
    setAgreedToTerms(false);
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
      if (!emergencyPhone.trim()) {
        setError("Please enter your emergency contact number");
        return;
      }
      if (!PASSWORD_RULE.test(password)) {
        setError("Password must be at least 8 characters and include a letter and a number");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (!agreedToTerms) {
        setError("You must read and agree to the Terms and Conditions to create an account.");
        return;
      }
    }

    setLoading(true);

    let endpoint = "/login";
    let body = { email, password };
    if (mode === "signup") {
      endpoint = "/signup";
      body = { name, email, password, emergencyPhone };
    } else if (mode === "forgot") {
      endpoint = "/forgot-password";
      body = { email };
    } else if (mode === "verify") {
      endpoint = "/verify-code";
      body = { email: pendingEmail, code };
    }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        // If login fails because the account isn't verified yet, send them
        // straight to the code-entry screen instead of just showing an error.
        if (mode === "login" && data.needsVerification) {
          setPendingEmail(data.email || email);
          setMode("verify");
          setError("");
          setInfoMessage("Your account isn't verified yet. Enter the code we sent to your email.");
          return;
        }
        throw new Error(data.error || "Something went wrong");
      }

      if (mode === "login") {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onLoginSuccess(data.user, data.token);
      } else if (mode === "signup") {
        setPendingEmail(email);
        setMode("verify");
        resetFields();
        setInfoMessage(data.message || "We sent a 6-digit code to your email.");
      } else if (mode === "forgot") {
        setInfoMessage(data.message || "If that email is registered, a reset link has been sent.");
        resetFields();
      } else if (mode === "verify") {
        setInfoMessage("Email verified! You can now log in.");
        setTimeout(() => switchMode("login"), 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setResending(true);
    try {
      const res = await fetch(`${API_URL}/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend code");
      setInfoMessage(data.message || "A new code has been sent.");
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
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

        .sr-auth-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 26px;
          padding: 38px 36px 34px;
          box-shadow: 0 30px 60px -20px rgba(45, 52, 54, 0.15);
          animation: sr-auth-fadeIn 0.5s ease both;
        }

        .sr-auth-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 28px;
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

        .sr-auth-heading {
          font-size: 24px;
          font-weight: 700;
          color: #2d3436;
          margin: 0 0 6px;
          letter-spacing: -0.02em;
          text-align: center;
        }
        .sr-auth-subheading {
          font-size: 13.5px;
          color: #636e72;
          margin: 0 0 24px;
          text-align: center;
          line-height: 1.5;
        }

        .sr-auth-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

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

        .sr-auth-code-input {
          width: 100%;
          text-align: center;
          letter-spacing: 8px;
          font-size: 22px;
          font-weight: 600;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1.5px solid transparent;
          background: #f1f3f2;
          color: #2d3436;
          outline: none;
          box-sizing: border-box;
          font-family: 'Outfit', 'Nunito', sans-serif;
          transition: all 0.25s ease;
        }
        .sr-auth-code-input:focus {
          background: #fff;
          border-color: #5b9a8b;
          box-shadow: 0 0 0 3px rgba(91, 154, 139, 0.1);
        }

        .sr-auth-hint {
          font-size: 11.5px;
          color: #7f8c8d;
          margin: -6px 0 2px 4px;
          line-height: 1.35;
        }

        .sr-auth-terms-container {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 4px;
          padding: 10px 12px;
          background: rgba(91, 154, 139, 0.05);
          border: 1px solid rgba(91, 154, 139, 0.15);
          border-radius: 12px;
        }

        .sr-auth-checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12.5px;
          color: #4a5568;
          line-height: 1.45;
          cursor: pointer;
          user-select: none;
        }

        .sr-auth-checkbox {
          appearance: none;
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border: 1.5px solid #95a5a6;
          border-radius: 5px;
          margin-top: 2px;
          cursor: pointer;
          display: grid;
          place-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
          background: #fff;
        }

        .sr-auth-checkbox:checked {
          background-color: #2b614f;
          border-color: #2b614f;
        }

        .sr-auth-checkbox:checked::before {
          content: "✓";
          font-weight: bold;
          font-size: 12px;
          color: white;
        }

        .sr-auth-terms-btn {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: inherit;
          color: #2b614f;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .sr-auth-terms-btn:hover {
          color: #1f4739;
        }

        .sr-auth-forgot-link {
          text-align: right;
          margin: -6px 0 0;
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

        .sr-auth-resend {
          text-align: center;
          margin-top: 4px;
          font-size: 13px;
          color: #636e72;
        }
        .sr-auth-resend button {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: inherit;
          color: #5b9a8b;
          font-weight: 600;
          cursor: pointer;
        }
        .sr-auth-resend button:hover {
          color: #2b614f;
          text-decoration: underline;
        }
        .sr-auth-resend button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          text-decoration: none;
        }

        .sr-auth-toggle {
          text-align: center;
          margin-top: 18px;
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

        /* Terms Modal Styling */
        .sr-terms-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(23, 30, 33, 0.55);
          backdrop-filter: blur(8px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: sr-auth-fadeIn 0.25s ease;
        }

        .sr-terms-modal-card {
          background: #ffffff;
          border-radius: 24px;
          width: 100%;
          max-width: 560px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.8);
          overflow: hidden;
        }

        .sr-terms-modal-header {
          padding: 22px 24px;
          border-bottom: 1px solid #edf2f7;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fdfefe;
        }

        .sr-terms-modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 18px;
          color: #2b614f;
        }

        .sr-terms-modal-close {
          background: #f1f5f4;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s ease;
        }
        .sr-terms-modal-close:hover {
          background: #e2e8f0;
          color: #1e293b;
        }

        .sr-terms-modal-body {
          padding: 24px;
          overflow-y: auto;
          font-size: 13.5px;
          line-height: 1.6;
          color: #475569;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .sr-terms-modal-body h4 {
          margin: 0 0 4px;
          color: #1e293b;
          font-size: 14.5px;
          font-weight: 700;
        }

        .sr-terms-alert-box {
          background: rgba(234, 88, 12, 0.08);
          border: 1px solid rgba(234, 88, 12, 0.2);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          gap: 12px;
          color: #9a3412;
          font-size: 13px;
        }

        .sr-terms-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #edf2f7;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          background: #f8fafc;
        }

        .sr-terms-btn-decline {
          padding: 10px 18px;
          border-radius: 999px;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #64748b;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sr-terms-btn-decline:hover {
          background: #f1f5f9;
          color: #334155;
        }

        .sr-terms-btn-accept {
          padding: 10px 22px;
          border-radius: 999px;
          border: none;
          background: #2b614f;
          color: #fff;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(43, 97, 79, 0.2);
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sr-terms-btn-accept:hover {
          background: #1f4739;
        }

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

      <div className="sr-auth-blob" />

      <div className="sr-auth-card">
        <div className="sr-auth-brand">
          <div className="sr-auth-brand-icon">
            <Heart size={18} fill="#fff" stroke="none" />
          </div>
          <div className="sr-auth-brand-text">
            <span className="sr-auth-brand-name">Lucid</span>
            <span className="sr-auth-brand-tagline">Your Wellness Companion</span>
          </div>
        </div>

        <h2 className="sr-auth-heading">
          {mode === "login" && "Welcome back"}
          {mode === "signup" && "Create your account"}
          {mode === "forgot" && "Reset your password"}
          {mode === "verify" && "Verify your email"}
        </h2>
        <p className="sr-auth-subheading">
          {mode === "login" && "Sign in to continue your wellness journey"}
          {mode === "signup" && "Start your path to better mental wellbeing"}
          {mode === "forgot" && "Enter your email and we'll send you a reset link"}
          {mode === "verify" && `Enter the 6-digit code we sent to ${pendingEmail}`}
        </p>

        {infoMessage && (
          <div className="sr-auth-info" role="status" style={{ marginBottom: 20 }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{infoMessage}</span>
          </div>
        )}

        {mode === "verify" ? (
          <form onSubmit={handleSubmit} className="sr-auth-form">
            <div className="sr-auth-input-group">
              <ShieldCheck size={16} className="sr-auth-input-icon" style={{ left: 16 }} />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                className="sr-auth-code-input"
                id="input-auth-code"
                autoComplete="one-time-code"
              />
            </div>

            {error && (
              <div className="sr-auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="sr-auth-submit"
              id="btn-verify-code"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="sr-auth-submit-spinner" />
                  Verifying...
                </>
              ) : (
                "Verify code"
              )}
            </button>

            <p className="sr-auth-resend">
              Didn't get a code?{" "}
              <button type="button" onClick={handleResendCode} disabled={resending} id="btn-resend-code">
                {resending ? "Sending..." : "Resend code"}
              </button>
            </p>
          </form>
        ) : (
          <>
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

                {mode === "signup" && (
                  <>
                    <div className="sr-auth-input-group">
                      <Phone size={16} className="sr-auth-input-icon" />
                      <input
                        type="tel"
                        placeholder="Emergency contact number (+9779XXXXXXXX)"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        required
                        className="sr-auth-input"
                        id="input-auth-emergency-phone"
                        autoComplete="tel"
                      />
                    </div>
                    <span className="sr-auth-hint">
                      Primary contact number used for critical wellness alerts
                    </span>
                  </>
                )}

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

                        <div className="sr-auth-terms-container">
                          <label className="sr-auth-checkbox-label">
                            <input
                              type="checkbox"
                              checked={agreedToTerms}
                              onChange={(e) => setAgreedToTerms(e.target.checked)}
                              className="sr-auth-checkbox"
                              id="cb-auth-terms"
                            />
                            <span>
                              I have read and agree to the{" "}
                              <button
                                type="button"
                                className="sr-auth-terms-btn"
                                onClick={() => setShowTermsModal(true)}
                                id="btn-open-terms"
                              >
                                Terms and Conditions
                              </button>{" "}
                              and Privacy Policy.
                            </span>
                          </label>
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
          </>
        )}
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="sr-terms-modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="sr-terms-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sr-terms-modal-header">
              <div className="sr-terms-modal-title">
                <FileText size={20} />
                <span>Terms & Conditions and Privacy Policy</span>
              </div>
              <button
                type="button"
                className="sr-terms-modal-close"
                onClick={() => setShowTermsModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sr-terms-modal-body">
              <div className="sr-terms-alert-box">
                <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Important Crisis Notice:</strong> Lucid is an AI-assisted wellness companion for tracking mental wellbeing. It is <strong>NOT</strong> an emergency dispatcher or medical diagnostic provider. If you are experiencing a severe mental health crisis, call 988 or your local emergency services immediately.
                </div>
              </div>

              <div>
                <h4>1. Acceptance of Terms</h4>
                <p>
                  By creating an account or using Lucid, you agree to these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, please do not use the application.
                </p>
              </div>

              <div>
                <h4>2. Emergency Contact Authorization</h4>
                <p>
                  As part of the account sign-up process, you provide a designated emergency contact phone number. You authorize Lucid to record this number in your account profile and display or notify this contact when critical safety alerts or elevated distress levels are flagged in your weekly analysis or screening assessments.
                </p>
              </div>

              <div>
                <h4>3. Data Privacy & Confidentiality</h4>
                <p>
                  We prioritize your privacy. All audio reflections, text transcripts, and emotional screening data are processed securely. We do not sell your personal data or voice recordings to third parties.
                </p>
              </div>

              <div>
                <h4>4. User Responsibilities</h4>
                <p>
                  You agree to provide accurate registration details, including a valid name, email address, and active emergency phone number. You are responsible for keeping your login credentials confidential.
                </p>
              </div>

              <div>
                <h4>5. Disclaimer & Limitation of Liability</h4>
                <p>
                  Lucid provides automated insights and speech sentiment analysis for self-care and monitoring purposes only. The outputs do not constitute formal psychiatric or clinical diagnosis.
                </p>
              </div>
            </div>

            <div className="sr-terms-modal-footer">
              <button
                type="button"
                className="sr-terms-btn-decline"
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="sr-terms-btn-accept"
                onClick={() => {
                  setAgreedToTerms(true);
                  setShowTermsModal(false);
                }}
              >
                <Check size={16} />
                I Agree & Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
