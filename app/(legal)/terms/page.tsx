export const metadata = {
  title: "Terms of Service — ProfitDash",
  description: "Terms and conditions for using ProfitDash.",
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

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.40)" }}>
          Effective date: April 23, 2026 · Last updated: April 23, 2026
        </p>
      </div>

      {/* Intro */}
      <div style={SECTION_STYLE}>
        <p style={P_STYLE}>
          These Terms of Service ("Terms") govern your access to and use of ProfitDash ("the Service"), operated by ProfitDash ("we", "us", "our"). By creating an account or using the Service, you agree to be bound by these Terms.
        </p>
        <p style={P_STYLE}>
          If you do not agree to these Terms, do not use ProfitDash. For questions, contact us at <a href="mailto:hello@profitdash.io" style={{ color: "rgba(167,139,250,0.80)", textDecoration: "none" }}>hello@profitdash.io</a>.
        </p>
      </div>

      {/* 1. The Service */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>1. The Service</h2>
        <p style={P_STYLE}>
          ProfitDash is a software-as-a-service (SaaS) platform that helps performance media buyers monitor ad campaigns, track revenue signals, and automate decisions (kill, watch, scale) across multiple ad networks.
        </p>
        <p style={P_STYLE}>
          The Service connects to third-party ad networks using API credentials you provide. You are solely responsible for ensuring you have the right to use those credentials and that doing so complies with the terms of service of each respective ad network.
        </p>
      </div>

      {/* 2. Account */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>2. Your account</h2>
        <p style={P_STYLE}>To use ProfitDash, you must create an account with a valid email address. You are responsible for:</p>
        <ul style={UL_STYLE}>
          <li style={LI_STYLE}>Keeping your login credentials confidential</li>
          <li style={LI_STYLE}>All activity that occurs under your account</li>
          <li style={LI_STYLE}>Notifying us immediately if you suspect unauthorized access</li>
        </ul>
        <p style={P_STYLE}>You must be at least 18 years old to create an account. Accounts are for individual use unless you are on a team plan (Command). You may not share accounts between multiple users on a solo plan.</p>
      </div>

      {/* 3. Acceptable use */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>3. Acceptable use</h2>
        <p style={P_STYLE}>You agree not to:</p>
        <ul style={UL_STYLE}>
          <li style={LI_STYLE}>Use ProfitDash to violate any applicable law or regulation</li>
          <li style={LI_STYLE}>Attempt to reverse-engineer, decompile, or extract source code from the Service</li>
          <li style={LI_STYLE}>Use the Service to automate activity that violates the terms of your ad networks</li>
          <li style={LI_STYLE}>Resell, sublicense, or white-label the Service without written permission</li>
          <li style={LI_STYLE}>Interfere with the security or integrity of the platform</li>
          <li style={LI_STYLE}>Create multiple accounts to circumvent plan limits</li>
        </ul>
        <p style={P_STYLE}>Violation of these rules may result in immediate account termination without refund.</p>
      </div>

      {/* 4. Plans and billing */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>4. Plans and billing</h2>
        <p style={P_STYLE}>ProfitDash offers several subscription plans:</p>
        <ul style={UL_STYLE}>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Observer</strong> — free, no credit card required</li>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Operator</strong> — €99/month or €79/month billed annually</li>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Dominion</strong> — €249/month or €199/month billed annually</li>
          <li style={LI_STYLE}><strong style={{ color: "rgba(255,255,255,0.70)" }}>Command</strong> — custom pricing for teams and agencies</li>
        </ul>
        <p style={P_STYLE}>Paid plans are billed in advance on a monthly or annual cycle. All prices are in EUR and exclude local taxes where applicable.</p>
        <p style={P_STYLE}>
          <strong style={{ color: "rgba(255,255,255,0.70)" }}>Cancellation:</strong> You may cancel your subscription at any time from your account settings. Your plan remains active until the end of the current billing period. We do not offer prorated refunds for partial periods.
        </p>
        <p style={P_STYLE}>
          <strong style={{ color: "rgba(255,255,255,0.70)" }}>Failed payments:</strong> If a payment fails, we will attempt to retry it up to 3 times over 7 days. If payment is not received, your account will be downgraded to the free Observer plan.
        </p>
      </div>

      {/* 5. Your data */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>5. Your data</h2>
        <p style={P_STYLE}>
          You retain full ownership of your campaign data, revenue signals, and any content you bring to ProfitDash. We do not claim ownership over your data.
        </p>
        <p style={P_STYLE}>
          By using the Service, you grant us a limited license to process and store your data solely for the purpose of providing the Service to you. See our <a href="/privacy" style={{ color: "rgba(167,139,250,0.80)", textDecoration: "none" }}>Privacy Policy</a> for details on how we handle your data.
        </p>
      </div>

      {/* 6. Automation and decisions */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>6. Automation and engine decisions</h2>
        <p style={P_STYLE}>
          ProfitDash can operate in two modes: <strong style={{ color: "rgba(255,255,255,0.70)" }}>Recommendation mode</strong> (suggests actions for your review) and <strong style={{ color: "rgba(255,255,255,0.70)" }}>Automatic mode</strong> (executes actions directly via ad network APIs).
        </p>
        <p style={P_STYLE}>
          You are solely responsible for configuring automation rules and for the consequences of actions taken by the engine on your behalf. ProfitDash is a tool — final responsibility for campaign management decisions rests with you.
        </p>
        <p style={P_STYLE}>
          We are not liable for financial losses, missed opportunities, or errors resulting from engine decisions, including but not limited to incorrectly paused or scaled campaigns.
        </p>
      </div>

      {/* 7. Availability */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>7. Service availability</h2>
        <p style={P_STYLE}>
          We aim to provide a reliable, high-availability service. However, we do not guarantee 100% uptime. Planned maintenance, ad network API outages, or infrastructure issues may temporarily affect the Service.
        </p>
        <p style={P_STYLE}>
          We are not liable for losses resulting from service downtime, data sync delays, or failures in third-party ad network APIs.
        </p>
      </div>

      {/* 8. Limitation of liability */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>8. Limitation of liability</h2>
        <p style={P_STYLE}>
          To the maximum extent permitted by law, ProfitDash shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of revenue, lost profits, or loss of data.
        </p>
        <p style={P_STYLE}>
          Our total liability to you for any claim arising out of or relating to the Service shall not exceed the amount you paid to ProfitDash in the 3 months preceding the claim.
        </p>
      </div>

      {/* 9. Termination */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>9. Termination</h2>
        <p style={P_STYLE}>
          You may close your account at any time from your account settings. We may suspend or terminate your account if you violate these Terms, fail to pay fees, or engage in activity that harms the Service or other users.
        </p>
        <p style={P_STYLE}>
          Upon termination, your access to the Service ends and your data will be deleted within 30 days in accordance with our Privacy Policy.
        </p>
      </div>

      {/* 10. Changes */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>10. Changes to these Terms</h2>
        <p style={P_STYLE}>
          We may update these Terms from time to time. We will notify you of material changes by email at least 14 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the new Terms.
        </p>
      </div>

      {/* 11. Contact */}
      <div style={SECTION_STYLE}>
        <h2 style={H2_STYLE}>11. Contact</h2>
        <p style={P_STYLE}>For questions about these Terms, contact us at:</p>
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
