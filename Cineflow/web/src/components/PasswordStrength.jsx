import React, { useMemo } from "react";

function scorePassword(pw = "") {
  if (!pw) return { score: 0, label: "Empty", tips: ["Use at least 8 characters."] };

  const length = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  // penalize obvious patterns - KR 02/10/2025
  const sequences = /(0123|1234|2345|3456|4567|5678|6789|abcd|qwerty|password|letmein|cineflow)/i.test(pw);
  const repeats = /(.)\1{2,}/.test(pw);

  let score = 0;

  // base on length
  if (length >= 12) score += 3;
  else if (length >= 10) score += 2;
  else if (length >= 8) score += 1;

  // character variety
  score += Math.max(0, classes - 1); // 0–3

  // deductions
  if (sequences) score -= 2;
  if (repeats) score -= 1;

  score = Math.max(0, Math.min(5, score));

  const label =
    score <= 1 ? "Very weak" :
    score === 2 ? "Weak" :
    score === 3 ? "Fair" :
    score === 4 ? "Strong" : "Very strong";

  const tips = [];
  if (length < 12) tips.push("Use 12+ characters.");
  if (classes < 3) tips.push("Mix upper, lower, numbers, symbols.");
  if (sequences) tips.push("Avoid common words or sequences.");
  if (repeats) tips.push("Avoid repeated characters.");
  if (!tips.length) tips.push("Looks solid ✔");

  return { score, label, tips };
}

export default function PasswordStrength({ password }) {
  const { score, label, tips } = useMemo(() => scorePassword(password), [password]);

  const pct = (score / 5) * 100;

  return (
    <div className="pw-meter">
      <div className="pw-meter-track">
        <div
          className={`pw-meter-fill s${score}`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="pw-meter-row">
        <span className={`pw-meter-label s${score}`}>{label}</span>
        <ul className="pw-meter-tips">
          {tips.slice(0, 2).map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>
    </div>
  );
}