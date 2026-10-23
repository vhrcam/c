export default function Toast({ message }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      {message && (
        <p key={message} className="rise rounded-full bg-ink px-4 py-2 text-center text-[14px] text-paper shadow-[0_8px_24px_rgba(26,25,22,0.25)]">
          {message}
        </p>
      )}
    </div>
  );
}
