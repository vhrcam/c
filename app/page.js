import Logo from "@/components/Logo";

export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-5">
      <Logo className="w-[190px] sm:w-[240px]" />
      <p className="font-serif italic text-2xl text-muted">picture your memories</p>
    </main>
  );
}
