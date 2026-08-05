import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";

/**
 * Investigate / Assign without leaving the page.
 *
 * Props:
 *  - item, onClose, onConfirm
 *  - mode: "investigate" | "assign"
 *  - isAdmin, officers
 *  - existingCase (for assign mode)
 */
const SendToInvestigatorModal = ({
  item,
  onClose,
  onConfirm,
  mode = "investigate",
  isAdmin = false,
  officers = [],
  existingCase = null,
}) => {
  const [finalDecision, setFinalDecision] = useState("");
  const [note, setNote] = useState("");
  const [officerId, setOfficerId] = useState(
    existingCase?.assignedOfficer?._id || existingCase?.assignedOfficer || ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOfficerId(
      existingCase?.assignedOfficer?._id || existingCase?.assignedOfficer || ""
    );
  }, [existingCase]);

  const matchingOfficers = useMemo(() => {
    return [...officers].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [officers]);

  if (!item) return null;

  const inputText =
    item.inputText ||
    item.content ||
    item.extractedText ||
    item.url ||
    item.input?.text ||
    item.input?.url ||
    item.input?.filename ||
    (item.input?.batch_count ? `${item.input.batch_count} items` : "No content");

  const isAssignMode = mode === "assign";
  const title = isAssignMode ? "Assign Investigator" : "Investigate Record";
  const subtitle = isAssignMode
    ? "Assign an officer to this case"
    : isAdmin
    ? "Create a case and assign an investigator here"
    : "Send this record into investigation";

  const handleSubmit = async () => {
    setError("");

    if (isAdmin && !officerId) {
      setError("Please select an investigator to assign.");
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({
        predictionId: item._id || item.id,
        caseId: existingCase?._id,
        finalDecision: finalDecision || undefined,
        note: note.trim() || undefined,
        assignedOfficer: officerId || undefined,
        mode,
      });
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.details ||
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to complete investigation action."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18 }}
          className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                {isAssignMode ? <UserPlus className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </div>
              <div>
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="text-xs text-slate-400">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Record Content
              </p>
              <p className="line-clamp-3 text-sm text-slate-300">{inputText}</p>
            </div>

            {!isAssignMode && (
              <div>
                <p className="mb-2 text-sm font-semibold text-white">
                  Classification{" "}
                  <span className="font-normal text-slate-500">(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFinalDecision(finalDecision === "crime" ? "" : "crime")
                    }
                    className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                      finalDecision === "crime"
                        ? "border-red-500/50 bg-red-500/15 text-red-300"
                        : "border-slate-700 bg-slate-950 text-slate-400 hover:border-red-500/30"
                    }`}
                  >
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    Crime
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFinalDecision(
                        finalDecision === "not_crime" ? "" : "not_crime"
                      )
                    }
                    className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                      finalDecision === "not_crime"
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : "border-slate-700 bg-slate-950 text-slate-400 hover:border-emerald-500/30"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    Not Crime
                  </button>
                </div>
              </div>
            )}

            {isAdmin && (
              <div>
                <p className="mb-2 text-sm font-semibold text-white">
                  Assign Investigator <span className="text-red-400">*</span>
                </p>
                {matchingOfficers.length === 0 ? (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                    No investigators available.
                  </p>
                ) : (
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {matchingOfficers.map((officer) => {
                      const selected = officerId === officer._id;
                      return (
                        <button
                          key={officer._id}
                          type="button"
                          onClick={() => setOfficerId(officer._id)}
                          className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                            selected
                              ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                              : "border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-500/40"
                          }`}
                        >
                          <p className="text-sm font-bold">
                            {officer.name || "Unnamed investigator"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {officer.badgeNumber ||
                              officer.email ||
                              "Investigator"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!isAssignMode && (
              <div>
                <p className="mb-2 text-sm font-semibold text-white">
                  Note <span className="font-normal text-slate-500">(optional)</span>
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-20 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
                  placeholder="Add a note for the investigator..."
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 p-5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {isAssignMode ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {submitting
                ? "Saving..."
                : isAssignMode
                ? "Assign Officer"
                : isAdmin
                ? "Investigate & Assign"
                : "Investigate"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SendToInvestigatorModal;
