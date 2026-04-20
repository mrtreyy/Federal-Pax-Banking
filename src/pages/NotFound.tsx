import { useNavigate } from "react-router-dom";
import bankLogo from "@/assets/bankunited-logo.jpg";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center"
      style={{ background: "hsl(220,45%,8%)" }}>
      <img src={bankLogo} alt="BankUnited" className="w-16 h-16 rounded-2xl mb-6 bg-white" />
      <div className="text-6xl font-bold mb-4" style={{ color: "hsl(43,85%,60%)" }}>404</div>
      <h1 className="text-white font-bold text-xl mb-2">Page Not Found</h1>
      <p className="text-white/40 text-sm mb-8 max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button onClick={() => navigate("/")} className="gold-btn px-8 py-3 text-sm font-semibold">
        Return to BankUnited Portal
      </button>
    </div>
  );
}
