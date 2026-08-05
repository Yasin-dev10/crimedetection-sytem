import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import Analysis from "./Analysis";

export default function PublicAnalysis() {
  return (
    <div
      className="flex min-h-screen flex-col bg-[#f0f4f8] text-[#0f172a] antialiased"
      data-theme="light"
    >
      <PublicHeader active="analysis" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <Analysis publicMode />
      </main>
      <PublicFooter />
    </div>
  );
}
