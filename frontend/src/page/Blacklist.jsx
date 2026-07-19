import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  PlayCircle,
  PauseCircle,
  ShieldAlert,
  List,
  Eye,
  BarChart3,
  TrendingUp,
  AlertCircle,
  CalendarDays,
  Database,
  FileText,
  FileWarning,
  Link as LinkIcon,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import API from "../api";

const VALID_VIEWS = ["facebook", "website", "all", "statistics"];

function viewFromSearchParams(searchParams) {
  const q = searchParams.get("view");
  return VALID_VIEWS.includes(q) ? q : "facebook";
}

export default function Blacklist() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState(() => viewFromSearchParams(searchParams));
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);
  const [scanningId, setScanningId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolvingProfile, setResolvingProfile] = useState(false);
  const [profileLookupMessage, setProfileLookupMessage] = useState("");

  const [form, setForm] = useState(() => ({
    type: viewFromSearchParams(searchParams) === "website" ? "website" : "facebook_page",
    name: "",
    value: "",
    reason: "",
  }));

  const facebookPages = useMemo(
    () => dedupeItems(items).filter((item) => item.type === "facebook_page"),
    [items]
  );

  const websiteItems = useMemo(
    () => dedupeItems(items).filter((item) => item.type === "website"),
    [items]
  );

  const changeView = (next) => {
    if (!VALID_VIEWS.includes(next)) return;

    if (
      (view === "facebook" || view === "website") &&
      (next === "facebook" || next === "website") &&
      view !== next
    ) {
      setForm({
        type: next === "website" ? "website" : "facebook_page",
        name: "",
        value: "",
        reason: "",
      });
      setProfileLookupMessage("");
      setResolvingProfile(false);
    }

    setView(next);
    setError("");
    setSuccess("");

    if (next === "facebook") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ view: next }, { replace: true });
    }
  };

  const loadBlacklist = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/blacklist");
      setItems(dedupeItems(res.data || []));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load blacklist");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      setError("");
      const res = await API.get("/blacklist/stats/overview");
      setStats(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load statistics");
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadBlacklist();
  }, []);

  useEffect(() => {
    const next = viewFromSearchParams(searchParams);
    if (next !== view) {
      if (
        (view === "facebook" || view === "website") &&
        (next === "facebook" || next === "website")
      ) {
        setForm({
          type: next === "website" ? "website" : "facebook_page",
          name: "",
          value: "",
          reason: "",
        });
        setProfileLookupMessage("");
        setResolvingProfile(false);
      }
      setView(next);
    }
  }, [searchParams, view]);

  useEffect(() => {
    if (view === "statistics") {
      loadStats();
    }
  }, [view]);

  useEffect(() => {
    const url = form.value.trim();

    if (view !== "facebook" || !isFacebookUrl(url)) {
      setResolvingProfile(false);
      setProfileLookupMessage("");
      return undefined;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        setResolvingProfile(true);
        setProfileLookupMessage("Reading profile name...");
        const res = await API.post("/blacklist/facebook/resolve-profile", { url });
        if (cancelled) return;

        const resolvedName = res.data?.name || "";

        if (resolvedName) {
          setForm((current) => {
            if (current.value.trim() !== url) return current;
            return { ...current, name: resolvedName };
          });
          setProfileLookupMessage("Profile name found.");
        } else {
          setProfileLookupMessage("Profile name not found.");
        }
      } catch (err) {
        if (cancelled) return;

        setProfileLookupMessage(
          err.response?.data?.message || "Profile name not found."
        );
      } finally {
        if (!cancelled) {
          setResolvingProfile(false);
        }
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [form.value, view]);

  const addFacebookPage = async (e) => {
    e.preventDefault();

    try {
      setError("");
      setSuccess("");
      const res = await API.post("/blacklist", { ...form, type: "facebook_page" });
      setItems((prev) => dedupeItems([res.data.item, ...prev]));

      setForm({
        type: "facebook_page",
        name: "",
        value: "",
        reason: "",
      });
      setProfileLookupMessage("");
      setSuccess("Facebook page added to blacklist.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add Facebook page");
    }
  };

  const addWebsite = async (e) => {
    e.preventDefault();

    const url = form.value.trim();
    const name = form.name.trim();

    if (!isAbsoluteHttpUrl(url)) {
      setError("Enter a valid absolute URL starting with http:// or https://");
      return;
    }

    if (!name) {
      setError("Website name is required");
      return;
    }

    try {
      setError("");
      setSuccess("");
      const res = await API.post("/blacklist", {
        type: "website",
        name,
        value: url,
        reason: form.reason.trim(),
      });
      setItems((prev) => dedupeItems([res.data.item, ...prev]));

      setForm({
        type: "website",
        name: "",
        value: "",
        reason: "",
      });
      setSuccess("Website added to blacklist.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add website");
    }
  };

  const updateItem = async (id, updates) => {
    try {
      const res = await API.patch(`/blacklist/${id}`, updates);
      setItems((prev) => prev.map((item) => (item._id === id ? res.data.item : item)));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update item");
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Remove this item from the blacklist?")) return;

    try {
      await API.delete(`/blacklist/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      if (view === "statistics") {
        await loadStats();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete item");
    }
  };

  const scanAllPages = async () => {
    const isWebsite = view === "website";

    try {
      setScanningAll(true);
      setError("");
      setSuccess("");
      await API.post(
        isWebsite ? "/blacklist/website/scan" : "/blacklist/facebook/scan"
      );
      await loadBlacklist();
      setSuccess(
        isWebsite
          ? "Website scan finished. Crime pages are in Reports and Notifications — continue the workflow."
          : "Scan finished. Crime posts are in Reports and Notifications — continue the workflow."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (isWebsite ? "Scan all websites failed" : "Scan all failed")
      );
    } finally {
      setScanningAll(false);
    }
  };

  const scanOnePage = async (id, type = "facebook_page") => {
    const isWebsite = type === "website";

    try {
      setScanningId(id);
      setError("");
      setSuccess("");
      await API.post(
        isWebsite
          ? `/blacklist/website/scan/${id}`
          : `/blacklist/facebook/scan/${id}`
      );
      await loadBlacklist();
      setSuccess(
        isWebsite
          ? "Website scanned. Open results or Notifications to send crime content to Case Management."
          : "Page scanned. Open posts or Notifications to send crime content to Case Management."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (isWebsite ? "Website scan failed" : "Single page scan failed")
      );
    } finally {
      setScanningId("");
    }
  };

  const viewPosts = (id) => {
    navigate(`/blacklist/facebook/${id}/posts`);
  };

  const viewWebsitePages = (id) => {
    navigate(`/blacklist/website/${id}/pages`);
  };

  const openDetails = async (id) => {
    try {
      setDetailLoading(true);
      setError("");
      setDetailData(null);
      const res = await API.get(`/blacklist/${id}/details`);
      setDetailData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load blacklist details");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailData(null);
    setDetailLoading(false);
  };

  const navBtn = (active) => ({
    background: active ? "var(--brand)" : "var(--bg-card)",
    color: active ? "var(--on-accent)" : "var(--text-secondary)",
    border: `1px solid ${active ? "var(--brand)" : "var(--border-base)"}`,
  });

  return (
    <div
      className="w-full transition-colors duration-300"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--brand)" }}
            >
              Watchlist Control
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {view === "facebook"
                ? "Facebook Scraping"
                : view === "website"
                ? "Website Scraping"
                : view === "statistics"
                ? "Blacklist Analytics & Insights"
                : "All Blacklists"}
            </h1>
           
            {success && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium" style={{ color: "var(--accent-success)" }}>
                  {success}
                </p>
                <ActionButton onClick={() => navigate("/cases")}>Open Cases</ActionButton>
                <ActionButton variant="ghost" onClick={() => navigate("/reports")}>
                  Open Reports
                </ActionButton>
              </div>
            )}
          </div>

          <div className="flex max-w-full flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => changeView("facebook")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={navBtn(view === "facebook")}
            >
              <Users size={16} />
              Facebook Scraping
            </button>

            <button
              type="button"
              onClick={() => changeView("website")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={navBtn(view === "website")}
            >
              <Globe size={16} />
              Website Scraping
            </button>

            <button
              type="button"
              onClick={() => changeView("statistics")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={navBtn(view === "statistics")}
            >
              <BarChart3 size={16} />
              Analytics
            </button>

            <button
              type="button"
              onClick={() => changeView("all")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={navBtn(view === "all")}
            >
              <List size={16} />
              All Blacklists
            </button>

            <button
              type="button"
              onClick={() => navigate("/blacklist/fake-crimes")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{
                background: "var(--navy)",
                border: "1px solid var(--navy)",
              }}
            >
              <FileWarning size={16} />
              Fake Crimes
            </button>

            {(view === "facebook" || view === "website") && (
              <button
                type="button"
                onClick={scanAllPages}
                disabled={scanningAll}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "var(--navy)" }}
              >
                <RefreshCw size={16} className={scanningAll ? "animate-spin" : ""} />
                {scanningAll
                  ? "Scanning All..."
                  : view === "website"
                  ? "Scan All Websites"
                  : "Scan All Facebook"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            className="mb-5 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "var(--accent-danger-soft)",
              border: "1px solid var(--accent-danger-border)",
              color: "var(--accent-danger)",
            }}
          >
            {error}
          </div>
        )}

        {view === "statistics" ? (
          <StatisticsView
            stats={stats}
            loading={statsLoading}
            onDeleteItem={deleteItem}
            onViewDetails={openDetails}
          />
        ) : view === "facebook" ? (
          <>
            <form
              onSubmit={addFacebookPage}
              className="mb-6 overflow-hidden rounded-2xl"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6"
                style={{
                  borderBottom: "1px solid var(--border-muted)",
                  background: "var(--brand-soft)",
                }}
              >
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: "var(--brand)", color: "var(--on-accent)" }}
                    >
                      <Plus size={18} />
                    </span>
                    Add Facebook Page
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                    Paste a Facebook page URL — the name is fetched automatically.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-3 sm:p-6">
                <div>
                  <Field
                    label="Facebook Page URL"
                    placeholder="https://www.facebook.com/PageName"
                    value={form.value}
                    onChange={(value) => {
                      setForm({ ...form, value, name: "" });
                    }}
                  />
                  {profileLookupMessage && (
                    <p
                      className="mt-1.5 flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {resolvingProfile && (
                        <RefreshCw
                          size={12}
                          className="animate-spin"
                          style={{ color: "var(--brand)" }}
                        />
                      )}
                      {profileLookupMessage}
                    </p>
                  )}
                </div>

                <Field
                  label="Page Name"
                  placeholder="Auto-filled from URL"
                  value={form.name}
                  readOnly
                  helperText="Filled automatically after the URL is checked."
                />

                <Field
                  label="Reason (optional)"
                  placeholder="Write the reason for blacklisting..."
                  value={form.reason}
                  onChange={(value) => setForm({ ...form, reason: value })}
                  required={false}
                  helperText="Optional — describe why this page is being blacklisted."
                />
              </div>

              <div
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                style={{ borderTop: "1px solid var(--border-muted)" }}
              >
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Pages added here are scanned for crime-related content.
                </p>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--brand)" }}
                >
                  <ShieldAlert size={16} />
                  Add to Blacklist
                </button>
              </div>
            </form>

            <section
              className="rounded-2xl p-5 sm:p-6"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                  <Users size={18} style={{ color: "var(--brand)" }} />
                  Saved Facebook Pages
                </h2>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                >
                  {facebookPages.length} pages
                </span>
              </div>

              {loading ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading pages...
                </p>
              ) : facebookPages.length === 0 ? (
                <Empty text="No Facebook pages added yet. Use the form above to blacklist one." />
              ) : (
                <div className="space-y-3">
                  {facebookPages.map((item) => (
                    <FacebookPageCard
                      key={item._id}
                      item={item}
                      scanningId={scanningId}
                      onScan={(id) => scanOnePage(id, "facebook_page")}
                      onUpdate={updateItem}
                      onDelete={deleteItem}
                      onViewPosts={viewPosts}
                      onViewDetails={openDetails}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : view === "website" ? (
          <>
            <form
              onSubmit={addWebsite}
              className="mb-6 overflow-hidden rounded-2xl"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6"
                style={{
                  borderBottom: "1px solid var(--border-muted)",
                  background: "var(--brand-soft)",
                }}
              >
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: "var(--brand)", color: "var(--on-accent)" }}
                    >
                      <Plus size={18} />
                    </span>
                    Add Website
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                    Register an absolute http(s) URL to monitor for crime-related pages.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-3 sm:p-6">
                <Field
                  label="Website URL"
                  placeholder="https://example.com"
                  value={form.value}
                  onChange={(value) => setForm({ ...form, value })}
                  helperText="Must be an absolute URL starting with http:// or https://"
                />

                <Field
                  label="Website Name"
                  placeholder="Site or page label"
                  value={form.name}
                  onChange={(value) => setForm({ ...form, name: value })}
                  helperText="Required — enter a clear display name."
                />

                <Field
                  label="Reason (optional)"
                  placeholder="Write the reason for blacklisting..."
                  value={form.reason}
                  onChange={(value) => setForm({ ...form, reason: value })}
                  required={false}
                  helperText="Optional — describe why this website is being monitored."
                />
              </div>

              <div
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                style={{ borderTop: "1px solid var(--border-muted)" }}
              >
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Websites added here are scanned for crime-related content.
                </p>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--brand)" }}
                >
                  <ShieldAlert size={16} />
                  Add to Blacklist
                </button>
              </div>
            </form>

            <section
              className="rounded-2xl p-5 sm:p-6"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                  <Globe size={18} style={{ color: "var(--brand)" }} />
                  Saved Websites
                </h2>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                >
                  {websiteItems.length} sites
                </span>
              </div>

              {loading ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading websites...
                </p>
              ) : websiteItems.length === 0 ? (
                <Empty text="No websites added yet. Use the form above to blacklist one." />
              ) : (
                <div className="space-y-3">
                  {websiteItems.map((item) => (
                    <WebsiteCard
                      key={item._id}
                      item={item}
                      scanningId={scanningId}
                      onScan={(id) => scanOnePage(id, "website")}
                      onUpdate={updateItem}
                      onDelete={deleteItem}
                      onViewPages={viewWebsitePages}
                      onViewDetails={openDetails}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section
            className="rounded-2xl p-5 sm:p-6"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h2 className="mb-5 text-lg font-bold">All Saved Blacklists</h2>

            {loading ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Loading blacklists...
              </p>
            ) : items.length === 0 ? (
              <Empty text="No blacklist entries yet." />
            ) : (
              <div className="space-y-3">
                {dedupeItems(items).map((item) => (
                  <div
                    key={item._id}
                    className="rounded-xl p-4"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-muted)",
                    }}
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{item.name}</h3>
                          <Badge color="cyan">{item.type}</Badge>
                          {item.priority && (
                            <Badge color="gray">{item.priority}</Badge>
                          )}
                          <Badge color={item.active ? "cyan" : "gray"}>
                            {item.active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <a
                          href={item.value}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm font-medium"
                          style={{ color: "var(--brand)" }}
                        >
                          <ExternalLink size={13} className="shrink-0" />
                          <span className="truncate">{shortenUrl(item.value)}</span>
                        </a>
                        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                          {item.reason || "No reason provided"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <ActionButton onClick={() => openDetails(item._id)} icon={FileText}>
                          Details
                        </ActionButton>
                        <ActionButton
                          variant="ghost"
                          onClick={() => updateItem(item._id, { active: !item.active })}
                        >
                          {item.active ? "Pause" : "Activate"}
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          onClick={() => deleteItem(item._id)}
                          icon={Trash2}
                        >
                          Remove
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {(detailLoading || detailData) && (
        <BlacklistDetailsModal
          data={detailData}
          loading={detailLoading}
          onClose={closeDetails}
        />
      )}
    </div>
  );
}

function FacebookPageCard({
  item,
  scanningId,
  onScan,
  onUpdate,
  onDelete,
  onViewPosts,
  onViewDetails,
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-muted)",
      }}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold sm:text-lg">{item.name}</h3>
            {item.priority && (
              <Badge color="gray">{String(item.priority).toUpperCase()}</Badge>
            )}
            <Badge color={item.active ? "cyan" : "gray"}>
              {item.active ? "Active" : "Paused"}
            </Badge>
            <Badge color={item.monitorEnabled ? "cyan" : "gray"}>
              {item.monitorEnabled ? "Live Monitor" : "Monitor Off"}
            </Badge>
          </div>

          <a
            href={item.value}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--brand)" }}
          >
            <ExternalLink size={13} className="shrink-0" />
            <span className="truncate">{shortenUrl(item.value)}</span>
          </a>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {item.reason || "No reason provided"}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Last scan:{" "}
            {item.lastScannedAt ? new Date(item.lastScannedAt).toLocaleString() : "Never"}{" "}
            · {item.lastScanStatus || "not_scanned"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => onViewDetails(item._id)} icon={FileText}>
            Details
          </ActionButton>
          <ActionButton
            onClick={() => onScan(item._id)}
            disabled={scanningId === item._id}
            icon={RefreshCw}
            spinning={scanningId === item._id}
            variant="accent"
          >
            {scanningId === item._id ? "Scanning..." : "Scan"}
          </ActionButton>
          <ActionButton onClick={() => onViewPosts(item._id)} icon={Eye} variant="ghost">
            View Posts
          </ActionButton>
          <ActionButton
            onClick={() => onUpdate(item._id, { monitorEnabled: !item.monitorEnabled })}
            icon={item.monitorEnabled ? PauseCircle : PlayCircle}
            variant="ghost"
          >
            {item.monitorEnabled ? "Stop" : "Start"}
          </ActionButton>
          <ActionButton
            onClick={() => onUpdate(item._id, { active: !item.active })}
            variant="ghost"
          >
            {item.active ? "Pause" : "Activate"}
          </ActionButton>
          <ActionButton onClick={() => onDelete(item._id)} icon={Trash2} variant="danger">
            Remove
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function WebsiteCard({
  item,
  scanningId,
  onScan,
  onUpdate,
  onDelete,
  onViewPages,
  onViewDetails,
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-muted)",
      }}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold sm:text-lg">{item.name}</h3>
            {item.priority && (
              <Badge color="gray">{String(item.priority).toUpperCase()}</Badge>
            )}
            <Badge color={item.active ? "cyan" : "gray"}>
              {item.active ? "Active" : "Paused"}
            </Badge>
            <Badge color={item.monitorEnabled ? "cyan" : "gray"}>
              {item.monitorEnabled ? "Live Monitor" : "Monitor Off"}
            </Badge>
          </div>

          <a
            href={item.value}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--brand)" }}
          >
            <ExternalLink size={13} className="shrink-0" />
            <span className="truncate">{shortenUrl(item.value)}</span>
          </a>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {item.reason || "No reason provided"}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Last scan:{" "}
            {item.lastScannedAt ? new Date(item.lastScannedAt).toLocaleString() : "Never"}{" "}
            · {item.lastScanStatus || "not_scanned"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => onViewDetails(item._id)} icon={FileText}>
            Details
          </ActionButton>
          <ActionButton
            onClick={() => onScan(item._id)}
            disabled={scanningId === item._id}
            icon={RefreshCw}
            spinning={scanningId === item._id}
            variant="accent"
          >
            {scanningId === item._id ? "Scanning..." : "Scan"}
          </ActionButton>
          <ActionButton onClick={() => onViewPages(item._id)} icon={Eye} variant="ghost">
            View Results
          </ActionButton>
          <ActionButton
            onClick={() => onUpdate(item._id, { monitorEnabled: !item.monitorEnabled })}
            icon={item.monitorEnabled ? PauseCircle : PlayCircle}
            variant="ghost"
          >
            {item.monitorEnabled ? "Stop" : "Start"}
          </ActionButton>
          <ActionButton
            onClick={() => onUpdate(item._id, { active: !item.active })}
            variant="ghost"
          >
            {item.active ? "Pause" : "Activate"}
          </ActionButton>
          <ActionButton onClick={() => onDelete(item._id)} icon={Trash2} variant="danger">
            Remove
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  icon: Icon,
  variant = "primary",
  disabled = false,
  spinning = false,
}) {
  const styles = {
    primary: {
      background: "var(--navy)",
      color: "var(--on-accent)",
      border: "1px solid var(--navy)",
    },
    accent: {
      background: "var(--brand)",
      color: "var(--on-accent)",
      border: "1px solid var(--brand)",
    },
    ghost: {
      background: "var(--bg-card)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-base)",
    },
    danger: {
      background: "var(--accent-danger-soft)",
      color: "var(--accent-danger)",
      border: "1px solid var(--accent-danger-border)",
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85 disabled:opacity-60"
      style={styles[variant]}
    >
      {Icon && <Icon size={15} className={spinning ? "animate-spin" : ""} />}
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  readOnly = false,
  helperText = "",
  required = true,
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        onFocus={(e) => {
          if (readOnly) return;
          e.target.style.borderColor = "var(--brand)";
          e.target.style.boxShadow = "0 0 0 3px var(--brand-soft)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--border-base)";
          e.target.style.boxShadow = "none";
        }}
        className={`w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all ${
          readOnly ? "cursor-not-allowed opacity-80" : ""
        }`}
        style={{
          background: readOnly ? "var(--bg-elevated)" : "var(--bg-surface)",
          border: "1px solid var(--border-base)",
          color: "var(--text-primary)",
        }}
        required={required}
      />
      {helperText && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {helperText}
        </p>
      )}
    </div>
  );
}

function Badge({ children, color }) {
  const classes = {
    red: {
      background: "var(--accent-danger-soft)",
      color: "var(--accent-danger)",
      border: "var(--accent-danger-border)",
    },
    green: {
      background: "var(--accent-success-soft)",
      color: "var(--accent-success)",
      border: "var(--accent-success-border)",
    },
    cyan: {
      background: "var(--brand-soft)",
      color: "var(--brand)",
      border: "var(--brand-ring)",
    },
    gray: {
      background: "var(--bg-elevated)",
      color: "var(--text-muted)",
      border: "var(--border-base)",
    },
  };
  const tone = classes[color] || classes.gray;

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: tone.background, color: tone.color, border: `1px solid ${tone.border}` }}
    >
      {children}
    </span>
  );
}

function Empty({ text }) {
  return (
    <div className="py-12 text-center">
      <ShieldAlert className="mx-auto mb-3" size={40} style={{ color: "var(--text-muted)" }} />
      <p style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}

function BlacklistDetailsModal({ data, loading, onClose }) {
  const [showRawData, setShowRawData] = useState(false);
  const item = data?.item;
  const report = data?.report || {};
  const histories = data?.histories || [];
  const alerts = data?.alerts || [];
  const relatedUrls = data?.relatedUrls || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:px-4 sm:py-6"
      style={{ background: "rgba(10, 13, 20, 0.72)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-base)",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow-elevated)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between gap-4 px-5 py-4 sm:px-6"
          style={{ borderBottom: "1px solid var(--border-muted)" }}
        >
          <div className="min-w-0 flex-1">
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--brand)" }}
            >
              Blacklist Information
            </p>
            <h2 className="mt-1 truncate text-xl font-bold sm:text-2xl">
              {item?.name || "Loading details..."}
            </h2>
            {item?.value && (
              <a
                href={item.value}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--brand)" }}
              >
                <ExternalLink size={14} className="shrink-0" />
                <span className="truncate">{shortenUrl(item.value)}</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 transition-colors"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-base)",
            }}
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Loading blacklist information...
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <DetailStat title="Total Matches" value={report.totalMatches || 0} icon={Database} />
                <DetailStat title="Crime Matches" value={report.crimeCount || 0} icon={ShieldAlert} accent="danger" />
                <DetailStat title="Not-Crime" value={report.notCrimeCount || 0} icon={AlertCircle} accent="ok" />
                <DetailStat title="Alerts" value={report.totalAlerts || 0} icon={TrendingUp} />
              </div>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <DetailPanel title="Date and Reason" icon={CalendarDays}>
                  <div className="space-y-2.5">
                    <DetailRow label="Added date" value={formatDate(item?.createdAt)} />
                    <DetailRow label="Updated date" value={formatDate(item?.updatedAt)} />
                    <DetailRow label="Reason" value={item?.reason || "No reason saved"} />
                    <DetailRow label="Status" value={item?.active ? "Active" : "Paused"} />
                    <DetailRow
                      label="Added by"
                      value={item?.createdBy?.name || item?.createdBy?.email || "Unknown"}
                    />
                  </div>
                </DetailPanel>

                <DetailPanel title="Related URLs" icon={LinkIcon}>
                  {relatedUrls.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      No related URLs found.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {relatedUrls.map((url) => (
                        <UrlChip key={url} url={url} />
                      ))}
                    </div>
                  )}
                </DetailPanel>
              </section>

              <DetailPanel title="General Report" icon={FileText}>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                  <DetailRow label="Pending investigations" value={report.pendingCount || 0} />
                  <DetailRow label="Sent to investigation" value={report.sentToInvestigationCount || 0} />
                  <DetailRow label="Crime cases" value={report.crimeCaseCount || 0} />
                  <DetailRow label="Latest match" value={formatDate(report.latestMatchAt)} />
                  <DetailRow label="Latest alert" value={formatDate(report.latestAlertAt)} />
                  <DetailRow label="Recent alerts" value={alerts.length} />
                </div>
              </DetailPanel>

              <DetailPanel
                title={`Matched History (${histories.length})`}
                icon={Database}
              >
                {histories.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No matched history records found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {histories.slice(0, 25).map((history) => (
                      <HistoryMatchCard key={history._id} history={history} />
                    ))}
                  </div>
                )}
              </DetailPanel>

              <div
                className="overflow-hidden rounded-xl"
                style={{ border: "1px solid var(--border-muted)" }}
              >
                <button
                  type="button"
                  onClick={() => setShowRawData((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <FileText size={16} style={{ color: "var(--brand)" }} />
                    Raw saved data
                  </span>
                  {showRawData ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showRawData && (
                  <pre
                    className="max-h-64 overflow-auto px-4 py-3 text-xs leading-6"
                    style={{
                      background: "var(--bg-surface)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {JSON.stringify(item, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ title, icon: Icon, children }) {
  return (
    <section
      className="rounded-xl p-4 sm:p-5"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-muted)",
      }}
    >
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
        <Icon size={17} style={{ color: "var(--brand)" }} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailStat({ title, value, icon: Icon, accent }) {
  const tone =
    accent === "danger"
      ? {
          bg: "var(--accent-danger-soft)",
          border: "var(--accent-danger-border)",
          icon: "var(--accent-danger)",
        }
      : accent === "ok"
      ? {
          bg: "var(--accent-success-soft)",
          border: "var(--accent-success-border)",
          icon: "var(--accent-success)",
        }
      : { bg: "var(--brand-soft)", border: "var(--brand-ring)", icon: "var(--brand)" };

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold sm:text-3xl">{value}</p>
        </div>
        <Icon size={20} style={{ color: tone.icon, opacity: 0.75 }} className="shrink-0" />
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  const displayValue = value === 0 ? 0 : value || "N/A";

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {displayValue}
      </p>
    </div>
  );
}

function UrlChip({ url, label = "Open link" }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-soft)",
      }}
      title={url}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
      >
        <ExternalLink size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {label}
        </span>
        <span className="block truncate text-xs" style={{ color: "var(--text-muted)" }}>
          {shortenUrl(url)}
        </span>
      </span>
    </a>
  );
}

function HistoryMatchCard({ history }) {
  const isCrime = Boolean(history.isCrime);

  return (
    <article
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isCrime ? "var(--accent-danger-border)" : "var(--border-soft)"}`,
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
          style={
            isCrime
              ? {
                  background: "var(--accent-danger-soft)",
                  color: "var(--accent-danger)",
                }
              : {
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                }
          }
        >
          {isCrime ? "Crime" : "Not Crime"}
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
          style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
        >
          {history.sourceType || history.type || "history"}
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          {formatDate(history.createdAt)}
        </span>
      </div>

      <p
        className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {history.content}
      </p>

      {history.url && (
        <div className="mt-3.5 flex items-center">
          <a
            href={history.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
            style={{
              background: "var(--brand)",
              color: "var(--on-accent)",
            }}
            title={history.url}
          >
            <ExternalLink size={13} />
            View Post
          </a>
        </div>
      )}
    </article>
  );
}

function shortenUrl(value = "") {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./i, "");
    const path = parsed.pathname.replace(/\/$/, "") || "/";
    const shortPath = path.length > 36 ? `${path.slice(0, 33)}…` : path;
    return `${host}${shortPath === "/" ? "" : shortPath}`;
  } catch {
    return value.length > 48 ? `${value.slice(0, 45)}…` : value;
  }
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

function StatisticsView({ stats, loading, onDeleteItem, onViewDetails }) {
  const [listOpen, setListOpen] = useState(false);
  const [showRemovableOnly, setShowRemovableOnly] = useState(false);

  if (loading) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-base)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading statistics...
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-base)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No statistics available
        </p>
      </div>
    );
  }

  const { summary = {}, topItems = [], removableItems = [], allStats = [] } = stats;
  const allItems = (allStats.length > 0 ? allStats : topItems).map((item) => ({
    ...item,
    _id: String(item._id),
  }));
  const removableIds = new Set(removableItems.map((item) => String(item._id)));

  const displayedItems = showRemovableOnly
    ? allItems.filter((item) => item.canBeRemoved || removableIds.has(item._id))
    : allItems;

  const openAll = () => {
    if (listOpen && !showRemovableOnly) {
      setListOpen(false);
      return;
    }
    setShowRemovableOnly(false);
    setListOpen(true);
  };

  const openSuggested = () => {
    if (listOpen && showRemovableOnly) {
      setListOpen(false);
      return;
    }
    setShowRemovableOnly(true);
    setListOpen(true);
  };

  const toggleList = () => setListOpen((open) => !open);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          title="Total Blacklist Items"
          value={summary.totalBlacklistItems || 0}
          icon={ShieldAlert}
          color="brand"
        />
        <SummaryCard
          title="Total Matches"
          value={summary.totalMatches || 0}
          icon={TrendingUp}
          color="navy"
        />
        <SummaryCard
          title="Crime Matches"
          value={summary.totalCrimeMatches || 0}
          icon={AlertCircle}
          color="red"
        />
        <SummaryCard
          title="Not-Crime Matches"
          value={summary.totalNotCrimeMatches || 0}
          icon={AlertCircle}
          color="green"
        />
      </div>

      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-base)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          style={{ borderBottom: listOpen ? "1px solid var(--border-muted)" : "none" }}
        >
          <button
            type="button"
            onClick={toggleList}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <TrendingUp size={18} style={{ color: "var(--brand)" }} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-bold sm:text-base">
                {listOpen
                  ? showRemovableOnly
                    ? "Suggested for Removal"
                    : "All Blacklist Items"
                  : "Blacklist Items"}
              </span>
              <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                {listOpen
                  ? `${displayedItems.length} shown — click to close`
                  : "Click Show all or Suggested to open"}
              </span>
            </span>
            <span
              className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-base)",
                color: "var(--text-secondary)",
              }}
            >
              {listOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={openAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
              style={{
                background: listOpen && !showRemovableOnly ? "var(--brand)" : "var(--bg-surface)",
                color:
                  listOpen && !showRemovableOnly
                    ? "var(--on-accent)"
                    : "var(--text-secondary)",
                border: `1px solid ${
                  listOpen && !showRemovableOnly ? "var(--brand)" : "var(--border-base)"
                }`,
              }}
            >
              {listOpen && !showRemovableOnly ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Show all ({allItems.length})
            </button>

            {removableItems.length > 0 && (
              <button
                type="button"
                onClick={openSuggested}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
                style={{
                  background:
                    listOpen && showRemovableOnly
                      ? "var(--accent-danger)"
                      : "var(--bg-surface)",
                  color:
                    listOpen && showRemovableOnly
                      ? "var(--on-accent)"
                      : "var(--accent-danger)",
                  border: `1px solid ${
                    listOpen && showRemovableOnly
                      ? "var(--accent-danger)"
                      : "var(--accent-danger-border)"
                  }`,
                }}
              >
                {listOpen && showRemovableOnly ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                Suggested ({removableItems.length})
              </button>
            )}
          </div>
        </div>

        {listOpen && (
          <div className="p-4 sm:p-5">
            {displayedItems.length === 0 ? (
              <Empty text="No matching items found" />
            ) : (
              <div className="space-y-3">
                {displayedItems.map((item) => (
                  <ItemStatCard
                    key={item._id}
                    item={item}
                    canRemove={Boolean(item.canBeRemoved) || removableIds.has(item._id)}
                    onViewDetails={onViewDetails}
                    onDelete={onDeleteItem}
                  />
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setListOpen(false)}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-opacity hover:opacity-85"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-base)",
                }}
              >
                <ChevronUp size={14} />
                Close list
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }) {
  const tones = {
    brand: { bg: "var(--brand-soft)", border: "var(--brand-ring)", icon: "var(--brand)" },
    navy: { bg: "var(--brand-soft)", border: "var(--brand-ring)", icon: "var(--brand)" },
    red: {
      bg: "var(--accent-danger-soft)",
      border: "var(--accent-danger-border)",
      icon: "var(--accent-danger)",
    },
    green: {
      bg: "var(--accent-success-soft)",
      border: "var(--accent-success-border)",
      icon: "var(--accent-success)",
    },
  };
  const tone = tones[color] || tones.brand;

  return (
    <div className="rounded-xl p-4" style={{ background: tone.bg, border: `1px solid ${tone.border}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold sm:text-3xl">{value}</p>
        </div>
        <Icon size={20} style={{ color: tone.icon, opacity: 0.7 }} className="shrink-0" />
      </div>
    </div>
  );
}

function ItemStatCard({ item, onViewDetails, onDelete, canRemove = false }) {
  const totalMatches = item.totalMatches || 0;
  const crimePercentage = item.crimePercentage || 0;
  const notCrimePercentage = item.notCrimePercentage || 0;

  return (
    <article
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${canRemove ? "var(--accent-danger-border)" : "var(--border-muted)"}`,
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{item.name}</h3>
            <Badge color="cyan">{String(item.type || "").replace(/_/g, " ")}</Badge>
            {canRemove && <Badge color="red">Suggested remove</Badge>}
          </div>

          <a
            href={item.value}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--brand)" }}
          >
            <ExternalLink size={13} className="shrink-0" />
            <span className="truncate">{shortenUrl(item.value)}</span>
          </a>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {item.reason || "No reason provided"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
              Matches
            </p>
            <p className="mt-0.5 text-2xl font-bold" style={{ color: "var(--brand)" }}>
              {totalMatches}
            </p>
          </div>

          <div className="h-10 w-px hidden sm:block" style={{ background: "var(--border-base)" }} />

          <div className="text-center">
            <p
              className="text-[11px] font-semibold uppercase"
              style={{ color: "var(--accent-danger)" }}
            >
              Crime
            </p>
            <p className="mt-0.5 text-lg font-bold" style={{ color: "var(--accent-danger)" }}>
              {item.crimeCount}{" "}
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                ({crimePercentage}%)
              </span>
            </p>
          </div>

          <div className="text-center">
            <p
              className="text-[11px] font-semibold uppercase"
              style={{ color: "var(--accent-success)" }}
            >
              Not-Crime
            </p>
            <p className="mt-0.5 text-lg font-bold" style={{ color: "var(--accent-success)" }}>
              {item.notCrimeCount}{" "}
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                ({notCrimePercentage}%)
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => onViewDetails(item._id)} icon={FileText}>
              Details
            </ActionButton>
            {canRemove && (
              <ActionButton
                onClick={() => onDelete(item._id)}
                icon={Trash2}
                variant="danger"
              >
                Remove
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      <div
        className="mt-4 flex h-2 overflow-hidden rounded-full"
        style={{ background: "var(--bg-elevated)" }}
      >
        <div
          className="transition-all"
          style={{ width: `${crimePercentage}%`, background: "var(--accent-danger)" }}
        />
        <div
          className="transition-all"
          style={{ width: `${notCrimePercentage}%`, background: "var(--accent-success)" }}
        />
        {totalMatches > item.crimeCount + item.notCrimeCount && (
          <div
            style={{
              width: `${Math.max(0, 100 - crimePercentage - notCrimePercentage)}%`,
              background: "var(--border-base)",
            }}
          />
        )}
      </div>
    </article>
  );
}

function dedupeItems(list) {
  const seen = new Set();

  return list.filter((item) => {
    const key = `${item.type}:${String(item.value || "")
      .trim()
      .replace(/\/+$/, "")
      .toLowerCase()}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isFacebookUrl(value = "") {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();

    return ["facebook.com", "m.facebook.com", "fb.com"].includes(host);
  } catch {
    return false;
  }
}

function isAbsoluteHttpUrl(value = "") {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
