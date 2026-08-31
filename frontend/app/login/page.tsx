"use client";

// Вход — потребителско име + парола (скелет: паролата не се проверява от
// backend-а, изпраща се само потребителят като 'суб').

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useI18n } from "../../components/I18nProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username);
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg || t("login.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">{t("login.title")}</h1>
        <div className="field">
          <label className="label">{t("login.username")}</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label className="label">{t("login.password")}</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy || !username}>
            {t("login.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
