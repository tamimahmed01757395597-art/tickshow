export default function Brand() {
  return (
    <a className="brand" href="#home" aria-label="TickShow home">
      <svg className="brand-mark" viewBox="0 0 34 34" aria-hidden="true">
        <path
          d="M3 4h28v7c-4 0-4 10 0 10v9H3v-9c4 0 4-10 0-10Z"
          fill="currentColor"
        />
        <path d="M17 10v14M12 12h10" stroke="var(--ink)" strokeWidth="3" />
        <path d="M8 13v9" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="1.5 2" />
      </svg>
      <span className="brand-word">
        <span>Tick</span>
        <span>Show</span>
      </span>
    </a>
  );
}
