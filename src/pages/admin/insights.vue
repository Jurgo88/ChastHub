<template>
  <div class="admin-section">
    <div class="admin-section-header">
      <h1>Insights</h1>
      <span class="text-muted">Deeper looks at growth, the marketplace and churn</span>
    </div>

    <!-- TASK-185…189 — one section per question; each loads on its own. -->
    <AdminInsightsSourceQuality />
    <AdminInsightsMarketplace />
    <AdminInsightsCohorts />
    <AdminInsightsChurn />
    <!-- TASK-187 — money and names: super admins only (endpoint too). -->
    <AdminInsightsSubscriptions v-if="authStore.isSuperAdmin" />
  </div>
</template>

<script setup lang="ts">
// Aggregates only, so every admin level that can open the dashboard sees
// them. A section with money or names in it gates itself (TASK-187).
definePageMeta({ layout: 'admin', middleware: 'admin', adminLevel: ['analyst', 'support', 'super_admin'] })

const authStore = useAuthStore()
</script>

<style lang="scss" scoped>
@use './admin-shared';
</style>
