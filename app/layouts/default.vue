<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div class="appShell">
    <a class="skipLink" href="#appMain">{{ t('skipToContent') }}</a>
    <header class="appBar">
      <h1 class="appBarTitle">{{ t('appTitle') }}</h1>
      <UButton to="/settings" variant="ghost">{{ t('navSettings') }}</UButton>
    </header>
    <main id="appMain" class="appContent" tabindex="-1">
      <slot />
    </main>
  </div>
</template>
