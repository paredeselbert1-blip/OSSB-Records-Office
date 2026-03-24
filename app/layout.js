import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter'
});

export const metadata = {
  title: 'Transmittal Monitoring System',
  description: 'Track transmittals across offices and agencies'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <div className="app-shell">
          {children}
          <footer className="app-footer">
            <a
              className="app-footer-icon"
              href="https://www.google.com/maps/search/?api=1&query=Legislative%20Building%20Municipal%20Complex%20Rizal%20Street%20Barangay%20Poblacion%20Taytay%20Palawan"
              target="_blank"
              rel="noreferrer"
              aria-label="Open legislative building location in Google Maps"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5c-3.86 0-7 3.03-7 6.77 0 4.66 5.52 10.97 6.44 11.99.3.33.82.33 1.12 0 .92-1.02 6.44-7.33 6.44-11.99 0-3.74-3.14-6.77-7-6.77zm0 9.26c-1.4 0-2.54-1.1-2.54-2.46S10.6 6.84 12 6.84s2.54 1.1 2.54 2.46S13.4 11.76 12 11.76z" />
              </svg>
            </a>
            <span className="app-footer-text">Legislative Building, Municipal Complex, Rizal Street, Barangay Poblacion, Taytay, Palawan</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
