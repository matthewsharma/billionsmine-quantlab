import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Quant Lab Module' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after {
            box-sizing: border-box;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes chartLoadSweep {
            0% {
              clip-path: inset(0 100% 0 0);
              opacity: 0.2;
            }
            100% {
              clip-path: inset(0 0 0 0);
              opacity: 1;
            }
          }
          .chart-sweep-active {
            animation: chartLoadSweep 1.05s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          /* Custom styled default checkboxes */
          input[type="checkbox"] {
            -webkit-appearance: none;
            appearance: none;
            width: 15px;
            height: 15px;
            border-radius: 4px;
            border: 1.5px solid #cbd5e1;
            background-color: #ffffff;
            cursor: pointer;
            display: inline-grid;
            place-content: center;
            margin: 0;
            vertical-align: middle;
            transition: all 0.15s ease;
            outline: none;
            flex-shrink: 0;
          }
          input[type="checkbox"]:hover {
            border-color: #2563eb;
          }
          input[type="checkbox"]:focus-visible {
            box-shadow: 0 0 0 2px rgba(37,99,235,0.25);
          }
          input[type="checkbox"]:checked {
            background-color: #2563eb;
            border-color: #2563eb;
            background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%228%22%20viewBox%3D%220%200%2010%208%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M1.5%204.2L3.8%206.5L8.5%201.5%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E");
            background-repeat: no-repeat;
            background-position: center;
            background-size: 10px 8px;
            box-shadow: 0 1px 3px rgba(37,99,235,0.3);
          }
          /* Custom styled default selects */
          select {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 12px;
            padding-right: 26px !important;
            cursor: pointer;
            outline: none;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
          }
          select:focus-visible {
            border-color: #2563eb !important;
            box-shadow: 0 0 0 2px rgba(37,99,235,0.2) !important;
          }
          select option {
            background-color: inherit;
            color: inherit;
          }
          /* Custom styled default number inputs (hide bright native arrows) */
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }
          @keyframes fadeInPopover {
            from { opacity: 0; transform: translateY(-4px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .chart-panel-draggable {
            transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1), opacity 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            contain: content;
            will-change: transform;
          }
          .chart-panel-lifted {
            opacity: 0.55 !important;
            transform: scale(1.012) translateY(-3px) translate3d(0, 0, 0) !important;
            box-shadow: 0 20px 45px -8px rgba(37,99,235,0.35), 0 0 0 2px #2563eb !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            z-index: 50 !important;
            border: 2px dashed #2563eb !important;
          }
          .chart-panel-drop-target {
            border: 2px solid #3b82f6 !important;
            box-shadow: 0 4px 18px rgba(59,130,246,0.18) !important;
          }
          .chart-gpu-accelerated {
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            will-change: transform;
            contain: content;
          }
        `}} />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'Inter, -apple-system, sans-serif', width: '100%', minHeight: '100vh' }}>{children}</body>
    </html>
  )
}
