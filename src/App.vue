<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <RouterView v-slot="{ Component }">
    <KeepAlive include="HomeView">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>
</template>
