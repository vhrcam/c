export default function Notice({ message }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-50 flex justify-center px-4 sm:bottom-7">
      {message && (
        <p key={message} className="rise rounded-full bg-fg px-3.5 py-1.5 text-center font-mono text-[12px] text-bg">
          {message}
        </p>
      )}
    </div>
  );
}
