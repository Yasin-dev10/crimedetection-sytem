import { useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import API from "../api";
import { exportDataset } from "../services";

const emptyData = {
  stats: { total: 0, crime: 0, notCrime: 0 },
  records: [],
  page: 1,
  totalPages: 1,
};

export default function DatasetManager() {
  const [data, setData] = useState(emptyData);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");

  const loadDataset = async (nextPage = 1, nextSource = source) => {
    try {
      setLoading(true);
      setError("");
      const response = await API.get("/history/dataset", {
        params: { page: nextPage, limit: 25, source: nextSource },
      });
      setData(response.data);
      setPage(nextPage);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dataset.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The initial request synchronizes this page with the protected dataset API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDataset(1, source);
  }, [source]);

  const download = async (format) => {
    try {
      setExporting(format);
      setError("");
      const response = await exportDataset({ format, source });
      const blob = new Blob([response.data], {
        type:
          format === "csv"
            ? "text/csv;charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `BAREAI-dataset-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Dataset export failed.");
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--brand)" }}>
            <Database size={18} /> Private workspace
          </div>
          <h1 className="page-title">Dataset Manager</h1>
          <p className="page-subtitle mt-1">
            Review and export the collected records. Access is restricted to the Dataset Manager role.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-base)" }}
          >
            <option value="all">All sources</option>
            <option value="analysis">Analysis</option>
            <option value="facebook">Facebook</option>
            <option value="website">Website</option>
          </select>
          <button className="btn-primary inline-flex items-center gap-2" disabled={Boolean(exporting)} onClick={() => download("xlsx")}>
            <FileSpreadsheet size={16} /> {exporting === "xlsx" ? "Exporting..." : "Excel"}
          </button>
          <button className="rounded-xl border px-4 py-2 text-sm font-semibold" disabled={Boolean(exporting)} onClick={() => download("csv")}>
            <Download size={16} className="mr-2 inline" /> {exporting === "csv" ? "Exporting..." : "CSV"}
          </button>
          <button className="rounded-xl border p-2" onClick={() => loadDataset(page)} disabled={loading} title="Refresh">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Total records", data.stats.total],
          ["Crime-related", data.stats.crime],
          ["Not crime-related", data.stats.notCrime],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-base)" }}>
            <p className="text-xs font-bold uppercase" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className="mt-2 text-3xl font-extrabold">{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-base)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
              <tr>
                <th className="px-4 py-3">Text</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((record) => (
                <tr key={record._id} className="border-t" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="max-w-xl px-4 py-3">
                    <p className="line-clamp-2">{record.text || record.url || "—"}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{record.sourceType}</td>
                  <td className="px-4 py-3">{record.category}</td>
                  <td className="px-4 py-3">{record.investigationStatus || "pending"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{new Date(record.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!loading && data.records.length === 0 && (
                <tr><td colSpan="5" className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>No dataset records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "var(--border-soft)" }}>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <button className="rounded-lg border p-2" disabled={page <= 1 || loading} onClick={() => loadDataset(page - 1)}><ChevronLeft size={17} /></button>
            <button className="rounded-lg border p-2" disabled={page >= data.totalPages || loading} onClick={() => loadDataset(page + 1)}><ChevronRight size={17} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
