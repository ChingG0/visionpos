<template>
  <div class="ipad-frame">
    <RouterView />
  </div>
</template>

<script setup>
</script>

<style>
@import '@/assets/main.css';

.ipad-frame {
  width: 100%;
  max-width: 1024px;
  aspect-ratio: 4 / 3;
  background: var(--color-bg-app);
  border-radius: var(--radius-xl);
  border: 2px solid var(--color-border-base);
  display: flex;
  overflow: hidden;
}
</style>
