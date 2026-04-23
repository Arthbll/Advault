export const metadata = {
  title: "Privacy Policy — ProfitDash",
  description: "How ProfitDash collects, uses and protects your data.",
};

const SECTION_STYLE = {
  marginBottom: 48,
};

const H2_STYLE = {
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: "-0.03em",
  color: "rgba(255,255,255,0.92)",
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};

const P_STYLE = {
  fontSize: 15,
  lineHeight: "26px",
  color: "rgba(255,255,255,0.54)",
  marginBottom: 14,
};

const UL_STYLE = {
  paddingLeft: 20,
  marginBottom: 14,
};

const LI_STYLE = {
  fontSize: 15,
  lineHeight: "26px",
  color: "rgba(255,255,255,0.54)",
  marginBottom: 8,
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "72px 40px 100px" }}>

      {/* Header */}
      <div style={{ marginBottom: 56 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)", padding: "5px 13px",
          fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.40)", marginBottom: 24,
        }}>
          Legal
        </div>
        <h1 style={{
          fontSize: 52, fontWeight: 600, letterSpacing: "-0.055em",
          lineHeight: 1.0, color: "rgba(255,255,255,0.92)", marginBottom: 16,
        }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.40)" }}>
          Effective date: April 23, 2026 · Last updated: April 23, 2026
        </p>
      </div>

      {/* Intro */}
      <div style={SECTION_STYLE}>
        <p style={P_STYLE}>
          ProfitDash ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains what data we collect, why we collect it, how we use it, and what rights you have over it.
        </p>
        <p style={P_STYLE}>
          By using ProfitDash, you agree to the practices described in this policy. If you do not agree, please stop using the service and contact us at <a href="mailto:hello@profitdash.io" style={{ color: "rgba(167,139,250,0.80)", textDecoration: "none" }}>hello@profitdash.io</a>.
        </p>
      </div>

      {/* 1. Data we collect */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>1. Data we collect</h2>
        <p style={P_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Account data:</strong> When you register, we collect your email address and a hashed password. We do not store your password in plain text.</p>
        <p style={P_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Ad network credentials:</strong> API keys and tokens you connect to ProfitDash are encrypted at rest using AES-256. They are used solely to sync campaign data on your behalf and are never shared with third parties.</p>
        <p style={P_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Campaign and performance data:</strong> Spend, revenue, clicks, impressions, and ROI data synced from your connected ad networks. This data belongs to you.</p>
        <p style={P_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Postback / conversion data:</strong> Revenue events sent to your unique ProfitDash postback URL, including click IDs, payout amounts, and conversion timestamps.</p>
        <p style={P_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Usage data:</strong> Pages visited, features used, browser type, operating system, and approximate IP-based location. This is used to improve the product.</p>
        <p style={P_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Support communications:</strong> If you contact us by email, we retain those messages to resolve your request and improve our service.</p>
      </div>

      {/* 2. How we use your data */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>2. How we use your data</h2>
        <ul style={UL_STYLE}>
          <li style={LI_STYLE}>To provide, maintain and improve the ProfitDash service</li>
          <li style={LI_STYLE}>To sync campaign data from your connected ad networks on your behalf</li>
          <li style={LI_STYLE}>To power the Decision Engine rules you have configured</li>
          <li style={LI_STYLE}>To send you the daily briefing email and operational alerts</li>
          <li style={LI_STYLE}>To authenticate your account and maintain session security</li>
          <li style={LI_STYLE}>To respond to support requests</li>
          <li style={LI_STYLE}>To detect and prevent fraudulent or abusive activity</li>
          <li style={LI_STYLE}>To comply with legal obligations</li>
        </ul>
        <p style={P_STYLE}>We do not sell your data. We do not use your data to train AI models. We do not serve advertising based on your data.</p>
      </div>

      {/* 3. Data sharing */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>3. Data sharing and third parties</h2>
        <p style={P_STYLE}>We use the following sub-processors to operate ProfitDash:</p>
        <ul style={UL_STYLE}>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Supabase</strong> — database and authentication (servers in EU/US)</li>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Vercel</strong> — hosting and deployment infrastructure</li>
        </ul>
        <p style={P_STYLE}>We do not share your data with any other third party, except when required to do so by law or court order.</p>
      </div>

      {/* 4. Data retention */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>4. Data retention</h2>
        <p style={P_STYLE}>We retain your data for as long as your account is active. If you close your account, your data is deleted within 30 days, except where we are required by law to retain it longer.</p>
        <p style={P_STYLE}>Campaign performance data and logs are retained according to the retention period of your plan (7 days for Observer, 30 days for Operator, 12 months for Dominion).</p>
      </div>

      {/* 5. Security */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>5. Security</h2>
        <p style={P_STYLE}>We take reasonable technical and organizational measures to protect your data:</p>
        <ul style={UL_STYLE}>
          <li style={LI_STYLE}>All data in transit is encrypted via HTTPS/TLS</li>
          <li style={LI_STYLE}>API credentials are encrypted at rest using AES-256</li>
          <li style={LI_STYLE}>Access to production systems is restricted to authorized personnel</li>
          <li style={LI_STYLE}>Multi-factor authentication is available and encouraged</li>
        </ul>
        <p style={P_STYLE}>No system is 100% secure. If you discover a security issue, please contact us immediately at <a href="mailto:hello@profitdash.io" style={{ color: "rgba(167,139,250,0.80)", textDecoration: "none" }}>hello@profitdash.io</a>.</p>
      </div>

      {/* 6. Your rights */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>6. Your rights</h2>
        <p style={P_STYLE}>Depending on your location, you may have the following rights:</p>
        <ul style={UL_STYLE}>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Access:</strong> Request a copy of the personal data we hold about you</li>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Correction:</strong> Request that we correct inaccurate data</li>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Deletion:</strong> Request deletion of your personal data (account closure)</li>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Portability:</strong> Request your data in a structured, machine-readable format</li>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Objection:</strong> Object to certain types of processing</li>
        </ul>
        <p style={P_STYLE}>To exercise any of these rights, contact us at <a href="mailto:hello@profitdash.io" style={{ color: "rgba(167,139,250,0.80)", textDecoration: "none" }}>hello@profitdash.io</a>. We will respond within 30 days.</p>
      </div>

      {/* 7. Cookies */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>7. Cookies</h2>
        <p style={P_STYLE}>ProfitDash uses only essential cookies required for authentication and session management. We do not use tracking, advertising, or analytics cookies. We do not use third-party cookie services.</p>
      </div>

      {/* 8. Changes */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>8. Changes to this policy</h2>
        <p style={P_STYLE}>We may update this Privacy Policy from time to time. We will notify you of material changes by email or via an in-app notice. The updated policy will always be available at this URL.</p>
      </div>

      {/* 9. Contact */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>9. Contact</h2>
        <p style={P_STYLE}>For any questions about this Privacy Policy or your data, contact us at:</p>
        <div style={{
          padding: "20px 24px", borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.025)",
          fontSize: 14, color: "rgba(255,255,255,0.54)",
        }}>
          <div style={{ marginBottom: 4 }}><strong style={{ color: "rgba(255,255,255,0.72)" }}>ProfitDash</strong></div>
          <div>
            <a href="mailto:hello@profitdash.io" style={{ color: "rgba(167,139,250,0.80)", textDecoration: "none" }}>
              hello@profitdash.io
            </a>
          </div>
        </div>
      </div>

    </main>
  );
}
