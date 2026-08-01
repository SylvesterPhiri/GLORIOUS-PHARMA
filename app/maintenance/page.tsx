import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import styles from "./maintenance.module.css";

// Edit this whenever you know a real return window — it's just a string,
// so "later today", "by 6pm", or a specific date all work fine.
const ETA = "later today";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-display",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Under maintenance — Glorious Pharma",
};

export default function MaintenancePage() {
  return (
    <div
      className={`${styles.wrap} ${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <div className={styles.card}>
        <p className={styles.eyebrow}>Glorious Pharma · System Status</p>

        <svg
          className={styles.pulse}
          viewBox="0 0 240 56"
          aria-hidden="true"
        >
          <path
            className={styles.pulseLine}
            d="M0 28 H70 L82 8 L96 48 L108 28 H140 L150 16 L158 40 L166 28 H240"
          />
        </svg>

        <h1 className={styles.headline}>We&apos;re doing some housekeeping.</h1>

        <p className={styles.body}>
          Dispensing records and inventory are paused while we update the
          system. Nothing is lost — everything picks back up the moment
          we&apos;re back online.
        </p>

        <div className={styles.label} role="status">
          <div className={styles.labelRow}>
            <span className={styles.labelKey}>Status</span>
            <span className={styles.labelValue}>
              <span className={styles.dot} />
              Offline for maintenance
            </span>
          </div>
          <div className={styles.labelRow}>
            <span className={styles.labelKey}>Back online</span>
            <span className={styles.labelValue}>{ETA}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
