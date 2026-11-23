import { BrandLogo } from "./BrandMark";

export function WelcomeCanvas() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg flex flex-col items-center text-center">
        <BrandLogo size="lg" className="mb-3" />

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
          How can I help you today?
        </h1>
        <p className="text-sm sm:text-[15px] text-[#9CA3B4] mt-2.5 max-w-md leading-relaxed">
          Ask a question, brainstorm an idea, or chat about anything on your
          mind.
        </p>
      </div>
    </div>
  );
}
