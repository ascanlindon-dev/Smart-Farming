import { useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "896466997047-ns5fbmfbp8shjjrq1seu29s2s5hdkte0.apps.googleusercontent.com";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const renderButton = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(buttonRef.current.offsetWidth || 320, 400),
      });
    };

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", renderButton);
      renderButton();
      return () => existingScript.removeEventListener("load", renderButton);
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderButton);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", renderButton);
  }, []);

  return (
    <div
      ref={buttonRef}
      className={`auth-google-button min-h-[44px] w-full ${disabled ? "pointer-events-none opacity-60" : ""}`}
      aria-label="Continue with Google"
      aria-disabled={disabled}
      inert={disabled ? "" : undefined}
    />
  );
}
