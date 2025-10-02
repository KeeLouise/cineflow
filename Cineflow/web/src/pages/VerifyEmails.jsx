import { useSearchParams } from "react-router-dom";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const ok = params.get("ok");
  const reason = params.get("reason");

  if (ok === "1") {
    return (
      <div className="container py-4">
        <div className="alert alert-success">
          Your email has been verified successfully!
        </div>
      </div>
    );
  }

  if (ok === "0" && reason === "expired") {
    return (
      <div className="container py-4">
        <div className="alert alert-warning">
          Verification link expired. Please request a new one.
        </div>
      </div>
    );
  }

  if (ok === "0" && reason === "invalid") {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          Invalid verification link. Please request a new one.
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="alert alert-info">Processing verification…</div>
    </div>
  );
}