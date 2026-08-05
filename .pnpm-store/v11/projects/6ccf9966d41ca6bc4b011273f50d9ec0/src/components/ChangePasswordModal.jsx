import { useState } from "react";
import API from "../api.js";

export default function ChangePasswordModal({ token, onClose, userName }) {
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [message, setMessage] = useState("");

  const handleRequestPasswordChange = async () => {
    setStatus("loading");

    try {
      const response = await API.post("/auth/request-password-change");

      if (response.status === 200) {
        setStatus("success");
        setMessage(
          "Password change verification email has been sent to your email address. Please check your email for instructions."
        );
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error.response?.data?.message || "An error occurred: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4">Change Password</h2>

        {status === "success" && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-4 text-center">
            <div className="text-cyan-400 text-4xl mb-2">✓</div>
            <p className="text-cyan-300 font-semibold">{message}</p>
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-900 border border-red-700 rounded p-4 text-center mb-4">
            <p className="text-red-300 font-semibold">{message}</p>
          </div>
        )}

        {status === "idle" && (
          <>
            <p className="text-gray-300 mb-6">
              We will send you a verification email with instructions to change
              your password. This is required for security purposes.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleRequestPasswordChange}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded transition duration-200"
              >
                Send Verification Email
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition duration-200"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {status === "loading" && (
          <div className="flex justify-center items-center py-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
          </div>
        )}
      </div>
    </div>
  );
}
