import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  Eye,
  FileSearch,
  LockKeyhole,
  Radio,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import heroImage from "../assets/hero.png";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";

export default function BareAIApp() {
  const platformStats = [
    { value: "24/7", label: "Signal monitoring" },
    { value: "3", label: "Role workspaces" },
    { value: "AI", label: "Language analysis" },
  ];

  const capabilities = [
    {
      icon: BrainCircuit,
      title: "AI Text Analysis",
      text: "Classify incoming reports, detect risk patterns, and support Somali-language intelligence review.",
    },
    {
      icon: ClipboardList,
      title: "Case Operations",
      text: "Move validated incidents into investigation queues with owners, status, and action history.",
    },
    {
      icon: BellRing,
      title: "Priority Alerts",
      text: "Surface blacklist matches and new activity so investigators can respond before context is lost.",
    },
    {
      icon: LockKeyhole,
      title: "Secure Access",
      text: "Keep sensitive workflows behind role-based access for admins, investigators, and analysts.",
    },
  ];

  const workflow = [
    {
      icon: FileSearch,
      title: "Review",
      text: "Analyze reports and monitored content through a focused intelligence workspace.",
    },
    {
      icon: DatabaseZap,
      title: "Enrich",
      text: "Connect history, blacklist records, and model output into a clearer operational picture.",
    },
    {
      icon: Eye,
      title: "Investigate",
      text: "Assign cases, track evidence, and keep investigative movement visible to authorized teams.",
    },
  ];

  const teamMembers = [
    {
      name: "Nasteha Mohamud",
      role: "Lead ML & NLP Researcher",
      desc: "Builds language modeling approaches for Somali crime report analysis.",
    },
    {
      name: "Yazin Mohamud",
      role: "Full Stack & Mobile App Developer",
      desc: "Designs the secure product experience and operational dashboard flows.",
    },
    {
      name: "Naima Abdiaziz Said",
      role: "Data Engineer & Analyst",
      desc: "Prepares datasets, feature pipelines, and reporting structures for model use.",
    },
    {
      name: "Najma Muhudin Mohamed",
      role: "Model Evaluation Specialist",
      desc: "Tests model quality, tuning decisions, and measurable system performance.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8] text-[#0f172a] antialiased selection:bg-blue-800 selection:text-white">
      <PublicHeader active="home" />

      <main id="home" className="flex-1">
        {/* HERO SECTION */}
        <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-[#0a0d14] pt-16 text-white">
          <img
            src={heroImage}
            alt="BAREAI intelligence workspace"
            className="absolute inset-0 h-full w-full object-cover opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0d14]/50 to-[#0a0d14]" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-[#f0f4f8]" />

          <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 pb-20 pt-24 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-8 lg:pb-28">
            <div className="flex flex-col justify-center">
              <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/20 bg-blue-950/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#60a5fa]">
                <Radio className="h-3.5 w-3.5 animate-pulse text-[#60a5fa]" />
                Intelligence ready
              </div>

              <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-8xl">
                BAREAI
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                A secure crime intelligence platform for report analysis, blacklist monitoring,
                investigation workflows, and operational decision support.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <NavLink
                  to="/analysis"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1e3a8a] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition-all hover:scale-[1.02] hover:bg-[#2563eb]"
                >
                  Try AI Analysis
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </NavLink>
                <NavLink
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-6 py-3.5 text-sm font-bold text-white backdrop-blur-md transition-all hover:scale-[1.02] hover:bg-white/[0.12]"
                >
                  Staff workspace
                  <UserPlus className="h-4 w-4" />
                </NavLink>
              </div>
            </div>

            <div className="flex items-center lg:justify-end">
              <div className="w-full max-w-[380px] rounded-2xl border border-white/5 bg-[#131924]/90 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-start gap-3.5 border-b border-white/5 pb-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold tracking-tight text-white">
                      Operational Snapshot
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Built for secure field intelligence.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  {platformStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-white/[0.02] bg-[#1b2332]/50 p-3"
                    >
                      <span className="block text-xl font-black text-[#60a5fa]">
                        {stat.value}
                      </span>
                      <span className="mt-1 block text-[10px] font-medium leading-normal text-slate-400">
                        {stat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLATFORM SECTION */}
        <section id="platform" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-900">
                Platform
              </p>
              <h2 className="mt-3 text-3xl font-black text-[#111827] sm:text-4xl">
                One workspace for intelligence teams.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                BAREAI brings report analysis, alerts, cases, history, and user controls into a
                focused system designed for secure daily operations.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="rounded-xl border border-[#cbd5e1] bg-[#f0f4f8] p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-md"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-base font-black text-[#111827]">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* WORKFLOW SECTION */}
        <section id="workflow" className="scroll-mt-20 bg-[#0a0f0c] px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">
                  Workflow
                </p>
                <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                  From raw signals to accountable cases.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  The system supports the full flow from incoming text and monitored accounts to
                  investigation records, alerts, and decision-ready reports.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {workflow.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <article
                      key={item.title}
                      className="rounded-lg border border-white/10 bg-white/[0.06] p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-400/[0.14] text-blue-200">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-xs font-black text-slate-500">0{index + 1}</span>
                      </div>
                      <h3 className="mt-5 text-base font-black">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{item.text}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* MINI SUMMARY SECTION */}
        <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
            {[
              "Public AI analysis",
              "Staff-only investigation tools",
              "Role-based secure access",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-800" />
                <p className="text-sm font-black text-[#111827]">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TEAM SECTION */}
        <section id="team" className="scroll-mt-20 bg-[#e8eef5] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-900">
                  Team
                </p>
                <h2 className="mt-3 text-3xl font-black text-[#111827] sm:text-4xl">
                  Built by specialists across AI, data, and product.
                </h2>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#d4d9cf] bg-white px-3 py-2 text-sm font-bold text-slate-700">
                <BadgeCheck className="h-4 w-4 text-blue-800" />
                Team 4 Specialists
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {teamMembers.map((member) => (
                <article
                  key={member.name}
                  className="rounded-lg border border-[#d4d9cf] bg-white p-5 shadow-sm"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#111827] text-amber-300">
                    <Users className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-base font-black text-[#111827]">{member.name}</h3>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#1e3a8a]">
                    {member.role}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{member.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
