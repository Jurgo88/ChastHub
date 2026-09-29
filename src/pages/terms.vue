<template>
  <div class="dash">
    <AppNav />

    <div class="dash-body legal-body">
      <div class="dash-header">
        <div class="dash-header__text">
          <h1 class="dash-header__title">Terms of Service</h1>
          <p class="dash-header__sub">Last updated: 1 October 2026</p>
        </div>
      </div>

      <div class="legal-content">
        <p>These Terms govern your use of ChastHub, a web platform for adults who run timed chastity locks together — wearers set a lock, keyholders take control of it. By creating an account or using the platform you agree to these Terms. If you do not agree, do not use ChastHub.</p>

        <h2>1. Operator</h2>
        <p>ChastHub is operated from Slovakia, European Union. Full operator details will be published on this page. Until then you can reach us at <a href="mailto:support@chasthub.com">support@chasthub.com</a>.</p>

        <h2>2. Adults only</h2>
        <p>ChastHub is strictly for people aged 18 or over (or the age of majority where you live, if higher). By using the platform you confirm that you meet this requirement. We close any account we reasonably believe belongs to a minor.</p>

        <h2>3. Your account</h2>
        <ul>
          <li>You need an account to use most features. Give us accurate information and keep your login details private.</li>
          <li>You are responsible for everything that happens under your account.</li>
          <li>One person, one account. Do not impersonate anyone or create accounts on someone else's behalf.</li>
          <li>You can delete your account at any time from your profile.</li>
        </ul>

        <h2>4. How ChastHub works</h2>
        <p>A wearer creates a lock with a duration. The lock timer starts when the lock is created. A wearer can keep the lock to themselves, send it to a keyholder, or list it publicly. A keyholder who accepts a lock can add or remove time, pause it or end it. Visitors on a public lock page may be able to add or remove time if the keyholder allows it.</p>
        <p>ChastHub is a tool for keeping time and communicating. It does not physically lock or unlock anything, and it does not control any device.</p>

        <h2>5. Consent and safety</h2>
        <ul>
          <li>Everything on ChastHub is based on consent between adults. You can end your participation in any lock dynamic at any time.</li>
          <li>Your health and safety always come first. Never keep a device on if it causes pain, numbness, discolouration, injury or any medical concern, and never let a timer stop you from seeking medical help or removing a device in an emergency.</li>
          <li>Keep a way to release yourself (such as a spare key or combination) available for emergencies.</li>
          <li>ChastHub is not a medical service and gives no medical advice.</li>
        </ul>

        <h2>6. Acceptable use</h2>
        <p>You must not:</p>
        <ul>
          <li>Harass, threaten, blackmail or pressure other users, including into payments</li>
          <li>Share another person's private information or intimate images without their consent</li>
          <li>Post content that is illegal, involves minors, or depicts non-consensual acts</li>
          <li>Send spam, advertising or scams</li>
          <li>Attempt to access other accounts, data or systems you are not authorised to use, or interfere with the platform's security or operation</li>
          <li>Scrape, copy or resell the platform or its content</li>
        </ul>
        <p>You can report users and content from within the app. We may review reports, remove content, and restrict, suspend or close accounts that break these Terms.</p>

        <h2>7. Your content</h2>
        <p>You keep ownership of what you post (messages, photos, profile details). You give us a limited licence to store, display and transmit it as needed to run the platform. Content you place on a public lock page or public profile can be seen by anyone with the link.</p>

        <h2>8. Free trial, subscription and pricing</h2>
        <p>Keyholders use ChastHub for free. Wearers get a free trial of 30 days from sign-up with full access and no payment details required. When paid plans become available, continued wearer access after the trial will require a subscription. We will show the price and terms clearly before you pay, and you will never be charged without actively subscribing.</p>
        <p>Paid subscriptions, when offered, renew automatically until cancelled and can be cancelled at any time; access continues until the end of the paid period. Payments will be handled by a third-party payment provider and we will not store your full card details.</p>

        <h2>9. Availability and changes</h2>
        <p>We work to keep ChastHub running, but we do not guarantee it will always be available or error-free. We may change, add or remove features. If a change materially affects a paid subscription, we will tell you in advance.</p>

        <h2>10. Liability</h2>
        <p>ChastHub is provided "as is". To the extent the law allows, we are not liable for indirect or consequential loss, for the behaviour of other users, or for any injury or damage resulting from how you use a physical device. Nothing in these Terms limits liability that cannot be limited under applicable law, including your rights as a consumer.</p>

        <h2>11. Ending your use</h2>
        <p>You can stop using ChastHub and delete your account at any time. We may suspend or close an account that breaks these Terms or puts others at risk.</p>

        <h2>12. Governing law</h2>
        <p>These Terms are governed by the laws of the Slovak Republic, without prejudice to any mandatory consumer protection rules of the country where you live.</p>

        <h2>13. Changes to these Terms</h2>
        <p>We may update these Terms. The date at the top shows the latest version. If we make significant changes, we will let you know in the app before they take effect.</p>

        <h2>14. Contact</h2>
        <p>Questions about these Terms: <a href="mailto:support@chasthub.com">support@chasthub.com</a>.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

// The "· ChastHub" suffix now comes from the site-wide titleTemplate in app.vue.
useSeoMeta({
  title: 'Terms of Service',
  description: 'The rules for using ChastHub — eligibility, consent and safety, acceptable use, the free trial and subscriptions, and the limits of our liability.',
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

  :deep(h3) {
    font-size: 1rem;
    font-weight: 700;
    margin: 1.25rem 0 0.5rem;
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
