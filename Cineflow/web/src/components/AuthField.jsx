import React from "react";

export default function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  success,
  maxLength,
  inputMode,
  required,
  autoFocus,
  pattern,
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className={`field-input ${error ? "is-error" : ""} ${success ? "is-success" : ""}`}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={inputMode}
        required={required}
        autoFocus={autoFocus}
        pattern={pattern}
      />
      {error && <span className="field-help error">{error}</span>}
      {success && <span className="field-help success">{success}</span>}
    </label>
  );
}