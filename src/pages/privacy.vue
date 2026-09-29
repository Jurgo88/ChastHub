<template>
  <div class="dash">
    <AppNav />

    <div class="dash-body legal-body">
      <div class="dash-header">
        <div class="dash-header__text">
          <h1 class="dash-header__title">Privacy Policy</h1>
          <p class="dash-header__sub">Last updated: 1 October 2026</p>
        </div>
      </div>

      <div class="legal-content">
        <p>This policy explains what personal data ChastHub collects, why, and what rights you have over it.</p>

        <h2>Data Controller</h2>
        <p>ChastHub is operated from Slovakia, European Union. Full details of the data controller will be published on this page. Until then, contact us about anything related to your data at <a href="mailto:support@chasthub.com">support@chasthub.com</a>.</p>

        <h2>Information We Collect</h2>
        <p>We collect and process the following personal data:</p>
        <ul>
          <li>Identification data (email address; your name and profile picture if you sign in with Google)</li>
          <li>Account information (login credentials, profile data)</li>
          <li>Subscription status (via third-party providers)</li>
          <li>Content you create: locks and their settings, lock photos or combinations, messages, and reports</li>
          <li>Usage data (interactions, session information)</li>
          <li>Technical data (IP address, browser type, device information)</li>
          <li>Signup origin, recorded once when you create your account: the country and region you signed up from, and how you found us — the domain of the site that linked you here (for example instagram.com, never the full address) and any campaign tags in that link. It is kept with your account, not in your browser, and used only to count where our members come from.</li>
          <li>Cookies and tracking data</li>
        </ul>

        <h2>How We Use Your Data</h2>
        <p>We use your data to:</p>
        <ul>
          <li>Provide and operate the platform</li>
          <li>Manage user accounts and authentication</li>
          <li>Process and manage subscriptions and payments</li>
          <li>Verify user eligibility, including age verification</li>
          <li>Provide customer support</li>
          <li>Improve and analyse platform performance</li>
          <li>Ensure security and prevent fraud</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>Legal Basis for Processing</h2>
        <p>We process your data based on:</p>
        <ul>
          <li>Contract performance</li>
          <li>Legal obligations</li>
          <li>Legitimate interests</li>
          <li>Consent (where required)</li>
        </ul>

        <h2>Sharing of Data</h2>
        <p>We may share data with trusted third parties, including:</p>
        <ul>
          <li>Hosting and database providers (Netlify, Supabase)</li>
          <li>Email service providers</li>
          <li>Analytics providers (Microsoft Clarity, Google Analytics)</li>
        </ul>
        <p>We do not sell your personal data.</p>

        <h2>Payment Providers</h2>
        <p>ChastHub does not take payments yet. When paid plans launch, payments will be processed by a third-party provider (such as Stripe) and we will never store full payment card details on our servers. This policy will be updated before that happens.</p>

        <h2>Analytics</h2>
        <p>We use Microsoft Clarity to understand how the platform is used. Clarity collects usage data through cookies and similar technologies, and produces recordings and heatmaps of page interactions such as clicks, scrolling and navigation. Text you type into form fields, along with numbers and email addresses shown on the page, are masked before they leave your browser and are never received by Clarity.</p>
        <p>We also use Google Analytics to measure traffic: which pages are visited, how visitors arrive, and roughly where in the world they are. It records page views and approximate location derived from your IP address; we do not send it your email address, your display name or anything you write on the platform, and we have not enabled advertising or personalisation features.</p>
        <p>Neither runs until you accept cookies. If you decline, no analytics cookies are set, Google Analytics is not loaded at all, and neither provider links your activity across visits. You can change your answer at any time by clearing this site's data in your browser. Microsoft's handling of the data it receives is described in the <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">Microsoft Privacy Statement</a>, and Google's in the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</p>

        <h2>Cookies</h2>
        <p>We use cookies to:</p>
        <ul>
          <li>Enable core website functionality</li>
          <li>Remember user preferences</li>
          <li>Analyse website performance</li>
          <li>Improve user experience</li>
        </ul>
        <p>You can manage or withdraw your consent for cookies at any time through your browser settings or via our cookie banner.</p>

        <h2>Data Retention</h2>
        <p>We retain personal data only as long as necessary for:</p>
        <ul>
          <li>Providing services</li>
          <li>Legal compliance</li>
          <li>Resolving disputes</li>
        </ul>
        <!-- TASK-178 — what survives an account deletion, and for how long.
             The 12 months must be enforced, not just promised (see TASK-179). -->
        <p>When you delete your account, your profile, display name and avatar are erased. To understand why people leave and to improve the service, we keep your email address, the reason you gave for leaving (and any note you added), the approximate location you signed up from, and any report you chose to send while leaving, for <strong>12 months</strong> after the deletion. After that it is deleted.</p>
        <p>If you want it deleted straight away, email <a href="mailto:support@chasthub.com">support@chasthub.com</a> from the address you used on ChastHub and we will delete it.</p>

        <h2>Your Rights (GDPR)</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your data</li>
          <li>Correct your data</li>
          <li>Request deletion</li>
          <li>Restrict processing</li>
          <li>Data portability</li>
          <li>Withdraw consent</li>
        </ul>
        <p>You can exercise these rights by contacting us at <a href="mailto:support@chasthub.com">support@chasthub.com</a>.</p>

        <h2>Data Security</h2>
        <p>We implement reasonable technical and organisational measures to protect your data.</p>

        <h2>International Users</h2>
        <p>We aim to store your data within the European Union. Some of our service providers may process data outside the EU; where they do, they rely on appropriate safeguards such as the EU Standard Contractual Clauses.</p>
        <p>You also have the right to lodge a complaint with a data protection supervisory authority — in Slovakia, the Office for Personal Data Protection (Úrad na ochranu osobných údajov SR), or the authority in the EU country where you live.</p>

        <h2>Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. Updates will be published on this page.</p>

        <h2>Contact</h2>
        <p>If you have questions about this Privacy Policy, contact us at <a href="mailto:support@chasthub.com">support@chasthub.com</a>.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

// The "· ChastHub" suffix now comes from the site-wide titleTemplate in app.vue.
useSeoMeta({
  title: 'Privacy Policy',
  description: 'How ChastHub collects, uses and protects your personal data — what we store, why we store it, and the rights you have over it.',
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/loq-card' as *;

.legal-body {
  max-width: 760px;
}

.legal-content {
  color: var(--color-text);
  line-height: 1.7;

  :deep(h2) {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 2rem 0 0.75rem;
  }

  :deep(p) {
    margin: 0 0 1rem;
    color: var(--color-text-muted);
  }

  :deep(ul) {
    margin: 0 0 1rem;
    padding-left: 1.25rem;
    color: var(--color-text-muted);
  }

  :deep(a) {
    color: var(--color-accent);
  }
}
</style>
